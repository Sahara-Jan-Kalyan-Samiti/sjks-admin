import { useState } from "react";
import { createAward, deleteAward, getAwards, removeAwardCertificate, updateAward, uploadAwardCertificate } from "@/api/content";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, emptySlot, Field, FileSlot } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import { imageProblem } from "@/lib/storage";
import type { Award } from "@/types";

// Same groups as the filter buttons on the website page. Another group can be typed in.
const CATEGORIES = ["Award / Recognition", "Appreciation", "Recommendation Letter", "Government Reference", "Training Certificate"];
const MAX_MB = 8;

function AwardForm({ award, onClose, onSaved }: { award?: Award; onClose: () => void; onSaved: () => void }) {
  const r = award;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [cert, setCert] = useState(emptySlot);
  const f = useForm({
    title: r?.title ?? "",
    category: r?.category ?? CATEGORIES[0],
    description: r?.description ?? "",
    published: r ? !!r.published : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({ title: rules.required("Title", 200), category: rules.required("Type", 60), description: rules.max("Description", 600) })
    )
      return;
    const problem = cert.file && imageProblem(cert.file, MAX_MB, "image of the certificate");
    if (problem) return toast(problem, "err");
    const v = f.values;
    const body: Record<string, unknown> = {
      title: v.title.trim(),
      category: v.category.trim(),
      description: v.description.trim(),
      published: v.published
    };
    try {
      await run(async () => {
        let stale: string | null | undefined = null;
        if (cert.file) {
          Object.assign(body, await uploadAwardCertificate(cert.file));
          stale = r?.storage_path;
        } else if (cert.cleared) {
          body.image_url = null;
          body.storage_path = null;
          stale = r?.storage_path;
        }
        try {
          await (r ? updateAward(r.id, body) : createAward(body));
        } catch (err) {
          if (cert.file) await removeAwardCertificate(body.storage_path as string);
          throw err;
        }
        if (stale && stale !== body.storage_path) await removeAwardCertificate(stale);
      });
      toast(r ? "Saved." : "Achievement added. It now shows first on the website.");
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
        title: "Remove achievement?",
        text: `“${r.title}” and its certificate will be removed from the website. This cannot be undone.`,
        ok: "Remove",
        danger: true
      }))
    )
      return;
    try {
      await deleteAward(r);
      toast("Achievement removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r ? "Edit achievement" : "Add achievement"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="Title *" error={f.errors.title}>
          <input
            {...f.field("title")}
            required
            maxLength={200}
            placeholder="e.g. Certificate of Excellence – Municipal General Hospital, Mumbai"
          />
        </Field>
        <Field label="Type * (choose one, or type your own)" error={f.errors.category}>
          <input {...f.field("category")} required maxLength={60} list="award-cats" />
        </Field>
        <datalist id="award-cats">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Description (shown under the title; up to 600 characters)" error={f.errors.description}>
          <textarea {...f.field("description")} rows={4} maxLength={600} />
        </Field>
        <h2>Certificate</h2>
        <FileSlot
          value={cert}
          onChange={setCert}
          currentUrl={r?.image_url}
          accept="image/jpeg,image/png,image/webp"
          label={`Upload the certificate image (JPG, PNG or WebP, up to ${MAX_MB} MB)${r?.image_url ? ": replaces the current one" : ""}`}
        />
        <Check {...f.check("published")}>Published (visible on the website)</Check>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Remove achievement
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} busyText={cert.file ? "Uploading…" : "Saving…"}>
            {r ? "Save changes" : "Add achievement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Awards() {
  const { rows, loading, error, reload } = useList("awards", async () => (await getAwards()).map((r, i) => ({ ...r, n: i + 1 })));
  const [form, setForm] = useState<Award | "new" | null>(null);
  type Row = Award & { n: number };
  return (
    <div>
      <PageHeader title="Awards & Recognition">
        Awards, appreciation and recommendation letters shown on the website (About Us → Awards & Recognition), in this order. A new one
        goes first. Click a row to edit it, replace its certificate or remove it.
      </PageHeader>
      <DataTable<Row>
        rows={rows as Row[]}
        loading={loading}
        error={error}
        columns={[
          { label: "Order", cell: (r) => r.n, sort: (r) => r.n, cls: "num" },
          {
            label: "Certificate",
            cell: (r) =>
              r.image_url ? (
                <div className="thumbs">
                  <div>
                    <img src={r.image_url} alt="" />
                  </div>
                </div>
              ) : (
                <span className="mut">None</span>
              )
          },
          {
            label: "Achievement",
            cell: (r) => (
              <div>
                <b>{r.title}</b>
                {r.description ? (
                  <div className="mut">{r.description.length > 120 ? r.description.slice(0, 120) + "…" : r.description}</div>
                ) : null}
              </div>
            ),
            sort: (r) => (r.title || "").toLowerCase()
          },
          { label: "Type", cell: (r) => r.category, sort: (r) => r.category },
          { label: "Added", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.title, r.description, r.category].join(" ")}
        searchLabel="Search achievements"
        filters={[
          {
            label: "Type",
            options: (rs) => [...new Set(rs.map((r) => r.category).filter(Boolean))].sort().map((c) => [c, c]),
            test: (r, x) => r.category === x
          },
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
        summary={(list) => (
          <p className="mut">{`${list.length} achievement(s) · ${list.filter((r) => r.image_url).length} with a certificate`}</p>
        )}
        empty="No achievements yet. Add one and it appears on the website under About Us → Awards & Recognition."
        tools={<button onClick={() => setForm("new")}>+ Add achievement</button>}
      />
      {form && <AwardForm award={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
