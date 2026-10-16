import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { supabase } from "@/lib/supabase";
import { clip, fmtDate, inr, localDay } from "@/lib/format";

// The bell in the top bar. Nothing is stored for it in the database: the list is worked out from what is already there
// (what visitors sent, what is waiting for an admin, reminders, what other admins changed).

const DAY = 864e5;

export type NotificationKind =
  | "message"
  | "volunteer"
  | "request"
  | "donationPending"
  | "donation"
  | "subscriber"
  | "eventSoon"
  | "eventDraft"
  | "blogDraft"
  | "activity";
export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  sub: string;
  at: string;
  when?: string;
}

/** [dot colour, page the notification opens] */
export const KINDS: Record<NotificationKind, [string, string]> = {
  message: ["new", "/messages"],
  volunteer: ["new", "/volunteers?tab=volunteers"],
  request: ["new", "/requests"],
  donationPending: ["warn", "/donations"],
  donation: ["ok", "/donations"],
  subscriber: ["ok", "/subscribers"],
  eventSoon: ["info", "/events"],
  eventDraft: ["warn", "/events"],
  blogDraft: ["warn", "/blog"],
  activity: ["info", "/admins"]
};

type Row = Record<string, any>;
/** A source that fails (a table not set up yet, no permission) just adds nothing: the other notifications still show. */
async function rows(query: PromiseLike<{ data: any; error: unknown }> | PostgrestFilterBuilder<any, any, any, any, any>): Promise<Row[]> {
  try {
    const { data, error } = (await query) as { data: Row[] | null; error: unknown };
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

/** Every notification for this admin, newest first. */
export async function getNotifications(me: { id: string } | null): Promise<Notification[]> {
  const now = new Date();
  const today = localDay(now);
  const week = localDay(new Date(now.getTime() + 7 * DAY));
  const tomorrow = localDay(new Date(now.getTime() + DAY));
  const since = new Date(now.getTime() - 14 * DAY).toISOString();
  const [messages, volunteers, requests, pending, donations, subscribers, soon, eventDrafts, blogDrafts, activity] = await Promise.all([
    rows(
      supabase
        .from("form_submissions")
        .select("id, created_at, name, email, message")
        .eq("kind", "contact")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(20)
    ),
    rows(
      supabase
        .from("volunteers")
        .select("id, created_at, name, area")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20)
    ),
    rows(
      supabase
        .from("document_requests")
        .select("id, created_at, reference, name, document_type")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(20)
    ),
    rows(
      supabase
        .from("donations")
        .select("id, created_at, amount, donor_name")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20)
    ),
    rows(
      supabase
        .from("donations")
        .select("id, created_at, amount, donor_name, mode")
        .eq("status", "success")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(15)
    ),
    rows(
      supabase
        .from("newsletter_subscribers")
        .select("id, email, subscribed_at")
        .eq("status", "active")
        .gte("subscribed_at", since)
        .order("subscribed_at", { ascending: false })
        .limit(15)
    ),
    rows(
      supabase
        .from("events")
        .select("id, title, event_date, place")
        .eq("published", true)
        .gte("event_date", today)
        .lte("event_date", week)
        .order("event_date")
    ),
    rows(
      supabase
        .from("events")
        .select("id, title, event_date, updated_at")
        .eq("published", false)
        .gte("event_date", today)
        .order("event_date")
        .limit(15)
    ),
    rows(
      supabase.from("blog_posts").select("id, title, updated_at").eq("published", false).order("updated_at", { ascending: false }).limit(15)
    ),
    me?.id
      ? rows(
          supabase
            .from("activity_log")
            .select("id, created_at, admin_label, summary")
            .not("admin_id", "is", null)
            .neq("admin_id", me.id)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(15)
        )
      : Promise.resolve([] as Row[])
  ]);
  const join = (...parts: unknown[]) => parts.filter(Boolean).join(" · ");
  const list: Notification[] = [
    ...messages.map((m) => ({
      id: `message:${m.id}`,
      kind: "message" as const,
      title: "New contact message",
      sub: join(m.name || m.email, clip(m.message, 70)),
      at: m.created_at
    })),
    ...volunteers.map((v) => ({
      id: `volunteer:${v.id}`,
      kind: "volunteer" as const,
      title: "Volunteer sign-up awaiting approval",
      sub: join(v.name, v.area),
      at: v.created_at
    })),
    ...requests.map((r) => ({
      id: `request:${r.id}`,
      kind: "request" as const,
      title: "New document request",
      sub: join(r.reference, r.name, r.document_type),
      at: r.created_at
    })),
    ...pending.map((d) => ({
      id: `donation-pending:${d.id}`,
      kind: "donationPending" as const,
      title: "Donation waiting for confirmation",
      sub: join(inr(d.amount), d.donor_name),
      at: d.created_at
    })),
    ...donations.map((d) => ({
      id: `donation:${d.id}`,
      kind: "donation" as const,
      title: "Donation received",
      sub: join(inr(d.amount), d.donor_name, d.mode),
      at: d.created_at
    })),
    ...subscribers.map((s) => ({
      id: `subscriber:${s.id}`,
      kind: "subscriber" as const,
      title: "New newsletter subscriber",
      sub: s.email,
      at: s.subscribed_at
    })),
    // a reminder comes back as the day gets nearer: this week → tomorrow → today
    ...soon.map((e) => {
      const step = e.event_date === today ? "today" : e.event_date === tomorrow ? "tomorrow" : "week";
      return {
        id: `event-${step}:${e.id}`,
        kind: "eventSoon" as const,
        title: step === "today" ? "Event today" : step === "tomorrow" ? "Event tomorrow" : "Event this week",
        sub: join(e.title, fmtDate(e.event_date), e.place),
        at: now.toISOString(),
        when: fmtDate(e.event_date)
      };
    }),
    ...eventDrafts.map((e) => ({
      id: `event-draft:${e.id}`,
      kind: "eventDraft" as const,
      title: "Draft event not published yet",
      sub: join(e.title, fmtDate(e.event_date)),
      at: e.updated_at
    })),
    ...blogDrafts.map((p) => ({
      id: `blog-draft:${p.id}`,
      kind: "blogDraft" as const,
      title: "Draft post not published yet",
      sub: p.title,
      at: p.updated_at
    })),
    ...activity.map((a) => ({
      id: `activity:${a.id}`,
      kind: "activity" as const,
      title: "Change by another admin",
      sub: join(a.admin_label, clip(a.summary, 110)),
      at: a.created_at
    }))
  ];
  return list.filter((n) => n.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Which notifications this admin has read: remembered on this device only. */
export function readStore(meId?: string) {
  const key = `admin-notif-read:${meId || "admin"}`;
  const set = new Set<string>();
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(saved)) saved.forEach((x) => set.add(String(x)));
  } catch {
    // storage blocked: nothing is remembered
  }
  return {
    has: (id: string) => set.has(id),
    add(ids: string[]) {
      ids.forEach((id) => set.add(id));
      try {
        localStorage.setItem(key, JSON.stringify([...set].slice(-800)));
      } catch {
        // not remembered
      }
    }
  };
}
