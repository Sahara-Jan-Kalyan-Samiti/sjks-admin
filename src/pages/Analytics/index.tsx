import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getReports } from "@/api/analytics";
import { DataTable } from "@/components/data-table/DataTable";
import { BarChart, StatBars } from "@/components/ui/charts";
import { Msg, PageHeader, Panel, Spinner, StatCard } from "@/components/ui/primitives";
import { downloadText, toCsv } from "@/lib/export";
import { inr, monthLabel } from "@/lib/format";
import { messageOf } from "@/lib/errors";

const short = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${Math.round(v)}`);
const change = (now: number, prev: number) =>
  !prev
    ? now
      ? "new this period"
      : "no change"
    : `${now >= prev ? "▲" : "▼"} ${Math.abs(Math.round(((now - prev) / prev) * 100))}% vs previous period`;
const PERIODS: [number, string][] = [
  [3, "Last 3 months"],
  [6, "Last 6 months"],
  [12, "Last 12 months"],
  [24, "Last 24 months"]
];

export default function Analytics() {
  const [months, setMonths] = useState(12);
  const { data: r, isLoading, error } = useQuery({ queryKey: ["reports", months], queryFn: () => getReports(months) });

  return (
    <div>
      <PageHeader
        title="Analytics"
        actions={
          <label className="dt-f">
            Period
            <select aria-label="Period" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {PERIODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        }
      >
        Calculated live from the database.
      </PageHeader>
      {isLoading ? <Spinner text="Calculating…" /> : error || !r ? <Msg kind="err">{messageOf(error)}</Msg> : <Body r={r} />}
    </div>
  );
}

function Body({ r }: { r: NonNullable<Awaited<ReturnType<typeof getReports>>> }) {
  const t = r.totals;
  const series = (key: "raised" | "donations" | "volunteers" | "requests") =>
    r.series.map((m) => ({ label: monthLabel(m.month), title: monthLabel(m.month, true), value: m[key] }));
  const bars = (list: { label: string; value: number }[], money?: boolean) => <StatBars items={list} format={money ? inr : String} />;
  const csv = () =>
    downloadText(
      toCsv([
        ["Month", "Raised (INR)", "Donations", "Volunteer sign-ups", "Document requests", "Projects added"],
        ...r.series.map((m) => [m.month, m.raised, m.donations, m.volunteers, m.requests, m.projects])
      ]),
      `monthly-statistics-${r.from}.csv`
    );

  return (
    <>
      <div className="cards">
        <StatCard label="Raised" value={inr(t.raised)} sub={change(t.raised, t.raisedPrev)} />
        <StatCard label="Successful donations" value={t.donations} sub={`${t.donors} unique donor(s)`} />
        <StatCard label="Average donation" value={inr(Math.round(t.average))} sub="Per successful donation" />
        <StatCard label="New volunteers" value={t.volunteers} sub={change(t.volunteers, t.volunteersPrev)} />
        <StatCard label="Document requests" value={t.requests} sub="Received in this period" />
      </div>
      <div className="grid-2">
        <Panel title="Donations raised per month">
          <BarChart data={series("raised")} format={short} emptyText="No successful donations in this period." />
        </Panel>
        <Panel title="Number of donations per month">
          <BarChart data={series("donations")} emptyText="No successful donations in this period." />
        </Panel>
        <Panel title="Volunteer sign-ups per month">
          <BarChart data={series("volunteers")} emptyText="No volunteer sign-ups in this period." />
        </Panel>
        <Panel title="Document requests per month">
          <BarChart data={series("requests")} emptyText="No document requests in this period." />
        </Panel>
      </div>
      <div className="grid-3">
        <Panel title="Raised by payment mode">{bars(r.donations.byMode, true)}</Panel>
        <Panel title="Raised by payment method">{bars(r.donations.byMethod, true)}</Panel>
        <Panel title="Raised by purpose / campaign">{bars(r.donations.byPurpose, true)}</Panel>
        <Panel title="Donation records by status">{bars(r.donations.byStatus)}</Panel>
        <Panel title="Volunteers by status (all time)">{bars(r.volunteers.byStatus)}</Panel>
        <Panel title="Volunteers by area of interest (all time)">{bars(r.volunteers.byArea)}</Panel>
        <Panel title="Projects added in admin, by status">{bars(r.projects.byStatus)}</Panel>
        <Panel title="Website portfolio, by status">{bars(r.projects.website)}</Panel>
        <Panel title="Document requests by status (all time)">{bars(r.requests.byStatus)}</Panel>
      </div>
      <h2 className="sec">Monthly statistics</h2>
      <DataTable
        rows={r.series}
        rowKey={(m) => m.month}
        columns={[
          { label: "Month", cell: (m) => monthLabel(m.month, true), sort: (m) => m.month, firstDir: "desc" },
          { label: "Raised", cell: (m) => inr(m.raised), sort: (m) => m.raised, cls: "num", firstDir: "desc" },
          { label: "Donations", cell: (m) => m.donations, sort: (m) => m.donations, cls: "num", firstDir: "desc" },
          { label: "Volunteer sign-ups", cell: (m) => m.volunteers, sort: (m) => m.volunteers, cls: "num", firstDir: "desc" },
          { label: "Document requests", cell: (m) => m.requests, sort: (m) => m.requests, cls: "num", firstDir: "desc" },
          { label: "Projects added", cell: (m) => m.projects, sort: (m) => m.projects, cls: "num", firstDir: "desc" }
        ]}
        sort={{ i: 0, dir: "desc" }}
        pageSize={12}
        summary={(rows) => (
          <p className="mut">{`Totals: ${inr(rows.reduce((s, m) => s + m.raised, 0))} raised · ${rows.reduce((s, m) => s + m.donations, 0)} donations · ${rows.reduce((s, m) => s + m.volunteers, 0)} sign-ups · ${rows.reduce((s, m) => s + m.requests, 0)} requests`}</p>
        )}
        tools={
          <button className="ghost" onClick={csv}>
            Download CSV
          </button>
        }
      />
      <p className="mut">{`Period: ${monthLabel(r.from, true)} to today. Money figures count successful INR donations by donation date.`}</p>
    </>
  );
}
