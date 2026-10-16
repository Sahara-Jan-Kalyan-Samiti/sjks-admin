import { useState } from "react";
import {
  createAnnualReport,
  deleteAnnualReport,
  getAnnualReports,
  removeAnnualReportFile,
  updateAnnualReport,
  uploadAnnualReportFile
} from "@/api/content";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, Field } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import type { AnnualReport } from "@/types";

const MAX_MB = 20;
const NAME_MAX = 40;
// the name on the box is free text: 2026-27, 2004-2005, "Audit Report 2024", ...
const fyRule = (v: string) =>
  !v ? "Name on the box is required" : v.length > NAME_MAX ? `Name must be ${NAME_MAX} characters or fewer` : null;
const linkRule = (v: string) =>
  v && !/^(\/(?!\/)|https:\/\/)/.test(v)
    ? "Use a link starting with https:// (or a file of this website starting with /)"
    : v.length > 600
      ? "Link is too long"
      : null;

function ReportForm({ report, onClose, onSaved }: { report?: AnnualReport; onClose: () => void; onSaved: () => void }) {
  const r = report;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [file, setFile] = useState<File | null>(null);
  const [cleared, setCleared] = useState(false); // "Remove PDF" pressed: the box goes back to "not uploaded yet" on save
  const f = useForm({
    fy: r?.fy ?? "",
    title: r?.title ?? "",
    description: r?.description ?? "",
    file_url: r?.storage_path ? "" : (r?.file_url ?? ""),
    published: r ? !!r.published : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ fy: fyRule, title: rules.max("Title", 160), description: rules.max("Description", 400), file_url: linkRule })) return;
    if (file && !/\.pdf$/i.test(file.name)) return toast("Please choose a PDF file.", "err");
    if (file && file.size > MAX_MB * 1024 * 1024) return toast(`The PDF is larger than ${MAX_MB} MB.`, "err");
    const v = f.values;
    const fy = v.fy.trim();
    const link = v.file_url.trim();
    const body: Record<string, unknown> = { fy, title: v.title.trim(), description: v.description.trim(), published: v.published };
    try {
      await run(async () => {
        let stale: string | null | undefined = null; // an uploaded file that is no longer used after this save
        if (file) {
          Object.assign(body, await uploadAnnualReportFile(fy, file));
          stale = r?.storage_path;
        } else if (link) {
          if (link !== r?.file_url) {
            body.file_url = link;
            body.storage_path = null;
            stale = r?.storage_path;
          }
        } else if (cleared || !r?.storage_path) {
          body.file_url = null;
          body.storage_path = null;
          stale = r?.storage_path;
        }
        try {
          await (r ? updateAnnualReport(r.id, body) : createAnnualReport(body));
        } catch (err) {
          if (file) await removeAnnualReportFile(body.storage_path as string);
          throw err;
        }
        if (stale && stale !== body.storage_path) await removeAnnualReportFile(stale);
      });
      toast(r ? "Saved." : `Box “${fy}” added. It now shows on the website.`);
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
        title: `Delete ${r.fy}?`,
        text: "This box and its uploaded PDF will be deleted from the website. This cannot be undone.",
        ok: "Delete box",
        danger: true
      }))
    )
      return;
    try {
      await deleteAnnualReport(r);
      toast("Box deleted.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r ? `Edit ${r.fy}` : "Add a box"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <div className="grid2">
          <Field label="Name on the box (any wording, e.g. 2026-27 or 2004-2005)" error={f.errors.fy}>
            <input {...f.field("fy")} required maxLength={NAME_MAX} placeholder="2026-2027" />
          </Field>
          <Field label="Title on the box" error={f.errors.title}>
            <input {...f.field("title")} maxLength={160} placeholder="Annual Report 2026-27" />
          </Field>
        </div>
        <Field label="Short description (optional, shown under the title)" error={f.errors.description}>
          <textarea {...f.field("description")} rows={2} maxLength={400} />
        </Field>
        <h2>Report PDF</h2>
        <p className="mut">
          {r?.file_url && !cleared ? (
            <>
              Current PDF:{" "}
              <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                {r.storage_path ? "uploaded file ↗" : r.file_url + " ↗"}
              </a>{" "}
              <button
                type="button"
                className="danger sm"
                onClick={() => {
                  setCleared(true);
                  f.set("file_url", "");
                  setFile(null);
                }}
              >
                Remove PDF
              </button>
            </>
          ) : cleared ? (
            "The PDF will be removed when you save."
          ) : (
            "No PDF yet: the box shows “Report not uploaded yet” on the website."
          )}
        </p>
        <Field label={`Upload a PDF (up to ${MAX_MB} MB)${r?.file_url ? ": replaces the current one" : ""}`}>
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="…or paste a link to the PDF" error={f.errors.file_url}>
          <input {...f.field("file_url")} placeholder="https://… (only if the PDF is hosted somewhere else)" />
        </Field>
        <Check {...f.check("published")}>Published (the box is visible on the website)</Check>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Delete box
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} busyText={file ? "Uploading…" : "Saving…"}>
            {r ? "Save changes" : "Add box"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AnnualReports() {
  const { rows, loading, error, reload } = useList("annual_reports", getAnnualReports);
  const [form, setForm] = useState<AnnualReport | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Annual Reports">
        The boxes on the website (Transparency & Reports → Annual Reports). “+ Add box” creates a new one with any name you like. Click a
        box to rename it, change its title or description, or upload its PDF. A box without a PDF shows as “Report not uploaded yet”.
      </PageHeader>
      <DataTable<AnnualReport>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          { label: "Name on the box", cell: (r) => <b>{r.fy}</b>, sort: (r) => r.fy, firstDir: "desc" },
          {
            label: "Title",
            cell: (r) => (
              <div>
                {r.title || "—"}
                {r.description ? (
                  <div className="mut">{r.description.length > 110 ? r.description.slice(0, 110) + "…" : r.description}</div>
                ) : null}
              </div>
            ),
            sort: (r) => (r.title || "").toLowerCase()
          },
          {
            label: "PDF",
            cell: (r) =>
              r.file_url ? (
                <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                  Open PDF ↗
                </a>
              ) : (
                <span className="mut">Not uploaded</span>
              ),
            sort: (r) => (r.file_url ? 0 : 1)
          },
          { label: "Updated", cell: (r) => fmtDate(r.updated_at), sort: (r) => r.updated_at },
          {
            label: "Status",
            cell: (r) => (
              <Tag kind={!r.published ? "pending" : r.file_url ? "active" : "new"}>
                {!r.published ? "Hidden" : r.file_url ? "Online" : "Empty box"}
              </Tag>
            ),
            sort: (r) => (!r.published ? 2 : r.file_url ? 0 : 1)
          }
        ]}
        search={(r) => [r.fy, r.title, r.description].join(" ")}
        searchLabel="Search boxes"
        filters={[
          {
            label: "PDF",
            options: [
              ["yes", "Uploaded"],
              ["no", "Not uploaded"]
            ],
            test: (r, x) => (x === "yes") === !!r.file_url
          }
        ]}
        sort={{ i: 0, dir: "asc" }}
        pageSize={25}
        onRow={setForm}
        summary={(list) => <p className="mut">{`${list.length} box(es) · ${list.filter((r) => r.file_url).length} with a PDF`}</p>}
        empty="No boxes yet. Add one and it appears on the website."
        tools={<button onClick={() => setForm("new")}>+ Add box</button>}
      />
      {form && <ReportForm report={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
