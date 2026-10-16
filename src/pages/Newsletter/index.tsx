import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllSubscribers, getSubscriberCounts, getSubscribers, updateSubscriberStatus } from "@/api/messages";
import { ServerList } from "@/components/data-table/ServerList";
import { useToast } from "@/components/ui/feedback";
import { Button, PageHeader, StatCard, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { messageOf } from "@/lib/errors";
import { exportExcel, fileStamp } from "@/lib/export";
import { fmtDate, num, stamp } from "@/lib/format";
import type { Subscriber } from "@/types";

const STATUS: Record<string, string> = { active: "Active", unsubscribed: "Unsubscribed" };
// "website-footer" → "Website Footer"
const sourceLabel = (s: string | null) =>
  String(s || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ") || "—";

function StatusButton({ row, onChanged }: { row: Subscriber; onChanged: () => void }) {
  const toast = useToast();
  const [busy, run] = useBusy();
  const to = row.status === "active" ? "unsubscribed" : "active";
  return (
    <Button
      type="button"
      className={to === "active" ? "sm" : "ghost sm"}
      busy={busy}
      onClick={() =>
        run(async () => {
          await updateSubscriberStatus(row.id, to);
          toast(`${row.email} is now ${STATUS[to].toLowerCase()}.`);
          onChanged();
        }).catch((e) => toast(messageOf(e), "err"))
      }
    >
      {to === "active" ? "Reactivate" : "Unsubscribe"}
    </Button>
  );
}

export default function Newsletter() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, run] = useBusy();
  const counts = useQuery({ queryKey: ["subscriber-counts"], queryFn: getSubscriberCounts });
  const c = counts.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["subscribers"] });
    qc.invalidateQueries({ queryKey: ["subscriber-counts"] });
  };

  async function exportAll(filter: { q: string; status: string }) {
    const rows = await getAllSubscribers(filter);
    if (!rows.length) return toast("There are no subscribers to export.", "err");
    await exportExcel({
      sheet: "Subscribers",
      fileName: `newsletter-subscribers-${fileStamp()}.xlsx`,
      head: ["Email", "Status", "Subscribed Date", "Source"],
      rows: rows.map((r) => [r.email, STATUS[r.status] || r.status, stamp(r.subscribed_at), sourceLabel(r.source)]),
      widths: [38, 16, 20, 20]
    });
    toast(`Exported ${rows.length} subscriber(s).`);
  }

  return (
    <div>
      <PageHeader title="Newsletter Subscribers">
        Emails from the “Field Updates Newsletter” form in the website footer. Unsubscribed emails are kept on record instead of being
        deleted.
      </PageHeader>
      <div className="cards">
        <StatCard label="Total subscribers" value={num(c?.total)} sub="Everyone who has signed up" />
        <StatCard label="Active subscribers" value={num(c?.active)} sub="Receiving updates" />
        <StatCard label="Unsubscribed" value={num(c?.unsubscribed)} sub="Kept on record, not contacted" />
        <StatCard label="New subscribers" value={num(c?.recent)} sub="Subscribed in the last 30 days" />
      </div>
      <ServerList<Subscriber>
        queryKey="subscribers"
        load={getSubscribers}
        searchLabel="Search subscribers by email"
        searchPlaceholder="Search subscribers…"
        statuses={Object.entries(STATUS)}
        headers={["Email", "Status", "Subscribed Date", "Source", ""]}
        empty="No subscribers yet. Sign-ups from the website footer appear here."
        emptyFiltered="No subscribers match these filters."
        tools={(filter) => (
          <Button
            className="ghost"
            busy={busy}
            busyText="Exporting…"
            onClick={() => run(() => exportAll(filter)).catch((e) => toast(messageOf(e), "err"))}
          >
            Export Excel
          </Button>
        )}
        row={(r) => (
          <>
            <td>
              <b>{r.email}</b>
            </td>
            <td>
              <Tag kind={r.status === "active" ? "active" : "inactive"}>{STATUS[r.status] || r.status}</Tag>
            </td>
            <td>{fmtDate(r.subscribed_at)}</td>
            <td>{sourceLabel(r.source)}</td>
            <td className="actions">
              <StatusButton row={r} onChanged={refresh} />
            </td>
          </>
        )}
      />
    </div>
  );
}
