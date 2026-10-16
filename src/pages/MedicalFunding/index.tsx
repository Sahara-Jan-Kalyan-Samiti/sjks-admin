import { useState } from "react";
import { createMedicalFunding, deleteMedicalFunding, getMedicalFundings, updateMedicalFunding } from "@/api/content";
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
import { fmtDate, inr } from "@/lib/format";
import type { MedicalFunding } from "@/types";

// The two lists on the website page (Our Projects → Medical Facilities).
const KINDS: [string, string][] = [
  ["hospital", "Hospital funding"],
  ["facility", "NGO medical facility"]
];
const kindName = (k: string) => (KINDS.find(([v]) => v === k) || KINDS[0])[1];

function FundingForm({ entry, onClose, onSaved }: { entry?: MedicalFunding; onClose: () => void; onSaved: () => void }) {
  const r = entry;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const f = useForm({
    kind: r?.kind ?? "hospital",
    name: r?.name ?? "",
    location: r?.location ?? "",
    amount: String(Math.round(Number(r?.amount) || 0)),
    period: r?.period ?? "",
    purpose: r?.purpose ?? "",
    published: r ? !!r.published : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        name: rules.required("Name", 160),
        location: rules.max("Location", 120),
        amount: rules.wholeNumber("Amount"),
        period: rules.max("Year", 40),
        purpose: rules.max("Purpose", 600)
      })
    )
      return;
    const v = f.values;
    const body = {
      kind: v.kind,
      name: v.name.trim(),
      location: v.location.trim(),
      amount: Number(v.amount) || 0,
      period: v.period.trim(),
      purpose: v.purpose.trim(),
      published: v.published
    };
    try {
      await run(() => (r ? updateMedicalFunding(r.id, body) : createMedicalFunding(body)));
      toast(r ? "Saved." : "Entry added. It now shows on the website.");
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
        title: "Remove entry?",
        text: `“${r.name}” will be removed from the website. This cannot be undone.`,
        ok: "Remove",
        danger: true
      }))
    )
      return;
    try {
      await deleteMedicalFunding(r.id);
      toast("Entry removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r ? "Edit entry" : "Add entry"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <div className="grid2">
          <Field label="List *">
            <Select {...f.field("kind")} options={KINDS} />
          </Field>
          <Field label="Hospital / facility name *" error={f.errors.name}>
            <input {...f.field("name")} required maxLength={160} />
          </Field>
          <Field label="Location" error={f.errors.location}>
            <input {...f.field("location")} maxLength={120} placeholder="e.g. Sagar, Madhya Pradesh" />
          </Field>
          <Field label="Amount donated in ₹ (0 = no amount shown)" error={f.errors.amount}>
            <input {...f.field("amount")} type="number" min={0} step={1} inputMode="numeric" />
          </Field>
          <Field label="Year or period (as it should read)" error={f.errors.period}>
            <input {...f.field("period")} maxLength={40} placeholder="e.g. 2024 or 2023-24" />
          </Field>
        </div>
        <Field label="What the money was for (shown under the name; up to 600 characters)" error={f.errors.purpose}>
          <textarea {...f.field("purpose")} rows={3} maxLength={600} />
        </Field>
        <Check {...f.check("published")}>Published (visible on the website)</Check>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Remove entry
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {r ? "Save changes" : "Add entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MedicalFundingPage() {
  const { rows, loading, error, reload } = useList("medical_fundings", getMedicalFundings);
  const [form, setForm] = useState<MedicalFunding | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Medical Funding">
        Hospitals and medical facilities funded by the Samiti, with the amount donated to each, as shown on the website (Our Projects →
        Medical Facilities). The totals on the page add up by themselves. Click a row to edit or remove it.
      </PageHeader>
      <DataTable<MedicalFunding>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Hospital / facility",
            cell: (r) => (
              <div>
                <b>{r.name}</b>
                {r.purpose ? <div className="mut">{r.purpose.length > 120 ? r.purpose.slice(0, 120) + "…" : r.purpose}</div> : null}
              </div>
            ),
            sort: (r) => (r.name || "").toLowerCase()
          },
          { label: "List", cell: (r) => kindName(r.kind), sort: (r) => r.kind },
          { label: "Location", cell: (r) => r.location || "—", sort: (r) => (r.location || "").toLowerCase() },
          { label: "Year", cell: (r) => r.period || "—", sort: (r) => r.period },
          {
            label: "Amount donated",
            cell: (r) => (Number(r.amount) ? inr(r.amount) : <span className="mut">Not shown</span>),
            sort: (r) => Number(r.amount),
            cls: "num",
            firstDir: "desc"
          },
          { label: "Added", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.name, r.location, r.purpose, r.period].join(" ")}
        searchLabel="Search funding"
        filters={[
          { label: "List", options: KINDS, test: (r, x) => r.kind === x },
          {
            label: "Status",
            options: [
              ["published", "Published"],
              ["hidden", "Hidden"]
            ],
            test: (r, x) => (x === "published") === !!r.published
          }
        ]}
        pageSize={25}
        onRow={setForm}
        summary={(list) => (
          <p className="mut">{`${list.length} entr${list.length === 1 ? "y" : "ies"} · ${inr(list.filter((r) => r.published).reduce((s, r) => s + Number(r.amount), 0))} published as donated`}</p>
        )}
        empty="No funding entries yet. Add one and it appears on the website under Our Projects → Medical Facilities."
        tools={<button onClick={() => setForm("new")}>+ Add entry</button>}
      />
      {form && <FundingForm entry={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
