import { useState } from "react";
import { createDonation, downloadDonationsCsv, emailReceipt, getDonations, openReceipt, updateDonation } from "@/api/donations";
import { DataTable } from "@/components/data-table/DataTable";
import { Field, Select } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, Msg, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { backendConfigured } from "@/lib/backend";
import { messageOf } from "@/lib/errors";
import { downloadText, fileStamp, toCsv } from "@/lib/export";
import { fmtDate, inr, localDay } from "@/lib/format";
import type { Donation, DonationStatus } from "@/types";

const METHODS = ["Cash", "Cheque", "Bank transfer / NEFT", "UPI (direct)", "Demand draft", "Other"];
const STATUSES: DonationStatus[] = ["success", "pending", "failed", "refunded", "cancelled"];

/** Record (or edit) a donation. Also opened from the dashboard quick action. */
export function DonationForm({ existing, onClose, onSaved }: { existing?: Donation; onClose: () => void; onSaved: () => void }) {
  const e = existing;
  const toast = useToast();
  const [busy, run] = useBusy();
  const f = useForm({
    donor_name: e?.donor_name ?? "",
    amount: e ? String(e.amount) : "",
    donated_at: e?.donated_at ?? localDay(),
    method: e?.method ?? "Cash",
    donor_email: e?.donor_email ?? "",
    donor_phone: e?.donor_phone ?? "",
    donor_pan: e?.donor_pan ?? "",
    reference: e?.reference ?? "",
    purpose: e?.purpose ?? "",
    donor_address: e?.donor_address ?? "",
    notes: e?.notes ?? ""
  });
  const methods = e?.mode === "online" ? [e.method || "Online", ...METHODS] : METHODS;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const ok = f.validate({
      donor_name: rules.required("Donor name", 120),
      amount: (v) => (!v ? "Amount is required" : !(Number(v) > 0) ? "Amount must be more than 0" : null),
      donated_at: (v) => (!/^\d{4}-\d{2}-\d{2}$/.test(v) ? "Choose the donation date" : null),
      donor_email: rules.email,
      donor_phone: rules.phone,
      donor_pan: (v) => (v && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(v) ? "PAN must look like ABCDE1234F" : null)
    });
    if (!ok) return;
    const v = f.values;
    const body = {
      donor_name: v.donor_name.trim(),
      amount: Number(v.amount),
      donated_at: v.donated_at,
      method: v.method,
      donor_email: v.donor_email.trim() || null,
      donor_phone: v.donor_phone.trim() || null,
      donor_pan: v.donor_pan.trim().toUpperCase() || null,
      reference: v.reference.trim() || null,
      purpose: v.purpose.trim() || null,
      donor_address: v.donor_address.trim() || null,
      notes: v.notes.trim() || null
    };
    try {
      await run(() =>
        e
          ? updateDonation(e.id, { ...body, status: e.status || "success" })
          : createDonation({ ...body, mode: "offline", status: "success" })
      );
      toast(e ? "Donation updated." : "Donation recorded.");
      onSaved();
      onClose();
    } catch (err) {
      toast(messageOf(err), "err");
    }
  }

  return (
    <Modal title={e ? "Edit donation" : "Record offline donation"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <div className="grid2">
          <Field label="Donor name" error={f.errors.donor_name}>
            <input {...f.field("donor_name")} required />
          </Field>
          <Field label="Amount (₹)" error={f.errors.amount}>
            <input {...f.field("amount")} type="number" min="1" step="0.01" required />
          </Field>
          <Field label="Date" error={f.errors.donated_at}>
            <input {...f.field("donated_at")} type="date" required />
          </Field>
          <Field label="Payment method">
            <Select {...f.field("method")} options={methods} />
          </Field>
          <Field label="Email (for receipts)" error={f.errors.donor_email}>
            <input {...f.field("donor_email")} type="email" />
          </Field>
          <Field label="Phone" error={f.errors.donor_phone}>
            <input {...f.field("donor_phone")} />
          </Field>
          <Field label="PAN (needed for 80G)" error={f.errors.donor_pan}>
            <input {...f.field("donor_pan")} maxLength={10} placeholder="ABCDE1234F" />
          </Field>
          <Field label="Cheque / UTR / reference no.">
            <input {...f.field("reference")} />
          </Field>
          <Field label="Purpose / campaign">
            <input {...f.field("purpose")} />
          </Field>
          <Field label="Address">
            <input {...f.field("donor_address")} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea {...f.field("notes")} rows={2} />
        </Field>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {e ? "Save changes" : "Record donation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DonationDetail({ donation, onClose, onChanged }: { donation: Donation; onClose: () => void; onChanged: () => void }) {
  const d = donation;
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, run] = useBusy();

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await run(fn);
      if (ok) toast(ok);
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };

  if (editing)
    return (
      <DonationForm
        existing={d}
        onClose={() => setEditing(false)}
        onSaved={() => {
          onChanged();
          onClose();
        }}
      />
    );
  return (
    <Modal title="Donation" onClose={onClose}>
      <p>
        <b>{d.receipt_no}</b> · <Tag kind={d.status} /> · {d.mode} / {d.method || "-"}
      </p>
      <p>
        {inr(d.amount)} from {d.donor_name || "(unknown)"}
        {d.donor_email ? ` <${d.donor_email}>` : ""} on {fmtDate(d.donated_at)}
      </p>
      {d.gateway_payment_id && (
        <p className="mut">{`Gateway: ${d.gateway} · ${d.gateway_payment_id} · gateway status: ${d.gateway_status}${d.gateway_error ? " · " + d.gateway_error : ""}`}</p>
      )}
      <div className="row">
        Status:
        <select
          value={d.status}
          disabled={busy}
          onChange={(e) =>
            act(async () => {
              await updateDonation(d.id, { status: e.target.value });
              onChanged();
              onClose();
            }, "Status updated.")
          }
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <h2>Receipts & certificates</h2>
      {!d.donor_pan && <Msg kind="info">Donor PAN is empty. Add it (Edit) to include it on an 80G certificate.</Msg>}
      {!backendConfigured && (
        <Msg kind="info">Receipts are produced by the backend. Set VITE_API_URL to the sjks-backend address to enable them.</Msg>
      )}
      <div className="row">
        <button className="ghost" disabled={!backendConfigured || busy} onClick={() => act(() => openReceipt(d.id, "receipt"))}>
          Print receipt
        </button>
        <button className="ghost" disabled={!backendConfigured || busy} onClick={() => act(() => openReceipt(d.id, "tax"))}>
          Print 80G certificate
        </button>
      </div>
      <div className="row">
        <button
          className="ghost"
          disabled={!backendConfigured || busy || !d.donor_email}
          title={d.donor_email ? "" : "This donation has no donor email"}
          onClick={() =>
            act(async () => {
              await emailReceipt(d.id, "receipt");
              onChanged();
            }, "Receipt e-mailed.")
          }
        >
          E-mail receipt
        </button>
        <button
          className="ghost"
          disabled={!backendConfigured || busy || !d.donor_email}
          onClick={() =>
            act(async () => {
              await emailReceipt(d.id, "tax");
              onChanged();
            }, "80G certificate e-mailed.")
          }
        >
          E-mail 80G certificate
        </button>
        {d.receipt_sent_at && <span className="mut">Receipt e-mailed on {fmtDate(d.receipt_sent_at)}</span>}
      </div>
      <div className="row">
        <button className="ghost" onClick={() => setEditing(true)}>
          Edit details
        </button>
      </div>
    </Modal>
  );
}

export default function Donations() {
  const { rows, loading, error, reload } = useList("donations", getDonations);
  const toast = useToast();
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState<Donation | null>(null);
  const [busy, run] = useBusy();

  const exportCsv = (list: Donation[]) => {
    const lines = [
      ["Date", "Receipt", "Donor", "Email", "Amount", "Mode", "Method", "Purpose", "Status"],
      ...list.map((r) => [
        r.donated_at,
        r.receipt_no,
        r.donor_name || "",
        r.donor_email || "",
        r.amount,
        r.mode,
        r.method || "",
        r.purpose || "",
        r.status
      ])
    ];
    downloadText(toCsv(lines), `donations-${fileStamp()}.csv`);
  };

  return (
    <div>
      <PageHeader title="Donations & finance">Click a row for receipts, tax certificates and status.</PageHeader>
      <DataTable<Donation>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Date",
            cell: (r) => fmtDate(r.donated_at),
            sort: (r) => r.donated_at + String(r.id).padStart(9, "0"),
            firstDir: "desc"
          },
          { label: "Receipt", cell: (r) => r.receipt_no, sort: (r) => r.id },
          {
            label: "Donor",
            cell: (r) => (
              <div>
                {r.donor_name || "—"}
                {r.donor_email ? <div className="mut">{r.donor_email}</div> : null}
              </div>
            ),
            sort: (r) => (r.donor_name || "").toLowerCase()
          },
          { label: "Amount", cell: (r) => inr(r.amount), sort: (r) => Number(r.amount), cls: "num", firstDir: "desc" },
          { label: "Mode", cell: (r) => `${r.mode}${r.method ? " · " + r.method : ""}`, sort: (r) => r.mode + (r.method || "") },
          { label: "Purpose", cell: (r) => r.purpose || "—", sort: (r) => (r.purpose || "").toLowerCase() },
          { label: "Status", cell: (r) => <Tag kind={r.status} />, sort: (r) => STATUSES.indexOf(r.status) }
        ]}
        search={(r) => [r.donor_name, r.donor_email, r.donor_phone, r.reference, r.gateway_payment_id, r.purpose, r.receipt_no].join(" ")}
        searchLabel="Search name, email, reference, receipt"
        filters={[
          { label: "Status", options: STATUSES.map((s) => [s, s]), test: (r, v) => r.status === v },
          {
            label: "Mode",
            options: [
              ["online", "Online"],
              ["offline", "Offline"]
            ],
            test: (r, v) => r.mode === v
          },
          {
            label: "Method",
            options: (rs) => [...new Set(rs.map((r) => r.method).filter(Boolean) as string[])].sort().map((m) => [m, m]),
            test: (r, v) => r.method === v
          }
        ]}
        date={{ label: "Date", get: (r) => r.donated_at }}
        sort={{ i: 0, dir: "desc" }}
        onRow={setOpen}
        summary={(list) => {
          const ok = list.filter((r) => r.status === "success" && r.currency === "INR");
          return (
            <p className="mut">{`${list.length} donation record(s) · ${inr(ok.reduce((t, r) => t + Number(r.amount), 0))} raised from ${ok.length} successful`}</p>
          );
        }}
        empty="No donations yet. Online payments appear automatically; record cheques, cash and bank transfers with “+ Record offline donation”."
        tools={(list) => (
          <>
            <button onClick={() => setForm(true)}>+ Record offline donation</button>
            <button className="ghost" onClick={() => exportCsv(list)}>
              Export CSV
            </button>
            {backendConfigured && (
              <Button
                className="ghost"
                busy={busy}
                busyText="Preparing…"
                onClick={() => run(downloadDonationsCsv).catch((e) => toast(messageOf(e), "err"))}
              >
                Full CSV (server)
              </Button>
            )}
          </>
        )}
      />
      {form && <DonationForm onClose={() => setForm(false)} onSaved={reload} />}
      {open && <DonationDetail donation={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
