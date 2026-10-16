import { useState } from "react";
import { createTeamMember, deleteTeamMember, getTeamMembers, updateTeamMember } from "@/api/people";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, Field, Select } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import type { TeamMember } from "@/types";
import { ManagerField } from "./ManagerField";

// The two blocks of the website About Us page a person can be listed in.
const TEAMS: [string, string][] = [
  ["committee", "Executive Committee"],
  ["management", "Management Team"]
];
const teamLabel = (k: string) => (TEAMS.find(([v]) => v === k) || [k, k])[1];

export function TeamForm({
  member,
  all,
  onClose,
  onSaved
}: {
  member?: TeamMember;
  all: TeamMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const r = member;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [under, setUnder] = useState<string | null>(r?.reports_to ?? null);
  const f = useForm({
    team: r?.team ?? "committee",
    name: r?.name ?? "",
    post: r?.post ?? "",
    role: r?.role ?? "",
    sort_order: r ? String(r.sort_order) : "",
    published: r ? !!r.published : true
  });
  // a new person goes to the end of the chosen block
  const nextOrder = (team: string) => Math.max(0, ...all.filter((x) => x.team === team).map((x) => x.sort_order)) + 10;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        name: rules.required("Name", 120),
        post: rules.required("Post", 120),
        role: rules.max("Description", 400),
        sort_order: rules.wholeNumber("Position")
      })
    )
      return;
    const v = f.values;
    const body: Record<string, unknown> = {
      team: v.team,
      name: v.name.trim(),
      post: v.post.trim(),
      role: v.role.trim(),
      published: v.published,
      sort_order: v.sort_order.trim() === "" ? nextOrder(v.team) : Number(v.sort_order)
    };
    if (under !== (r?.reports_to ?? null)) body.reports_to = under; // only sent when it changes
    try {
      await run(() => (r ? updateTeamMember(r.id, body) : createTeamMember(body)));
      toast(r ? "Saved." : `${body.name} added to the ${teamLabel(String(body.team))}.`);
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  async function remove() {
    if (
      !r ||
      !(await confirm({
        title: "Remove team member?",
        text: `${r.name} will be removed from the website. This cannot be undone.`,
        ok: "Remove",
        danger: true
      }))
    )
      return;
    try {
      await deleteTeamMember(r.id);
      toast("Team member removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r ? "Edit team member" : "Add team member"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="Shown under *">
          <Select {...f.field("team")} options={TEAMS} />
        </Field>
        <Field label="Name *" error={f.errors.name}>
          <input {...f.field("name")} required maxLength={120} placeholder="e.g. Smt. Sunita Jain" />
        </Field>
        <Field label="Post *" error={f.errors.post}>
          <input {...f.field("post")} required maxLength={120} placeholder="e.g. Vice President" />
        </Field>
        <Field label="Description (optional; shown on Management Team cards; up to 400 characters)" error={f.errors.role}>
          <textarea {...f.field("role")} rows={3} maxLength={400} />
        </Field>
        <Field label="Position in the list (lower numbers come first; leave empty to add at the end)" error={f.errors.sort_order}>
          <input {...f.field("sort_order")} inputMode="numeric" />
        </Field>
        <ManagerField selfKey={r ? `team:${r.id}` : null} saved={r?.reports_to ?? null} value={under} onChange={setUnder} />
        <Check {...f.check("published")}>Published (visible on the website)</Check>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Remove team member
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {r ? "Save changes" : "Add team member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type Row = TeamMember & { n: number };

/** The "Team" tab of the Team & Volunteers page. */
export function TeamTab() {
  const { rows, loading, error, reload } = useList("team_members", getTeamMembers);
  const [form, setForm] = useState<TeamMember | "new" | null>(null);
  const numbered: Row[] = rows.map((r, i) => ({ ...r, n: i + 1 }));
  return (
    <div>
      <p className="mut">
        The people shown on the website About Us page under “Our Executive Committee” and “Management Team”, in this order. Click a row to
        edit or remove it.
      </p>
      <DataTable<Row>
        rows={numbered}
        loading={loading}
        error={error}
        columns={[
          { label: "Order", cell: (r) => r.n, sort: (r) => r.n, cls: "num" },
          {
            label: "Name",
            cell: (r) => (
              <div>
                <b>{r.name}</b>
                {r.role ? <div className="mut">{r.role.length > 120 ? r.role.slice(0, 120) + "…" : r.role}</div> : null}
              </div>
            ),
            sort: (r) => (r.name || "").toLowerCase()
          },
          { label: "Post", cell: (r) => r.post, sort: (r) => (r.post || "").toLowerCase() },
          { label: "Shown under", cell: (r) => teamLabel(r.team), sort: (r) => r.team },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.name, r.post, r.role].join(" ")}
        searchLabel="Search name or post"
        filters={[
          { label: "Shown under", options: TEAMS, test: (r, x) => r.team === x },
          {
            label: "Status",
            options: [
              ["published", "Published"],
              ["hidden", "Hidden"]
            ],
            test: (r, x) => (x === "published") === !!r.published
          }
        ]}
        sort={{ i: 0, dir: "asc" }}
        pageSize={25}
        onRow={setForm}
        summary={(list) => <p className="mut">{TEAMS.map(([v, l]) => `${list.filter((r) => r.team === v).length} in ${l}`).join(" · ")}</p>}
        empty="No team members yet. Add one and it appears on the website under About Us → Our Executive Committee."
        tools={<button onClick={() => setForm("new")}>+ Add team member</button>}
      />
      {form && <TeamForm member={form === "new" ? undefined : form} all={rows} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
