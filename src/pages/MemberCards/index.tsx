import { useState } from "react";
import { deleteMemberCard, getMemberCards, updateMemberCard } from "@/api/content";
import { publicUrl } from "@/lib/storage";
import { DataTable } from "@/components/data-table/DataTable";
import { Field, Select } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, KeyValue, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate, fmtDateTime, localDay } from "@/lib/format";
import { downloadCard, renderCard } from "@/utils/memberCard";
import type { MemberCard } from "@/types";

const STATUSES: [string, string][] = [
  ["pending", "Waiting for approval"],
  ["approved", "Approved"],
  ["rejected", "Rejected"]
];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const statusTag = (s: string) => (
  <Tag kind={s === "approved" ? "active" : s === "rejected" ? "failed" : "pending"}>
    {(STATUSES.find(([v]) => v === s) || STATUSES[0])[1]}
  </Tag>
);
const order = (s: string) => STATUSES.findIndex(([v]) => v === s);
const memberPhotoUrl = (path: string) => publicUrl("member-photos", path);
const yearFromNow = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return localDay(d);
};

/** Approving: the admin sets how long the card is valid (applicants cannot choose it), then the database gives the card its number. */
function ApproveDialog({ card: r, onClose, onDone }: { card: MemberCard; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, run] = useBusy();
  const f = useForm({ valid_till: r.valid_till && r.valid_till > localDay() ? r.valid_till : yearFromNow() });
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        valid_till: (v) => (!v ? "Choose the date the card is valid till" : v <= localDay() ? "The date must be in the future" : null)
      })
    )
      return;
    try {
      const saved = await run(() => updateMemberCard(r.id, { status: "approved", valid_till: f.values.valid_till }));
      toast(`Approved. Card number ${saved.card_id}, valid till ${fmtDate(saved.valid_till)}.`);
      onDone();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  return (
    <Modal title="Approve this application?" onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <p>{`${r.full_name} (${r.role}) gets a member ID number and can generate and download the card on the website.`}</p>
        <Field label="Card valid till *" error={f.errors.valid_till}>
          <input {...f.field("valid_till")} type="date" required min={localDay(new Date(Date.now() + 86400000))} />
        </Field>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Approve
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function useDecide(reload: () => void) {
  const confirm = useConfirm();
  const toast = useToast();
  const [approving, setApproving] = useState<{ card: MemberCard; resolve: (ok: boolean) => void } | null>(null);
  /** Resolves true when the card was approved / rejected. */
  const decide = async (r: MemberCard, status: "approved" | "rejected"): Promise<boolean> => {
    if (status === "approved") return new Promise<boolean>((resolve) => setApproving({ card: r, resolve }));
    if (
      !(await confirm({
        title: "Reject this application?",
        text: `${r.full_name} will be told on the website that the application was not approved. You can approve it later.`,
        ok: "Reject",
        danger: true
      }))
    )
      return false;
    try {
      await updateMemberCard(r.id, { status });
      toast("Application rejected.");
      reload();
      return true;
    } catch (e) {
      toast(messageOf(e), "err");
      return false;
    }
  };
  const dialog = approving && (
    <ApproveDialog
      card={approving.card}
      onClose={() => {
        approving.resolve(false);
        setApproving(null);
      }}
      onDone={() => {
        approving.resolve(true);
        setApproving(null);
        reload();
      }}
    />
  );
  return { decide, dialog };
}

/** The finished card with every detail (phone and blood group included), as a JPG or a PDF. */
async function download(r: MemberCard, kind: "jpg" | "pdf") {
  const canvas = await renderCard({
    name: r.full_name,
    role: r.role,
    phone: r.phone,
    blood: r.blood_group || "",
    valid: r.valid_till || "",
    id: r.card_id || "",
    photoPath: r.photo_path || undefined
  });
  await downloadCard(canvas, r.full_name, kind);
}
function DownloadButton({ card, kind, children }: { card: MemberCard; kind: "jpg" | "pdf"; children: string }) {
  const toast = useToast();
  const [busy, run] = useBusy();
  return (
    <Button
      type="button"
      className="ghost sm"
      busy={busy}
      busyText="Preparing…"
      onClick={() => run(() => download(card, kind)).catch((e) => toast(messageOf(e), "err"))}
    >
      {children}
    </Button>
  );
}

/** The applicant's details. An admin can correct what goes on the card before (or after) approving. */
function CardDetail({
  card: r,
  onClose,
  onChanged,
  decide
}: {
  card: MemberCard;
  onClose: () => void;
  onChanged: () => void;
  decide: (r: MemberCard, s: "approved" | "rejected") => Promise<boolean>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const f = useForm({
    full_name: r.full_name || "",
    role: r.role || "",
    blood_group: r.blood_group || "",
    valid_till: r.valid_till || "",
    admin_note: r.admin_note || ""
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ full_name: rules.required("Name", 60), role: rules.required("Role", 40), admin_note: rules.max("Note", 400) }))
      return;
    const v = f.values;
    try {
      await run(() =>
        updateMemberCard(r.id, {
          full_name: v.full_name.trim(),
          role: v.role.trim(),
          blood_group: v.blood_group || null,
          valid_till: v.valid_till || null,
          admin_note: v.admin_note.trim()
        })
      );
      toast("Saved.");
      onChanged();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  async function remove() {
    if (
      !(await confirm({
        title: "Delete this application?",
        text: `“${r.full_name}” is removed for good${r.card_id ? ` and card ${r.card_id} disappears from the website` : ""}. This cannot be undone.`,
        ok: "Delete",
        danger: true
      }))
    )
      return;
    try {
      await deleteMemberCard(r);
      toast("Application deleted.");
      onChanged();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r.full_name} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <p>
          {statusTag(r.status)} {r.card_id ? <b>{r.card_id}</b> : null}
        </p>
        <div className="thumbs">
          <div>
            {r.photo_path ? (
              <a href={memberPhotoUrl(r.photo_path)} target="_blank" rel="noopener noreferrer">
                <img src={memberPhotoUrl(r.photo_path)} alt={`Photo of ${r.full_name}`} />
              </a>
            ) : (
              <span className="mut">No photo</span>
            )}
          </div>
        </div>
        <div className="kvs">
          <KeyValue label="Phone">
            <a href={`tel:${r.phone}`}>{r.phone}</a>
          </KeyValue>
          <KeyValue label="Date of application">{fmtDateTime(r.created_at)}</KeyValue>
          <KeyValue label="Card issued">{r.issued_at ? fmtDateTime(r.issued_at) : "Not yet"}</KeyValue>
        </div>
        <h2>On the card</h2>
        <div className="grid2">
          <Field label="Full name *" error={f.errors.full_name}>
            <input {...f.field("full_name")} required maxLength={60} />
          </Field>
          <Field label="Role *" error={f.errors.role}>
            <input {...f.field("role")} required maxLength={40} />
          </Field>
          <Field label="Blood group">
            <Select {...f.field("blood_group")} options={[["", "Not given"], ...BLOOD]} />
          </Field>
          <Field label="Valid till (set by you; applicants cannot choose it)">
            <input {...f.field("valid_till")} type="date" />
          </Field>
        </div>
        <Field label="Note for admins (never shown on the website)" error={f.errors.admin_note}>
          <textarea {...f.field("admin_note")} rows={2} maxLength={400} />
        </Field>
        {r.status === "approved" && (
          <div className="row">
            Download the card:
            <DownloadButton card={r} kind="jpg">
              JPG
            </DownloadButton>
            <DownloadButton card={r} kind="pdf">
              PDF
            </DownloadButton>
          </div>
        )}
        <div className="row end">
          <button className="danger" type="button" onClick={remove}>
            Delete
          </button>
          <div className="grow" />
          {r.status !== "rejected" && (
            <button type="button" className="ghost" onClick={async () => (await decide(r, "rejected")) && onClose()}>
              Reject
            </button>
          )}
          {r.status !== "approved" && (
            <button type="button" className="ghost" onClick={async () => (await decide(r, "approved")) && onClose()}>
              Approve
            </button>
          )}
          <Button type="submit" busy={busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MemberCards() {
  const { rows, loading, error, reload } = useList("member_cards", getMemberCards);
  const [open, setOpen] = useState<MemberCard | null>(null);
  const { decide, dialog } = useDecide(reload);
  return (
    <div>
      <PageHeader title="Member ID Cards">
        Applications sent from the website (Member ID Card). Check the applicant's details and photo and approve: only then do they get a
        member ID number and can generate and download their card. Click a row to see or correct the details.
      </PageHeader>
      <DataTable<MemberCard>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Photo",
            cell: (r) =>
              r.photo_path ? (
                <div className="thumbs">
                  <div>
                    <img src={memberPhotoUrl(r.photo_path)} alt="" />
                  </div>
                </div>
              ) : (
                <span className="mut">None</span>
              )
          },
          {
            label: "Applicant",
            cell: (r) => (
              <div>
                <b>{r.full_name}</b>
                <div className="mut">{r.role}</div>
              </div>
            ),
            sort: (r) => (r.full_name || "").toLowerCase()
          },
          { label: "Phone", cell: (r) => r.phone },
          { label: "Blood group", cell: (r) => r.blood_group || "—", sort: (r) => r.blood_group || "" },
          { label: "Valid till", cell: (r) => (r.valid_till ? fmtDate(r.valid_till) : "—"), sort: (r) => r.valid_till || "" },
          { label: "Applied", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
          { label: "Status", cell: (r) => statusTag(r.status), sort: (r) => order(r.status) },
          { label: "Card number", cell: (r) => r.card_id || <span className="mut">None yet</span>, sort: (r) => r.card_id || "" },
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
                {r.status === "approved" && (
                  <DownloadButton card={r} kind="pdf">
                    Download
                  </DownloadButton>
                )}
                <button className="ghost sm" onClick={() => setOpen(r)}>
                  View
                </button>
              </span>
            )
          }
        ]}
        search={(r) => [r.full_name, r.role, r.phone, r.card_id, r.admin_note].join(" ")}
        searchLabel="Search applications"
        filters={[{ label: "Status", options: STATUSES, test: (r, x) => r.status === x }]}
        date={{ label: "Applied", get: (r) => r.created_at }}
        sort={{ i: 6, dir: "asc" }}
        pageSize={25}
        onRow={setOpen}
        summary={(list) => (
          <p className="mut">{`${list.filter((r) => r.status === "pending").length} waiting for approval · ${list.filter((r) => r.status === "approved").length} approved · ${list.filter((r) => r.status === "rejected").length} rejected`}</p>
        )}
        empty="No applications yet. People apply on the website page Member ID Card; each application appears here for your approval."
      />
      {open && <CardDetail card={open} onClose={() => setOpen(null)} onChanged={reload} decide={decide} />}
      {dialog}
    </div>
  );
}
