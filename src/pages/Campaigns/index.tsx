import { useState } from "react";
import { createCampaign, deleteCampaign, getCampaigns, updateCampaign } from "@/api/content";
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
import { fmtDate, inr } from "@/lib/format";
import type { Campaign } from "@/types";

/** "School kits for children" -> "school-kits-for-children-1a2b" (the address-friendly name the database needs; never shown to visitors). */
const slugOf = (title: string) =>
  `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "campaign"
  }-${Date.now().toString(36).slice(-4)}`;

const percent = (c: Campaign) =>
  Number(c.goal_amount) > 0 ? Math.min(100, Math.round((Number(c.raised_offset) / Number(c.goal_amount)) * 100)) : 0;

function CampaignForm({ entry, onClose, onSaved }: { entry?: Campaign; onClose: () => void; onSaved: () => void }) {
  const r = entry;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const f = useForm({
    title: r?.title ?? "",
    description: r?.description ?? "",
    cause: r?.cause ?? "",
    goal: r ? String(Math.round(Number(r.goal_amount))) : "",
    raised: r ? String(Math.round(Number(r.raised_offset))) : "0",
    order: r ? String(r.sort_order) : "0",
    published: r ? !!r.published : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        title: rules.required("Title", 120),
        description: rules.max("Description", 300),
        cause: rules.max("Cause", 60),
        goal: rules.all(rules.required("Goal"), rules.wholeNumber("Goal"), (v) => (Number(v) < 1 ? "Goal must be more than 0" : null)),
        raised: rules.wholeNumber("Raised so far"),
        order: rules.wholeNumber("Order")
      })
    )
      return;
    const v = f.values;
    const body = {
      title: v.title.trim(),
      description: v.description.trim() || null,
      cause: v.cause.trim() || null,
      goal_amount: Number(v.goal),
      raised_offset: Number(v.raised) || 0,
      sort_order: Number(v.order) || 0,
      published: v.published,
      ...(r ? {} : { slug: slugOf(v.title) })
    };
    try {
      await run(() => (r ? updateCampaign(r.id, body) : createCampaign(body)));
      toast(r ? "Saved." : body.published ? "Campaign added. It now shows on the home page." : "Campaign added (hidden).");
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
        title: "Remove campaign?",
        text: `“${r.title}” will be removed from the website. This cannot be undone. To keep it but hide it, untick “Published” instead.`,
        ok: "Remove",
        danger: true
      }))
    )
      return;
    try {
      await deleteCampaign(r.id);
      toast("Campaign removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={r ? "Edit campaign" : "Add campaign"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="Title *" error={f.errors.title}>
          <input {...f.field("title")} required maxLength={120} placeholder="e.g. School kits for children" />
        </Field>
        <Field label="Short description (up to 300 characters)" error={f.errors.description}>
          <textarea
            {...f.field("description")}
            rows={2}
            maxLength={300}
            placeholder="e.g. Bags, notebooks and stationery for children in our Shiksha Kendras."
          />
        </Field>
        <div className="grid2">
          <Field label="Cause (the small label on the card)" error={f.errors.cause}>
            <input {...f.field("cause")} maxLength={60} placeholder="e.g. Child Education" />
          </Field>
          <Field label="Order on the page (0 = first)" error={f.errors.order}>
            <input {...f.field("order")} type="number" min={0} step={1} inputMode="numeric" />
          </Field>
          <Field label="Goal in ₹ *" error={f.errors.goal}>
            <input {...f.field("goal")} type="number" min={1} step={1} inputMode="numeric" placeholder="e.g. 100000" />
          </Field>
          <Field label="Raised so far in ₹ (update this as donations come in)" error={f.errors.raised}>
            <input {...f.field("raised")} type="number" min={0} step={1} inputMode="numeric" />
          </Field>
        </div>
        <Check {...f.check("published")}>Published (visible on the website)</Check>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Remove campaign
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {r ? "Save changes" : "Add campaign"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CampaignsPage() {
  const { rows, loading, error, reload } = useList("campaigns", getCampaigns);
  const [form, setForm] = useState<Campaign | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Campaigns">
        The fundraising campaigns shown on the home page under “Our Active Campaigns”, each with its goal and the amount raised so far.
        Update “Raised so far” as donations come in and the progress bar moves. If no campaign is published, the section is not shown. Click
        a row to edit.
      </PageHeader>
      <DataTable<Campaign>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Campaign",
            cell: (r) => (
              <div>
                <b>{r.title}</b>
                {r.description ? (
                  <div className="mut">{r.description.length > 110 ? r.description.slice(0, 110) + "…" : r.description}</div>
                ) : null}
              </div>
            ),
            sort: (r) => (r.title || "").toLowerCase()
          },
          { label: "Cause", cell: (r) => r.cause || "—", sort: (r) => (r.cause || "").toLowerCase() },
          { label: "Goal", cell: (r) => inr(r.goal_amount), sort: (r) => Number(r.goal_amount), cls: "num", firstDir: "desc" },
          { label: "Raised", cell: (r) => inr(r.raised_offset), sort: (r) => Number(r.raised_offset), cls: "num", firstDir: "desc" },
          { label: "Funded", cell: (r) => `${percent(r)}%`, sort: (r) => percent(r), cls: "num", firstDir: "desc" },
          { label: "Added", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.title, r.description, r.cause].join(" ")}
        searchLabel="Search campaigns"
        filters={[
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
        empty="No campaigns yet. Add one and it appears on the home page under “Our Active Campaigns”."
        tools={<button onClick={() => setForm("new")}>+ Add campaign</button>}
      />
      {form && <CampaignForm entry={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
