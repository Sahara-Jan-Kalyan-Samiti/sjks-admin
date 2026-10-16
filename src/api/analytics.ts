import { supabase } from "@/lib/supabase";
import { monthKey } from "@/lib/format";
import type { RequestStatus } from "@/types";
import { getActivityLog } from "./people";
import { getSiteStats } from "./content";
import { websitePortfolio } from "./projects";

// ---------- small helpers ----------
export function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
type Rec = Record<string, any>;
const keyOf = (r: Rec, key: string | ((r: Rec) => string)) => (typeof key === "function" ? key(r) : r[key]) || "Not set";
export const countBy = (rows: Rec[], key: string | ((r: Rec) => string)): Record<string, number> =>
  rows.reduce<Record<string, number>>((m, r) => ((m[keyOf(r, key)] = (m[keyOf(r, key)] || 0) + 1), m), {});
export const sumBy = (rows: Rec[], key: string | ((r: Rec) => string), val: (r: Rec) => number): Record<string, number> =>
  rows.reduce<Record<string, number>>((m, r) => ((m[keyOf(r, key)] = (m[keyOf(r, key)] || 0) + val(r)), m), {});
export const sumAmount = (rows: Rec[]): number => rows.reduce((s, d) => s + Number(d.amount), 0);
export const requestStatus = (s: string): RequestStatus => (["sent", "completed"].includes(s) ? (s as RequestStatus) : "new");
const top = (obj: Record<string, number>, n = 8) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
const tally = (rows: Rec[], key: string | ((r: Rec) => string), keys: string[]): Record<string, number> =>
  Object.fromEntries(keys.map((k) => [k, rows.filter((r) => (typeof key === "function" ? key(r) : r[key]) === k).length]));

interface All {
  donations: Rec[];
  projects: Rec[];
  volunteers: Rec[];
  requests: Rec[];
  events: Rec[];
}
async function loadAll(): Promise<All> {
  const [don, proj, vol, req, ev] = await Promise.all([
    supabase
      .from("donations")
      .select("id, created_at, amount, status, mode, method, currency, donated_at, donor_name, donor_email, purpose"),
    supabase.from("projects").select("id, created_at, name, area, status, beneficiaries, published"),
    supabase.from("volunteers").select("id, created_at, name, area, status"),
    supabase.from("document_requests").select("id, created_at, reference, name, organisation, request_type, document_type, status"),
    supabase.from("events").select("id, created_at, title, event_date, published")
  ]);
  return {
    donations: don.data ?? [],
    projects: proj.data ?? [],
    volunteers: vol.data ?? [],
    requests: req.data ?? [],
    events: ev.data ?? []
  };
}

export interface MonthRow {
  month: string;
  raised: number;
  donations: number;
  volunteers: number;
  requests: number;
  projects: number;
}
function monthly(all: All, months: string[]): MonthRow[] {
  const ok = all.donations.filter((d) => d.status === "success" && d.currency === "INR");
  return months.map((m) => {
    const dm = ok.filter((d) => monthKey(d.donated_at) === m);
    return {
      month: m,
      raised: sumAmount(dm),
      donations: dm.length,
      volunteers: all.volunteers.filter((v) => monthKey(v.created_at) === m).length,
      requests: all.requests.filter((r) => monthKey(r.created_at) === m).length,
      projects: all.projects.filter((p) => monthKey(p.created_at) === m).length
    };
  });
}

export interface RecentItem {
  type: "donation" | "volunteer" | "request";
  at: string;
  title: string;
  sub: string;
  status: string;
  page: string;
}
function recentSubmissions(all: All, limit = 10): RecentItem[] {
  const items: RecentItem[] = [
    ...all.donations.map((d) => ({
      type: "donation" as const,
      at: d.created_at,
      title: `Donation ₹${Number(d.amount).toLocaleString("en-IN")}`,
      sub: `${d.donor_name || "Unknown donor"} · ${d.mode}${d.method ? " · " + d.method : ""}`,
      status: d.status,
      page: "donations"
    })),
    ...all.volunteers.map((v) => ({
      type: "volunteer" as const,
      at: v.created_at,
      title: `Volunteer: ${v.name || "Unnamed"}`,
      sub: v.area || "Volunteer sign-up",
      status: v.status,
      page: "volunteers?tab=volunteers"
    })),
    ...all.requests.map((r) => ({
      type: "request" as const,
      at: r.created_at,
      title: `Request ${r.reference || "#" + r.id}`,
      sub: [r.name, r.document_type].filter(Boolean).join(" · "),
      status: requestStatus(r.status),
      page: "requests"
    }))
  ];
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

// ---------- dashboard ----------
export async function getDashboardData() {
  const all = await loadAll();
  const { donations, projects, volunteers: vols, requests: reqs, events } = all;
  const ok = donations.filter((d) => d.status === "success" && d.currency === "INR");
  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const added = projects.reduce((s, p) => s + (p.beneficiaries || 0), 0);
  const [adminsCount, activity, stats] = await Promise.all([
    supabase.from("admin_profiles").select("id", { count: "exact", head: true }),
    getActivityLog(8),
    getSiteStats().catch(() => [])
  ]);
  const site = websitePortfolio;
  return {
    funds: {
      total: sumAmount(ok),
      online: sumAmount(ok.filter((d) => d.mode === "online")),
      offline: sumAmount(ok.filter((d) => d.mode === "offline")),
      thisMonth: sumAmount(ok.filter((d) => (d.donated_at || "").startsWith(month))),
      pending: donations.filter((d) => d.status === "pending").length
    },
    ongoingProjects: {
      website: site.filter((p) => p.status === "ongoing").length,
      added: projects.filter((p) => p.status === "ongoing").length
    },
    reach: { website: Number(stats[0]?.value) || 0, added },
    pendingRequests: reqs.filter((r) => requestStatus(r.status) === "new").length,
    counts: {
      admins: adminsCount.count || 0,
      donations: {
        records: donations.length,
        ...tally(donations, "status", ["success", "pending", "failed", "refunded", "cancelled"])
      } as Record<string, number>,
      projects: {
        added: { total: projects.length, ...tally(projects, "status", ["planned", "ongoing", "completed"]) } as Record<string, number>,
        website: { total: site.length, ...tally(site, "status", ["ongoing", "completed", "not dated"]) } as Record<string, number>
      },
      volunteers: { total: vols.length, ...tally(vols, "status", ["active", "pending", "inactive"]) } as Record<string, number>,
      requests: { total: reqs.length, ...tally(reqs, (r) => requestStatus(r.status), ["new", "sent", "completed"]) } as Record<
        string,
        number
      >,
      events: {
        total: events.length,
        upcoming: events.filter((e) => e.event_date >= today).length,
        published: events.filter((e) => e.published).length
      }
    },
    months: monthly(all, lastMonths(12)),
    recent: recentSubmissions(all, 8),
    activity
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

// ---------- analytics ----------
export async function getReports(months = 12) {
  const n = Math.min(36, Math.max(3, Number(months) || 12));
  const all = await loadAll();
  const monthsArr = lastMonths(n);
  const from = monthsArr[0];
  const prevMonths = lastMonths(n * 2).slice(0, n);
  const inRange = (d: string, list: string[]) => list.includes(monthKey(d));
  const ok = all.donations.filter((d) => d.status === "success" && d.currency === "INR");
  const okNow = ok.filter((d) => inRange(d.donated_at, monthsArr));
  const okPrev = ok.filter((d) => inRange(d.donated_at, prevMonths));
  const donors = new Set(okNow.map((d) => (d.donor_email || d.donor_name || "").toLowerCase()).filter(Boolean));
  const volsNow = all.volunteers.filter((v) => inRange(v.created_at, monthsArr));
  const reqsNow = all.requests.filter((r) => inRange(r.created_at, monthsArr));
  const amount = (d: Rec) => Number(d.amount);
  return {
    months: n,
    from,
    totals: {
      raised: sumAmount(okNow),
      raisedPrev: sumAmount(okPrev),
      donations: okNow.length,
      donors: donors.size,
      average: okNow.length ? sumAmount(okNow) / okNow.length : 0,
      volunteers: volsNow.length,
      volunteersPrev: all.volunteers.filter((v) => inRange(v.created_at, prevMonths)).length,
      requests: reqsNow.length
    },
    series: monthly(all, monthsArr),
    donations: {
      byMode: top(sumBy(okNow, "mode", amount)),
      byMethod: top(sumBy(okNow, "method", amount)),
      byPurpose: top(sumBy(okNow, "purpose", amount)),
      byStatus: top(
        countBy(
          all.donations.filter((d) => inRange(d.donated_at, monthsArr)),
          "status"
        )
      )
    },
    volunteers: { byStatus: top(countBy(all.volunteers, "status")), byArea: top(countBy(all.volunteers, "area")) },
    requests: {
      byStatus: top(countBy(all.requests, (r) => ({ new: "pending", sent: "sent", completed: "completed" })[requestStatus(r.status)])),
      byType: top(countBy(reqsNow, "document_type"))
    },
    projects: {
      byStatus: top(countBy(all.projects, "status")),
      byArea: top(countBy(all.projects, "area")),
      website: top(countBy(websitePortfolio, "status"))
    }
  };
}
export type ReportData = Awaited<ReturnType<typeof getReports>>;
