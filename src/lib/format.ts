export const inr = (n: number | string | null | undefined): string =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const num = (v: number | string | null | undefined): string => Number(v || 0).toLocaleString("en-IN");

export const fmtDate = (d?: string | null): string =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
export const fmtDateTime = (d?: string | null): string =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export function timeAgo(d?: string | null): string {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

export const monthKey = (d?: string | null): string => String(d || "").slice(0, 7);
export const monthLabel = (m: string, long?: boolean): string =>
  new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", long ? { month: "long", year: "numeric" } : { month: "short" });

/** Local date as YYYY-MM-DD (not UTC, so "today" is the person's own day). */
export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Local date and time as "2026-10-05 12:30" (Excel exports, file names). */
export const stamp = (d: string | Date): string => {
  const x = new Date(d);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

export const clip = (s: string | null | undefined, n: number): string => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};

/** "A Mat, a Slate…" → "a-mat-a-slate" (the last part of a blog post's web address). */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");

export const distinct = (rows: Record<string, any>[], key: string): string[] =>
  [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort() as string[];
