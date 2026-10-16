import { useState } from "react";
import {
  AREA_NAMES,
  createProject,
  deleteProject,
  getProjects,
  removeProjectPhoto,
  updateProject,
  uploadProjectPhoto,
  websitePortfolio
} from "@/api/projects";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, emptySlot, Field, FileSlot, Select } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, KeyValue, PageHeader, Tabs, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate, num } from "@/lib/format";
import { imageProblem } from "@/lib/storage";
import type { PortfolioProject, Project, ProjectStatus } from "@/types";

const STATUSES: ProjectStatus[] = ["planned", "ongoing", "completed"];
const MAX_MB = 8;
const statusTag = (s: string) => <Tag kind={s === "ongoing" ? "active" : s === "completed" ? "completed" : "pending"}>{s}</Tag>;
const distinct = (rows: { area?: string | null }[]): [string, string][] =>
  [...new Set(rows.map((r) => r.area).filter(Boolean) as string[])].sort().map((v) => [v, AREA_NAMES[v] || v]);

/** Add / edit form (also used by the dashboard quick action). */
export function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved: () => void }) {
  const p = project;
  const toast = useToast();
  const [busy, run] = useBusy();
  const [photo, setPhoto] = useState(emptySlot);
  const f = useForm({
    name: p?.name ?? "",
    area: p?.area ?? "",
    location: p?.location ?? "",
    beneficiaries: String(p?.beneficiaries ?? 0),
    status: p?.status ?? "ongoing",
    description: p?.description ?? "",
    published: p ? p.published !== false : true
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        name: rules.required("Project name", 160),
        area: rules.max("Area", 80),
        location: rules.max("Location", 120),
        beneficiaries: rules.wholeNumber("Beneficiaries"),
        description: rules.max("Description", 2000)
      })
    )
      return;
    const problem = photo.file && imageProblem(photo.file, MAX_MB);
    if (problem) return toast(problem, "err");
    const v = f.values;
    const body: Record<string, unknown> = {
      name: v.name.trim(),
      area: v.area.trim() || null,
      location: v.location.trim() || null,
      description: v.description.trim() || null,
      status: v.status,
      published: v.published,
      beneficiaries: Number(v.beneficiaries) || 0
    };
    try {
      await run(async () => {
        let stale: string | null | undefined = null; // an uploaded file that is no longer used after this save
        if (photo.file) {
          Object.assign(body, await uploadProjectPhoto(photo.file));
          stale = p?.storage_path;
        } else if (photo.cleared) {
          body.image_url = null;
          body.storage_path = null;
          stale = p?.storage_path;
        }
        try {
          await (p ? updateProject(p.id, body) : createProject(body));
        } catch (err) {
          if (photo.file) await removeProjectPhoto(body.storage_path as string); // do not leave an orphan upload behind
          throw err;
        }
        if (stale && stale !== body.storage_path) await removeProjectPhoto(stale);
      });
      toast(p ? "Project saved." : "Project added.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={p ? "Edit project" : "Add project"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <div className="grid2">
          <Field label="Project name *" error={f.errors.name}>
            <input {...f.field("name")} required maxLength={160} />
          </Field>
          <Field label="Area / category (e.g. Child education)" error={f.errors.area}>
            <input {...f.field("area")} maxLength={80} list="proj-areas" />
          </Field>
          <Field label="Location" error={f.errors.location}>
            <input {...f.field("location")} maxLength={120} />
          </Field>
          <Field label="Beneficiaries reached" error={f.errors.beneficiaries}>
            <input {...f.field("beneficiaries")} type="number" min={0} step={1} inputMode="numeric" />
          </Field>
          <Field label="Status">
            <Select {...f.field("status")} options={STATUSES} />
          </Field>
        </div>
        <Field label="Description" error={f.errors.description}>
          <textarea {...f.field("description")} rows={4} maxLength={2000} />
        </Field>
        <h2>Photo</h2>
        <FileSlot
          value={photo}
          onChange={setPhoto}
          currentUrl={p?.image_url}
          accept="image/jpeg,image/png,image/webp"
          label={`Upload a photo for the project card on the website (JPG, PNG or WebP, up to ${MAX_MB} MB)${p?.image_url ? ": replaces the current one" : ""}`}
        />
        <Check {...f.check("published")}>Show on the website Projects page</Check>
        <datalist id="proj-areas">
          {Object.values(AREA_NAMES).map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} busyText={photo.file ? "Uploading…" : "Saving…"}>
            {p ? "Save changes" : "Add project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectView({
  project,
  onClose,
  onChanged,
  onEdit
}: {
  project: Project;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const p = project;
  const toast = useToast();
  const confirm = useConfirm();
  const remove = async () => {
    if (
      !(await confirm({
        title: "Delete project?",
        text: `“${p.name}” will be removed from the admin and from the website. This cannot be undone.`,
        ok: "Delete project",
        danger: true
      }))
    )
      return;
    try {
      await deleteProject(p.id);
      await removeProjectPhoto(p.storage_path);
      toast("Project deleted.");
      onChanged();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };
  const setStatus = async (status: ProjectStatus) => {
    try {
      await updateProject(p.id, { status });
      toast(`Status changed to ${status}.`);
    } catch (e) {
      toast(messageOf(e), "err");
    }
    onChanged();
    onClose();
  };
  return (
    <Modal title={p.name} onClose={onClose}>
      <p>
        {statusTag(p.status)}{" "}
        <Tag kind={p.published ? "active" : "pending"}>{p.published ? "Shown on website" : "Hidden from website"}</Tag>
      </p>
      <div className="kvs">
        <KeyValue label="Area">{p.area}</KeyValue>
        <KeyValue label="Location">{p.location}</KeyValue>
        <KeyValue label="Beneficiaries">{num(p.beneficiaries)}</KeyValue>
        <KeyValue label="Added">{fmtDate(p.created_at)}</KeyValue>
      </div>
      {p.description ? <p className="pre">{p.description}</p> : <p className="mut">No description.</p>}
      {p.image_url && (
        <div className="thumbs">
          <div>
            <a href={p.image_url} target="_blank" rel="noopener noreferrer">
              <img src={p.image_url} alt="Project photo" />
            </a>
          </div>
        </div>
      )}
      <div className="row">
        Change status:
        {STATUSES.filter((s) => s !== p.status).map((s) => (
          <button key={s} className="ghost sm" onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="row end">
        <button className="danger" onClick={remove}>
          Delete
        </button>
        <button onClick={onEdit}>Edit</button>
      </div>
    </Modal>
  );
}

function PortfolioView({ p, onClose }: { p: PortfolioProject; onClose: () => void }) {
  return (
    <Modal title={p.name} onClose={onClose}>
      <p>
        {statusTag(p.status === "not dated" ? "planned" : (p.status ?? "planned"))} <span className="mut">{`Portfolio no. ${p.no}`}</span>
      </p>
      <div className="kvs">
        <KeyValue label="Area">{AREA_NAMES[p.area] || p.area}</KeyValue>
        <KeyValue label="Period">{p.period}</KeyValue>
        <KeyValue label="Location">{p.location}</KeyValue>
        <KeyValue label="Beneficiaries">{p.beneficiaries}</KeyValue>
        <KeyValue label="Budget">{p.budget}</KeyValue>
        <KeyValue label="Funding">{p.funding}</KeyValue>
      </div>
      <p className="pre">{p.summary || ""}</p>
      <p className="msg info">
        Website portfolio projects are edited in the sjks-frontend repository (src/data/content/portfolio.ts), then exported to this panel.
      </p>
    </Modal>
  );
}

export default function Projects() {
  const { rows, loading, error, reload } = useList("projects", getProjects);
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState("added");
  const [form, setForm] = useState<Project | "new" | null>(null);
  const [view, setView] = useState<Project | null>(null);
  const [site, setSite] = useState<PortfolioProject | null>(null);

  const setStatus = async (p: Project, status: string) => {
    try {
      await updateProject(p.id, { status });
      toast(`Status changed to ${status}.`);
    } catch (e) {
      toast(messageOf(e), "err");
    }
    reload();
  };
  const remove = async (p: Project) => {
    if (
      !(await confirm({
        title: "Delete project?",
        text: `“${p.name}” will be removed from the admin and from the website. This cannot be undone.`,
        ok: "Delete project",
        danger: true
      }))
    )
      return;
    try {
      await deleteProject(p.id);
      await removeProjectPhoto(p.storage_path);
      toast("Project deleted.");
      reload();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };

  return (
    <div>
      <PageHeader title="Projects">
        Projects added here appear on the website Projects page under “Upcoming & New Projects” (menu: Our Projects → Upcoming Projects),
        unless hidden. Status “planned” is shown as “Upcoming”.
      </PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "added", label: "Added in admin", count: loading ? undefined : rows.length },
          { key: "site", label: "Website portfolio", count: websitePortfolio.length }
        ]}
      />
      {tab === "added" ? (
        <DataTable<Project>
          rows={rows}
          loading={loading}
          error={error}
          columns={[
            {
              label: "Photo",
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
              label: "Project",
              cell: (r) => (
                <div>
                  <b>{r.name}</b>
                  {r.area ? <div className="mut">{r.area}</div> : null}
                </div>
              ),
              sort: (r) => r.name.toLowerCase()
            },
            { label: "Location", cell: (r) => r.location || "—", sort: (r) => (r.location || "").toLowerCase() },
            { label: "Beneficiaries", cell: (r) => num(r.beneficiaries), sort: (r) => r.beneficiaries, cls: "num", firstDir: "desc" },
            {
              label: "Status",
              cell: (r) => (
                <select
                  className="inline-sel"
                  aria-label={`Status of ${r.name}`}
                  value={r.status}
                  onChange={(e) => setStatus(r, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ),
              sort: (r) => STATUSES.indexOf(r.status)
            },
            {
              label: "Website",
              cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Shown" : "Hidden"}</Tag>,
              sort: (r) => (r.published ? 0 : 1)
            },
            { label: "Added", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
            {
              label: "",
              cls: "actions",
              cell: (r) => (
                <span className="row nowrap">
                  <button className="ghost sm" onClick={() => setView(r)}>
                    View
                  </button>
                  <button className="ghost sm" onClick={() => setForm(r)}>
                    Edit
                  </button>
                  <button className="danger sm" onClick={() => remove(r)}>
                    Delete
                  </button>
                </span>
              )
            }
          ]}
          search={(r) => [r.name, r.area, r.location, r.description].join(" ")}
          searchLabel="Search projects"
          filters={[
            { label: "Status", options: STATUSES.map((s) => [s, s]), test: (r, v) => r.status === v },
            { label: "Area", options: (rs) => distinct(rs), test: (r, v) => r.area === v },
            {
              label: "Website",
              options: [
                ["shown", "Shown"],
                ["hidden", "Hidden"]
              ],
              test: (r, v) => (v === "shown") === !!r.published
            }
          ]}
          date={{ label: "Added", get: (r) => r.created_at }}
          sort={{ i: 6, dir: "desc" }}
          onRow={setView}
          empty="No projects added yet. Use “+ Add project” — they appear on the website Projects page under “Upcoming & New Projects”."
          tools={<button onClick={() => setForm("new")}>+ Add project</button>}
        />
      ) : (
        <>
          <p className="msg info">
            Read-only: these programmes come from the website source (sjks-frontend, src/data/content/portfolio.ts).
          </p>
          <DataTable<PortfolioProject>
            rows={websitePortfolio}
            rowKey={(r) => r.no}
            columns={[
              { label: "No.", cell: (r) => r.no, sort: (r) => r.no, cls: "num" },
              { label: "Project", cell: (r) => <b>{r.name}</b>, sort: (r) => r.name.toLowerCase() },
              { label: "Area", cell: (r) => AREA_NAMES[r.area] || r.area, sort: (r) => r.area },
              { label: "Period", cell: (r) => r.period || "—" },
              {
                label: "Status",
                cell: (r) => statusTag(r.status === "not dated" ? "planned" : (r.status ?? "planned")),
                sort: (r) => r.status
              },
              { label: "Beneficiaries", cell: (r) => r.beneficiaries || "—" }
            ]}
            search={(r) => [r.name, r.area, r.location, r.summary, r.funding].join(" ")}
            searchLabel="Search portfolio"
            filters={[
              {
                label: "Status",
                options: [
                  ["ongoing", "Ongoing"],
                  ["completed", "Completed"],
                  ["not dated", "Not dated"]
                ],
                test: (r, v) => r.status === v
              },
              { label: "Area", options: (rs) => distinct(rs), test: (r, v) => r.area === v }
            ]}
            sort={{ i: 0, dir: "asc" }}
            onRow={setSite}
            empty="The website portfolio could not be read."
          />
        </>
      )}
      {form && <ProjectForm project={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
      {view && (
        <ProjectView
          project={view}
          onClose={() => setView(null)}
          onChanged={reload}
          onEdit={() => {
            setForm(view);
            setView(null);
          }}
        />
      )}
      {site && <PortfolioView p={site} onClose={() => setSite(null)} />}
    </div>
  );
}
