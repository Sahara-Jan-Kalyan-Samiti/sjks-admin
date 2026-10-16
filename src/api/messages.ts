import { supabase } from "@/lib/supabase";
import { friendlyError, unwrap } from "@/lib/errors";
import type { ContactMessage, ContactStatus, Subscriber } from "@/types";

const CHUNK = 1000;

// ---------- contact messages (table form_submissions, kind "contact") ----------
export interface PageQuery {
  q?: string;
  status?: string;
  page?: number;
  size?: number;
}

const contactQuery = ({ q, status }: PageQuery, cols: string, opts?: { count: "exact" }) => {
  let query = supabase.from("form_submissions").select(cols, opts).eq("kind", "contact");
  if (status) query = query.eq("status", status);
  if (q) {
    // escaped twice: once for LIKE (% _ \), once for the quoted value inside or(...)
    const like = `"%${q.replace(/[\\%_]/g, "\\$&").replace(/[\\"]/g, "\\$&")}%"`;
    query = query.or(["name", "email", "phone", "message"].map((col) => `${col}.ilike.${like}`).join(","));
  }
  return query.order("created_at", { ascending: false }).order("id", { ascending: false });
};

export async function getContactMessages(limit = 8): Promise<{ rows: ContactMessage[]; total: number }> {
  const { data, error, count } = await supabase
    .from("form_submissions")
    .select("id, created_at, name, email, phone, message, status", { count: "exact" })
    .eq("kind", "contact")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw friendlyError(error);
  return { rows: (data ?? []) as ContactMessage[], total: count || 0 };
}

export async function getContactMessagesPage({ q = "", status = "", page = 1, size = 25 }: PageQuery = {}): Promise<{
  rows: ContactMessage[];
  total: number;
}> {
  const { data, error, count } = await contactQuery({ q, status }, "id, created_at, name, email, phone, message, status", {
    count: "exact"
  }).range((page - 1) * size, page * size - 1);
  if (error?.code === "PGRST103") return { rows: [], total: 0 }; // asked for a page past the last one
  if (error) throw friendlyError(error);
  return { rows: (data ?? []) as unknown as ContactMessage[], total: count || 0 };
}

export async function getContactMessageCounts() {
  const count = () => supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("kind", "contact");
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const res = await Promise.all([
    count(),
    count().eq("status", "new"),
    count().eq("status", "contacted"),
    count().gte("created_at", since)
  ]);
  const failed = res.find((r) => r.error);
  if (failed?.error) throw friendlyError(failed.error);
  const [total, waiting, contacted, recent] = res.map((r) => r.count || 0);
  return { total, waiting, contacted, recent };
}

/** Every contact message matching the search and filter (for the Excel export), fetched 1,000 at a time. */
export async function getAllContactMessages(filter: PageQuery = {}): Promise<ContactMessage[]> {
  const all: ContactMessage[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await contactQuery(filter, "created_at, name, email, phone, message, status").range(from, from + CHUNK - 1);
    if (error) throw friendlyError(error);
    all.push(...((data ?? []) as unknown as ContactMessage[]));
    if (!data || data.length < CHUNK) return all;
  }
}

export async function deleteContactMessage(id: number): Promise<void> {
  const { data, error } = await supabase.from("form_submissions").delete().eq("id", id).eq("kind", "contact").select("id");
  if (error) throw friendlyError(error);
  // nothing came back = the database did not let this admin delete it (the delete rule is missing)
  if (!data?.length)
    throw new Error("The message could not be deleted. Apply the latest migrations from the sjks-database repository, then try again.");
}
export async function setContactMessageStatus(id: number, status: ContactStatus): Promise<void> {
  unwrap(await supabase.from("form_submissions").update({ status }).eq("id", id).eq("kind", "contact"));
}

// ---------- newsletter subscribers ----------
const subscriberQuery = ({ q, status }: PageQuery, cols: string, opts?: { count: "exact" }) => {
  let query = supabase.from("newsletter_subscribers").select(cols, opts);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("email", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  return query.order("subscribed_at", { ascending: false }).order("id", { ascending: false });
};

export async function getSubscribers({ q = "", status = "", page = 1, size = 25 }: PageQuery = {}): Promise<{
  rows: Subscriber[];
  total: number;
}> {
  const { data, error, count } = await subscriberQuery({ q, status }, "id, email, status, source, subscribed_at", { count: "exact" }).range(
    (page - 1) * size,
    page * size - 1
  );
  if (error?.code === "PGRST103") return { rows: [], total: 0 };
  if (error) throw friendlyError(error);
  return { rows: (data ?? []) as unknown as Subscriber[], total: count || 0 };
}
export async function getAllSubscribers(filter: PageQuery = {}): Promise<Subscriber[]> {
  const out: Subscriber[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await subscriberQuery(filter, "email, status, source, subscribed_at").range(from, from + CHUNK - 1);
    if (error) throw friendlyError(error);
    out.push(...((data ?? []) as unknown as Subscriber[]));
    if (!data || data.length < CHUNK) return out;
  }
}
export async function getSubscriberCounts() {
  const count = () => supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true });
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const res = await Promise.all([
    count(),
    count().eq("status", "active"),
    count().eq("status", "unsubscribed"),
    count().gte("subscribed_at", since)
  ]);
  const failed = res.find((r) => r.error);
  if (failed?.error) throw friendlyError(failed.error);
  const [total, active, unsubscribed, recent] = res.map((r) => r.count || 0);
  return { total, active, unsubscribed, recent };
}
export async function updateSubscriberStatus(id: number, status: Subscriber["status"]): Promise<void> {
  unwrap(await supabase.from("newsletter_subscribers").update({ status }).eq("id", id));
}
