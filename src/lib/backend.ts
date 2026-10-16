import { AuthError } from "./errors";
import { supabase } from "./supabase";

const base = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

/** False when VITE_API_URL is empty: the screens that need the backend (e-mail, receipts, creating admins) explain this instead of failing. */
export const backendConfigured = base !== "";
export const NOT_CONFIGURED = "The backend is not connected. Set VITE_API_URL to the sjks-backend address.";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new AuthError("Please sign in.");
  return data.session.access_token;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!backendConfigured) throw new Error(NOT_CONFIGURED);
  const res = await fetch(base + path, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, Authorization: `Bearer ${await token()}` }
  });
  if (res.status === 401) throw new AuthError("Your session has ended. Please sign in again.");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `The server answered ${res.status}.`);
  }
  return res;
}

/** JSON call to sjks-backend with the signed-in staff member's token. */
export async function backend<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await request(path, {
    method: options.method ?? "GET",
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  return (await res.json()) as T;
}

/** Fetches a protected HTML page or file and returns an object URL that can be opened in a new tab. */
export async function backendBlobUrl(path: string): Promise<string> {
  const res = await request(path);
  return URL.createObjectURL(await res.blob());
}

/** Saves a file returned by the backend (for example the donations CSV). */
export async function backendDownload(path: string, fileName: string): Promise<void> {
  const url = await backendBlobUrl(path);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
