import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createDonorItem,
  createDonorProgramme,
  deleteDonorItem,
  deleteDonorProgramme,
  getDonorItems,
  getDonorProgrammes,
  removeDonorFile,
  updateDonorItem,
  updateDonorProgramme,
  uploadDonorFile
} from "@/api/content";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, Field } from "@/components/forms/controls";
import { rules, type Rule } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, Msg, PageHeader, Spinner, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { inr } from "@/lib/format";
import type { DonorItem, DonorItemKind, DonorProgramme } from "@/types";

const MAX_MB = 20;
const orderRule = rules.wholeNumber("Position");

interface KindDef {
  title: string;
  add: string;
  one: string;
  hint: string;
  fields: Partial<Record<"title" | "detail" | "amount" | "extra", string>>;
  file?: string;
  image?: boolean;
  show: (r: DonorItem) => [string, string, string];
}
// The five kinds of item on the page, what each one asks for, and how a row of it is shown.
const KINDS: Record<DonorItemKind, KindDef> = {
  spending: {
    title: "Utilization of funds",
    add: "+ Add spending",
    one: "spending line",
    hint: "Where the money went. The “spent” total and the remaining balance are worked out from these lines.",
    fields: { title: "Spent on *", detail: "Details (optional)", amount: "Amount in rupees *" },
    show: (r) => [r.title, r.detail ?? "", inr(r.amount)]
  },
  outcome: {
    title: "Real impact",
    add: "+ Add impact figure",
    one: "impact figure",
    hint: "What the donations achieved, e.g. 100 · Children · ate a nutritious meal. The first one is shown as “Beneficiaries”.",
    fields: { title: "What was reached * (e.g. Children, Families)", detail: "Short description (optional)", amount: "How many *" },
    show: (r) => [`${Number(r.amount).toLocaleString("en-IN")} ${r.title}`, r.detail ?? "", ""]
  },
  proof: {
    title: "Reports & proofs: documents",
    add: "+ Add document",
    one: "document",
    hint: "Expense reports, bill summaries, audit papers. Upload a PDF, or leave the file empty and the card says “Available on request”.",
    fields: { title: "Title *", extra: "Type (e.g. PDF)", detail: "Description (optional)" },
    file: "application/pdf,.pdf",
    show: (r) => [r.title, r.detail ?? "", r.file_url ? "File added" : "On request"]
  },
  photo: {
    title: "Reports & proofs: project photos",
    add: "+ Add photo",
    one: "photo",
    hint: "Photos of the activity.",
    fields: { title: "Caption *" },
    file: "image/jpeg,image/png,image/webp",
    image: true,
    show: (r) => [r.title, "", ""]
  },
  date: {
    title: "Reports & proofs: activity dates",
    add: "+ Add date",
    one: "date",
    hint: "A short timeline: when the money came in, was spent, and the activity happened.",
    fields: { extra: "Date * (as you want it shown, e.g. 5 March)", title: "What happened *", detail: "Details (optional)" },
    show: (r) => [`${r.extra}: ${r.title}`, r.detail ?? "", ""]
  }
};

/** Add / edit one item of a programme. */
function ItemForm({
  kind,
  programme,
  item,
  rows,
  onClose,
  onSaved
}: {
  kind: DonorItemKind;
  programme: DonorProgramme;
  item?: DonorItem;
  rows: DonorItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const K = KINDS[kind];
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [file, setFile] = useState<File | null>(null);
  const [cleared, setCleared] = useState(false);
  const f = useForm({
    title: item?.title ?? "",
    detail: item?.detail ?? "",
    extra: item?.extra ?? "",
    amount: item?.amount != null ? String(item.amount) : "",
    sort_order: item ? String(item.sort_order) : ""
  });
  const nextOrder = Math.max(0, ...rows.filter((x) => x.kind === kind).map((x) => x.sort_order)) + 10;
  const has = (k: keyof KindDef["fields"]) => K.fields[k] !== undefined;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const rl: Record<string, Rule> = { sort_order: orderRule };
    if (K.fields.title?.includes("*")) rl.title = rules.required("This field", 160);
    if (K.fields.extra?.includes("*")) rl.extra = rules.required("The date", 60);
    if (has("amount")) rl.amount = rules.amount("The amount", true);
    if (has("detail")) rl.detail = rules.max("Details", 500);
    if (!f.validate(rl)) return;
    if (file) {
      const okType = K.image ? /^image\/(jpeg|png|webp)$/.test(file.type) : /\.pdf$/i.test(file.name);
      if (!okType) return toast(K.image ? "Please choose a JPG, PNG or WebP photo." : "Please choose a PDF file.", "err");
      if (file.size > MAX_MB * 1024 * 1024) return toast(`The file is larger than ${MAX_MB} MB.`, "err");
    }
    if (K.image && !file && !item?.file_url) return toast("Choose a photo to upload.", "err");
    const v = f.values;
    const body: Record<string, unknown> = {
      programme_id: programme.id,
      kind,
      title: v.title.trim(),
      detail: v.detail.trim(),
      extra: v.extra.trim(),
      amount: has("amount") ? Number(v.amount.trim()) : null,
      sort_order: v.sort_order.trim() === "" ? (item ? item.sort_order : nextOrder) : Number(v.sort_order)
    };
    try {
      await run(async () => {
        let stale: string | null | undefined = null;
        if (file) {
          Object.assign(body, await uploadDonorFile(file));
          stale = item?.storage_path;
        } else if (cleared) {
          body.file_url = null;
          body.storage_path = null;
          stale = item?.storage_path;
        }
        try {
          await (item ? updateDonorItem(item.id, body) : createDonorItem(body));
        } catch (err) {
          if (file) await removeDonorFile(body.storage_path as string); // no orphan upload
          throw err;
        }
        if (stale && stale !== body.storage_path) await removeDonorFile(stale);
      });
      toast(item ? "Saved." : "Added.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  async function remove() {
    if (
      !item ||
      !(await confirm({
        title: `Delete this ${K.one}?`,
        text: "It will be removed from the website page. This cannot be undone.",
        ok: "Delete",
        danger: true
      }))
    )
      return;
    try {
      await deleteDonorItem(item);
      toast("Deleted.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  const shown = !cleared && item?.file_url;
  return (
    <Modal title={`${item ? "Edit" : "Add"} ${K.one}`} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        {(K.image || K.file) && (
          <>
            <p className="mut">
              {shown ? (
                <>
                  {K.image && (
                    <img src={item!.file_url!} alt="" style={{ maxWidth: 160, borderRadius: 8, display: "block", marginBottom: 6 }} />
                  )}
                  Current file:{" "}
                  <a href={item!.file_url!} target="_blank" rel="noopener noreferrer">
                    open ↗
                  </a>
                  {kind === "proof" && (
                    <>
                      {" "}
                      <button type="button" className="danger sm" onClick={() => setCleared(true)}>
                        Remove file
                      </button>
                    </>
                  )}
                </>
              ) : cleared ? (
                "The file will be removed when you save."
              ) : K.image ? (
                "No photo yet: choose one below."
              ) : (
                "No file yet."
              )}
            </p>
            <Field
              label={`${K.image ? "Photo" : "PDF"} (${K.image ? "JPG, PNG or WebP" : "PDF"}, up to ${MAX_MB} MB)${K.image && !item?.file_url ? " *" : ""}`}
            >
              <input type="file" accept={K.file} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          </>
        )}
        {(Object.entries(K.fields) as [keyof KindDef["fields"], string][]).map(([name, label]) => (
          <Field key={name} label={label} error={f.errors[name]}>
            {name === "detail" && kind !== "date" ? (
              <textarea {...f.field(name)} rows={2} maxLength={500} />
            ) : (
              <input
                {...f.field(name)}
                maxLength={name === "amount" ? 13 : name === "extra" ? 60 : 160}
                inputMode={name === "amount" ? "decimal" : undefined}
              />
            )}
          </Field>
        ))}
        <Field label="Position (lower numbers come first; leave empty to add at the end)" error={f.errors.sort_order}>
          <input {...f.field("sort_order")} inputMode="numeric" />
        </Field>
        <div className="row end">
          {item && (
            <button className="danger" type="button" onClick={remove}>
              Delete
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} busyText={file ? "Uploading…" : "Saving…"}>
            {item ? "Save changes" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Add / edit the programme itself (name, dates, place, summary, money received). */
function ProgrammeForm({
  programme,
  onClose,
  onSaved
}: {
  programme?: DonorProgramme;
  onClose: () => void;
  onSaved: (p: DonorProgramme) => void;
}) {
  const p = programme;
  const toast = useToast();
  const [busy, run] = useBusy();
  const f = useForm({
    name: p?.name ?? "",
    period: p?.period ?? "",
    place: p?.place ?? "",
    summary: p?.summary ?? "",
    received: p?.received != null ? String(p.received) : "",
    sort_order: p ? String(p.sort_order) : "",
    published: p ? !!p.published : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        name: rules.required("Name", 160),
        period: rules.max("Dates", 80),
        place: rules.max("Place", 160),
        summary: rules.max("Summary", 800),
        received: rules.amount("Total donations", true),
        sort_order: orderRule
      })
    )
      return;
    const v = f.values;
    const body: Record<string, unknown> = {
      name: v.name.trim(),
      period: v.period.trim(),
      place: v.place.trim(),
      summary: v.summary.trim(),
      received: Number(v.received.trim()),
      published: v.published
    };
    if (v.sort_order.trim() !== "") body.sort_order = Number(v.sort_order.trim());
    try {
      const saved = await run(() => (p ? updateDonorProgramme(p.id, body) : createDonorProgramme(body)));
      toast(p ? "Saved." : "Programme added. Now add its spending, impact figures and proofs.");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  return (
    <Modal title={p ? "Edit programme details" : "Add programme"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="Programme name *" error={f.errors.name}>
          <input {...f.field("name")} maxLength={160} placeholder="e.g. Poshan Ka Utsav (Nutrition Festival)" />
        </Field>
        <div className="grid2">
          <Field label="Dates (as shown)" error={f.errors.period}>
            <input {...f.field("period")} maxLength={80} placeholder="e.g. 12 - 14 March 2026" />
          </Field>
          <Field label="Place" error={f.errors.place}>
            <input {...f.field("place")} maxLength={160} placeholder="e.g. Sagar district, Madhya Pradesh" />
          </Field>
        </div>
        <Field label="Summary (up to 800 characters)" error={f.errors.summary}>
          <textarea {...f.field("summary")} rows={4} maxLength={800} />
        </Field>
        <Field label="Total donations received, in rupees *" error={f.errors.received}>
          <input {...f.field("received")} inputMode="decimal" maxLength={13} />
        </Field>
        <Field label="Position (lower numbers come first; leave empty for the end)" error={f.errors.sort_order}>
          <input {...f.field("sort_order")} inputMode="numeric" />
        </Field>
        <Check {...f.check("published")}>Published (visible on the website Donor Transparency page)</Check>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {p ? "Save changes" : "Add programme"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The editor of one programme: its details, the money summary, and one list per kind of item. */
function ProgrammeView({ id, back }: { id: number; back: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const programmes = useQuery({ queryKey: ["donor_programmes"], queryFn: getDonorProgrammes });
  const items = useQuery({ queryKey: ["donor_items", id], queryFn: () => getDonorItems(id) });
  const [editProgramme, setEditProgramme] = useState(false);
  const [item, setItem] = useState<{ kind: DonorItemKind; item?: DonorItem } | null>(null);

  const p = programmes.data?.find((x) => x.id === id);
  if (programmes.isLoading || items.isLoading) return <Spinner />;
  if (programmes.error || items.error) return <Msg kind="err">{messageOf(programmes.error ?? items.error)}</Msg>;
  if (!p) return <>{back()}</>;
  const rows = items.data ?? [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["donor_programmes"] });
    qc.invalidateQueries({ queryKey: ["donor_items", id] });
  };
  const spent = rows.filter((r) => r.kind === "spending").reduce((n, r) => n + Number(r.amount || 0), 0);
  const left = Number(p.received) - spent;
  const stat = (l: string, v: string, tone = "") => (
    <div className={`card${tone ? " " + tone : ""}`}>
      <div className="n">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
  async function removeProgramme() {
    if (
      !p ||
      !(await confirm({
        title: "Delete this programme?",
        text: `“${p.name}” and all its spending lines, figures, documents, photos and dates will be removed from the website. This cannot be undone.`,
        ok: "Delete programme",
        danger: true
      }))
    )
      return;
    try {
      await deleteDonorProgramme(p.id);
      toast("Programme deleted.");
      qc.invalidateQueries({ queryKey: ["donor_programmes"] });
      back();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <div>
      <div className="row">
        <button type="button" className="ghost" onClick={back}>
          ← All programmes
        </button>
        <div className="grow" />
        <button type="button" className="ghost" onClick={() => setEditProgramme(true)}>
          Edit details
        </button>
        <button type="button" className="danger" onClick={removeProgramme}>
          Delete programme
        </button>
      </div>
      <h1 style={{ marginTop: 14 }}>
        {p.name} <Tag kind={p.published ? "active" : "pending"}>{p.published ? "Published" : "Hidden"}</Tag>
      </h1>
      <p className="mut">{[p.period, p.place].filter(Boolean).join(" · ") || "No dates or place yet."}</p>
      {p.summary ? <p>{p.summary}</p> : null}
      <div className="cards">
        {stat("Total donations", inr(p.received))}
        {stat("Spent (from the lines below)", inr(spent))}
        {stat("Remaining balance", inr(left), left < 0 ? "bad" : "")}
      </div>
      {left < 0 && <p className="msg err">The spending lines add up to more than the donations received. Check the amounts.</p>}
      {(Object.entries(KINDS) as [DonorItemKind, KindDef][]).map(([k, K]) => {
        const list = rows.filter((r) => r.kind === k);
        return (
          <section className="panel" style={{ marginTop: 16 }} key={k}>
            <div className="row">
              <h2 className="grow">
                {K.title} <span className="count">{list.length}</span>
              </h2>
              <button type="button" onClick={() => setItem({ kind: k })}>
                {K.add}
              </button>
            </div>
            <p className="mut">{K.hint}</p>
            {list.length ? (
              <div className="tablewrap">
                <table>
                  <tbody>
                    {list.map((r) => {
                      const [a, b, c] = K.show(r);
                      return (
                        <tr
                          key={r.id}
                          className="click"
                          tabIndex={0}
                          onClick={(e) => !(e.target as HTMLElement).closest("button,a") && setItem({ kind: k, item: r })}
                          onKeyDown={(e) => e.key === "Enter" && setItem({ kind: k, item: r })}
                        >
                          <td>
                            {r.file_url && K.image ? (
                              <img
                                src={r.file_url}
                                alt=""
                                style={{
                                  width: 64,
                                  height: 48,
                                  objectFit: "cover",
                                  borderRadius: 6,
                                  verticalAlign: "middle",
                                  marginRight: 8
                                }}
                              />
                            ) : null}
                            <b>{a}</b>
                            {b ? <div className="mut">{b.length > 110 ? b.slice(0, 110) + "…" : b}</div> : null}
                          </td>
                          <td className="num">{c}</td>
                          <td className="actions">
                            <span className="row nowrap">
                              <button className="ghost sm" type="button" onClick={() => setItem({ kind: k, item: r })}>
                                Edit
                              </button>
                              <button
                                className="danger sm"
                                type="button"
                                onClick={async () => {
                                  if (
                                    !(await confirm({
                                      title: `Delete this ${K.one}?`,
                                      text: "It will be removed from the website page. This cannot be undone.",
                                      ok: "Delete",
                                      danger: true
                                    }))
                                  )
                                    return;
                                  try {
                                    await deleteDonorItem(r);
                                    toast("Deleted.");
                                    refresh();
                                  } catch (e) {
                                    toast(messageOf(e), "err");
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mut">{`No ${K.one}s yet. This section is left out of the website page until you add one.`}</p>
            )}
          </section>
        );
      })}
      {editProgramme && <ProgrammeForm programme={p} onClose={() => setEditProgramme(false)} onSaved={refresh} />}
      {item && <ItemForm kind={item.kind} programme={p} item={item.item} rows={rows} onClose={() => setItem(null)} onSaved={refresh} />}
    </div>
  );
}

/** "Donor Transparency": the programmes shown on the website page Transparency & Reports → Donor Transparency. */
export default function DonorTransparency() {
  const { rows, loading, error, reload } = useList("donor_programmes", getDonorProgrammes);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  if (open !== null)
    return (
      <ProgrammeView
        id={open}
        back={() => {
          setOpen(null);
          reload();
        }}
      />
    );
  return (
    <div>
      <PageHeader title="Donor Transparency">
        The page Transparency & Reports → Donor Transparency on the website: for each programme, the donations received, how they were
        spent, who they reached and the proof. Click a programme to edit it, add or delete anything on its page.
      </PageHeader>
      <DataTable<DonorProgramme>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Programme",
            cell: (r) => (
              <div>
                <b>{r.name}</b>
                <div className="mut">{[r.period, r.place].filter(Boolean).join(" · ")}</div>
              </div>
            ),
            sort: (r) => r.name.toLowerCase()
          },
          { label: "Donations", cell: (r) => inr(r.received), sort: (r) => Number(r.received), cls: "num" },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.name, r.place, r.summary].join(" ")}
        searchLabel="Search programmes"
        sort={{ i: 0, dir: "asc" }}
        onRow={(r) => setOpen(r.id)}
        empty="No programmes yet. Add one and its Donor Transparency page appears on the website."
        tools={<button onClick={() => setAdding(true)}>+ Add programme</button>}
      />
      {adding && (
        <ProgrammeForm
          onClose={() => setAdding(false)}
          onSaved={(p) => {
            reload();
            setOpen(p.id);
          }}
        />
      )}
    </div>
  );
}
