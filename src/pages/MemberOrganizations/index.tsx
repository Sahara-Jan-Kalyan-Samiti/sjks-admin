import { useState } from "react";
import { createMemberOrganization, deleteMemberOrganization, getMemberOrganizations, updateMemberOrganization } from "@/api/content";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, Field, Select } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { MemberOrganization } from "@/types";

// Same choices as the application form on the website.
const ORG_TYPES = ["Trust", "Society", "Section 8 Company", "Other"];
const FOCUS_AREAS = ["Healthcare", "Education", "Women Empowerment", "Child Welfare", "Community Development", "Environment", "Other"];
const STATUSES: [string, string][] = [
  ["pending", "Waiting for approval"],
  ["approved", "Approved"],
  ["rejected", "Rejected"]
];
const statusTag = (s: string) => (
  <Tag kind={s === "approved" ? "active" : s === "rejected" ? "failed" : "pending"}>
    {(STATUSES.find(([v]) => v === s) || STATUSES[1])[1]}
  </Tag>
);
const order = (s: string) => STATUSES.findIndex(([v]) => v === s);

/** Approve (the organisation is then listed on the website) or reject an application. */
function useDecide(reload: () => void) {
  const confirm = useConfirm();
  const toast = useToast();
  return async (r: MemberOrganization, status: "approved" | "rejected"): Promise<boolean> => {
    const approve = status === "approved";
    const ok = await confirm(
      approve
        ? {
            title: "Approve this organization?",
            text: `“${r.name}” becomes a member organization and is listed on the website (Membership → Memberships).`,
            ok: "Approve"
          }
        : {
            title: "Reject this application?",
            text: `“${r.name}” is not listed on the website. You can approve it later.`,
            ok: "Reject",
            danger: true
          }
    );
    if (!ok) return false;
    try {
      await updateMemberOrganization(r.id, { status });
      toast(approve ? "Approved. It now shows on the website." : "Application rejected.");
      reload();
      return true;
    } catch (e) {
      toast(messageOf(e), "err");
      return false;
    }
  };
}

function OrgForm({
  org,
  next,
  onClose,
  onSaved,
  decide
}: {
  org?: MemberOrganization;
  next: number;
  onClose: () => void;
  onSaved: () => void;
  decide: (r: MemberOrganization, s: "approved" | "rejected") => Promise<boolean>;
}) {
  const r = org;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [focus, setFocus] = useState<string[]>(r?.focus_areas ?? []);
  const f = useForm({
    name: r?.name ?? "",
    location: r?.location ?? "",
    sort_order: String(r?.sort_order ?? next),
    description: r?.description ?? "",
    org_type: r?.org_type ?? "",
    registration_no: r?.registration_no ?? "",
    year_founded: r?.year_founded != null ? String(r.year_founded) : "",
    website: r?.website ?? "",
    contact_name: r?.contact_name ?? "",
    contact_phone: r?.contact_phone ?? "",
    contact_email: r?.contact_email ?? "",
    admin_note: r?.admin_note ?? "",
    published: r ? !!r.published : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const ok = f.validate({
      name: rules.required("Name", 160),
      location: rules.max("Location", 120),
      description: rules.max("Description", 600),
      sort_order: rules.wholeNumber("Order"),
      registration_no: rules.max("Registration number", 60),
      year_founded: (v) => (v && !(/^\d{4}$/.test(v) && +v >= 1800 && +v <= 2100) ? "Enter a year, for example 2012" : null),
      website: (v) =>
        v && !/^https?:\/\/\S+\.\S+$/i.test(v)
          ? "Enter the full address, starting with https://"
          : v.length > 200
            ? "Website must be 200 characters or fewer"
            : null,
      contact_name: rules.max("Contact person", 80),
      contact_phone: rules.max("Phone", 20),
      contact_email: rules.all(rules.email, rules.max("Email", 120)),
      admin_note: rules.max("Note", 400)
    });
    if (!ok) return;
    const v = f.values;
    const body = {
      name: v.name.trim(),
      location: v.location.trim(),
      description: v.description.trim(),
      sort_order: Number(v.sort_order) || 0,
      published: v.published,
      org_type: v.org_type,
      registration_no: v.registration_no.trim(),
      year_founded: v.year_founded ? Number(v.year_founded) : null,
      website: v.website.trim(),
      focus_areas: focus,
      contact_name: v.contact_name.trim(),
      contact_phone: v.contact_phone.trim(),
      contact_email: v.contact_email.trim(),
      admin_note: v.admin_note.trim()
    };
    try {
      await run(() => (r ? updateMemberOrganization(r.id, body) : createMemberOrganization(body)));
      toast(r ? "Saved." : "Organization added. It now shows on the website.");
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
        title: "Remove organization?",
        text: `“${r.name}” will be removed for good. This cannot be undone.`,
        ok: "Remove",
        danger: true
      }))
    )
      return;
    try {
      await deleteMemberOrganization(r.id);
      toast("Organization removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r ? r.name : "Add organization"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        {r && (
          <p>
            {statusTag(r.status)} <span className="mut">{`Received ${fmtDateTime(r.created_at)}`}</span>
          </p>
        )}
        <h2>On the website card</h2>
        <Field label="Organization name *" error={f.errors.name}>
          <input {...f.field("name")} required maxLength={160} />
        </Field>
        <div className="grid2">
          <Field label="Location" error={f.errors.location}>
            <input {...f.field("location")} maxLength={120} placeholder="e.g. Sagar, Madhya Pradesh" />
          </Field>
          <Field label="Order on the page (lower comes first)" error={f.errors.sort_order}>
            <input {...f.field("sort_order")} type="number" min={0} step={1} inputMode="numeric" />
          </Field>
        </div>
        <Field label="What the organization does (up to 600 characters)" error={f.errors.description}>
          <textarea {...f.field("description")} rows={3} maxLength={600} />
        </Field>
        <h2>Details for our records (never shown on the website)</h2>
        <div className="grid2">
          <Field label="Type of organization">
            <Select {...f.field("org_type")} options={[["", "Not given"], ...ORG_TYPES]} />
          </Field>
          <Field label="Registration number" error={f.errors.registration_no}>
            <input {...f.field("registration_no")} maxLength={60} />
          </Field>
          <Field label="Year founded" error={f.errors.year_founded}>
            <input {...f.field("year_founded")} inputMode="numeric" maxLength={4} />
          </Field>
          <Field label="Website" error={f.errors.website}>
            <input {...f.field("website")} maxLength={200} placeholder="https://" />
          </Field>
        </div>
        <div>
          <span className="mut">Areas of work</span>
          <div className="row">
            {FOCUS_AREAS.map((a) => (
              <Check
                key={a}
                checked={focus.includes(a)}
                onChange={(e) => setFocus((l) => (e.target.checked ? [...l, a] : l.filter((x) => x !== a)))}
              >
                {a}
              </Check>
            ))}
          </div>
        </div>
        <div className="grid2">
          <Field label="Contact person" error={f.errors.contact_name}>
            <input {...f.field("contact_name")} maxLength={80} />
          </Field>
          <Field label="Phone" error={f.errors.contact_phone}>
            <input {...f.field("contact_phone")} maxLength={20} />
          </Field>
          <Field label="Email" error={f.errors.contact_email}>
            <input {...f.field("contact_email")} type="email" maxLength={120} />
          </Field>
        </div>
        <Field label="Note for admins" error={f.errors.admin_note}>
          <textarea {...f.field("admin_note")} rows={2} maxLength={400} />
        </Field>
        <Check {...f.check("published")}>Published (an approved organization is visible on the website)</Check>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Remove organization
            </button>
          )}
          <div className="grow" />
          {r && r.status !== "rejected" && (
            <button type="button" className="ghost" onClick={async () => (await decide(r, "rejected")) && onClose()}>
              Reject
            </button>
          )}
          {r && r.status !== "approved" && (
            <button type="button" className="ghost" onClick={async () => (await decide(r, "approved")) && onClose()}>
              Approve
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {r ? "Save changes" : "Add organization"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MemberOrganizations() {
  const { rows, loading, error, reload } = useList("member_organizations", getMemberOrganizations);
  const [form, setForm] = useState<MemberOrganization | "new" | null>(null);
  const decide = useDecide(reload);
  // a new one goes to the end of the page
  const next = rows.length ? Math.max(...rows.map((r) => r.sort_order || 0)) + 10 : 10;
  return (
    <div>
      <PageHeader title="Member Organizations">
        Organizations apply for membership on the website (Membership → Memberships). Check the details and approve: only then is the
        organization listed there. Click a row to see or correct everything. The headings and paragraphs of that page are under Website
        Pages → Memberships.
      </PageHeader>
      <DataTable<MemberOrganization>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          { label: "Order", cell: (r) => r.sort_order, sort: (r) => r.sort_order, cls: "num" },
          {
            label: "Organization",
            cell: (r) => (
              <div>
                <b>{r.name}</b>
                <div className="mut">{[r.org_type, r.location].filter(Boolean).join(" · ") || "—"}</div>
              </div>
            ),
            sort: (r) => (r.name || "").toLowerCase()
          },
          {
            label: "Contact",
            cell: (r) =>
              r.contact_name || r.contact_phone ? (
                <div>
                  {r.contact_name || "—"}
                  <div className="mut">{[r.contact_phone, r.contact_email].filter(Boolean).join(" · ")}</div>
                </div>
              ) : (
                <span className="mut">—</span>
              )
          },
          { label: "Received", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
          {
            label: "Status",
            cell: (r) => (
              <span>
                {statusTag(r.status)}
                {r.status === "approved" && !r.published ? (
                  <>
                    {" "}
                    <Tag kind="pending">Hidden</Tag>
                  </>
                ) : null}
              </span>
            ),
            sort: (r) => order(r.status)
          },
          {
            label: "",
            cls: "actions",
            cell: (r) => (
              <span className="row nowrap">
                {r.status !== "approved" && (
                  <button className="sm" onClick={() => decide(r, "approved")}>
                    Approve
                  </button>
                )}
                {r.status === "pending" && (
                  <button className="danger sm" onClick={() => decide(r, "rejected")}>
                    Reject
                  </button>
                )}
                <button className="ghost sm" onClick={() => setForm(r)}>
                  View
                </button>
              </span>
            )
          }
        ]}
        search={(r) => [r.name, r.location, r.description, r.contact_name, r.contact_email, r.contact_phone, r.registration_no].join(" ")}
        searchLabel="Search organizations"
        filters={[{ label: "Status", options: STATUSES, test: (r, x) => r.status === x }]}
        sort={{ i: 4, dir: "asc" }}
        pageSize={25}
        onRow={setForm}
        summary={(list) => (
          <p className="mut">{`${list.filter((r) => r.status === "pending").length} waiting for approval · ${list.filter((r) => r.status === "approved").length} approved · ${list.filter((r) => r.status === "rejected").length} rejected`}</p>
        )}
        empty="No member organizations yet. Organizations apply on the website (Membership → Memberships), or add one yourself."
        tools={<button onClick={() => setForm("new")}>+ Add organization</button>}
      />
      {form && (
        <OrgForm org={form === "new" ? undefined : form} next={next} onClose={() => setForm(null)} onSaved={reload} decide={decide} />
      )}
    </div>
  );
}
