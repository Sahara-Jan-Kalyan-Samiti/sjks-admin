import type { PostgrestError } from "@supabase/supabase-js";

/** The signed-in session is gone or the account is not an active admin: the app sends the person back to the sign-in page. */
export class AuthError extends Error {}

const missing = (code?: string) => ["PGRST205", "42P01"].includes(code ?? "");
// PGRST204 / 42703 = a column is missing, 42501 = the database rules do not allow it (yet)
const outdated = (code?: string) => ["PGRST204", "42703"].includes(code ?? "");

/** Turns a database error into a sentence a staff member can act on. */
export function friendlyError(error: { code?: string; message?: string; status?: number }): Error {
  if (error.status === 401 || error.status === 403) return new AuthError(error.message || "Unauthorized");
  if (missing(error.code)) {
    const table = /'(?:public\.)?(\w+)'/.exec(error.message ?? "")?.[1];
    return new Error(
      `This part of the database is not set up yet${table ? ` (table “${table}”)` : ""}. Apply the latest migrations from the sjks-database repository, then try again.`
    );
  }
  if (outdated(error.code))
    return new Error(
      "The database is missing a recent update. Apply the latest migrations from the sjks-database repository, then try again."
    );
  if (error.code === "23505") return new Error("This already exists. Use a different name or address.");
  return new Error(error.message || "Database error");
}

/** Returns `data` or throws a friendly error. Every query in src/api goes through this. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw friendlyError(res.error);
  return res.data as T;
}

/** For queries where "no rows" is a normal answer. */
export const unwrapList = <T>(res: { data: T[] | null; error: PostgrestError | null }): T[] => unwrap(res) ?? [];

export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
