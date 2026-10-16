import { useState } from "react";
import {
  createVolunteer,
  deleteVolunteer,
  getVolunteers,
  removeVolunteerPhoto,
  setVolunteerPhoto,
  updateVolunteer,
  volunteerPhotoUrl
} from "@/api/people";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, Field } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, KeyValue, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import { imageProblem } from "@/lib/storage";
import type { Volunteer } from "@/types";
import { ManagerField } from "./ManagerField";

const STATUSES = ["pending", "active", "inactive"];
const MAX_MB = 5;
/** On the website = active AND ticked "Show on website". */
const onSite = (v: Volunteer) => v.status === "active" && v.show_on_website;

export function VolunteerForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, run] = useBusy();
  const [photo, setPhoto] = useState<File | null>(null);
  const [under, setUnder] = useState<string | null>(null);
  const f = useForm({ name: "", phone: "", email: "", area: "", show_on_website: true });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ name: rules.required("Name", 120), phone: rules.phone, email: rules.email, area: rules.max("Area of interest", 80) }))
      return;
    const problem = photo && imageProblem(photo, MAX_MB);
    if (problem) return toast(problem, "err");
    const v = f.values;
    const body: Record<string, unknown> = {
      name: v.name.trim(),
      phone: v.phone.trim(),
      email: v.email.trim() || null,
      area: v.area.trim() || null,
      status: "active",
      show_on_website: v.show_on_website
    };
    if (under) body.reports_to = under;
    try {
      await run(async () => {
        const created = await createVolunteer(body);
        if (photo) {
          try {
            await setVolunteerPhoto(created, photo);
          } catch (err) {
            toast(`Volunteer added, but the photo could not be saved: ${messageOf(err)}`, "err");
          }
        }
      });
      toast("Volunteer added.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title="Add volunteer" onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="Name *" error={f.errors.name}>
          <input {...f.field("name")} required maxLength={120} />
        </Field>
        <div className="grid2">
          <Field label="Phone" error={f.errors.phone}>
            <input {...f.field("phone")} inputMode="tel" />
          </Field>
          <Field label="Email" error={f.errors.email}>
            <input {...f.field("email")} type="email" />
          </Field>
        </div>
        <Field label="Area of interest" error={f.errors.area}>
          <input {...f.field("area")} maxLength={80} />
        </Field>
        <ManagerField selfKey={null} saved={null} value={under} onChange={setUnder} />
        <Field label={`Photo for the website (optional; JPG, PNG or WebP, up to ${MAX_MB} MB)`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </Field>
        <Check {...f.check("show_on_website")}>Show name and photo on the website (About Us → Our Volunteers)</Check>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Add active volunteer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VolunteerView({ volunteer, onClose, onChanged }: { volunteer: Volunteer; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [r, setR] = useState(volunteer);
  const [busy, run] = useBusy();
  const [under, setUnder] = useState<string | null>(volunteer.reports_to);

  const attempt = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    try {
      await run(fn);
      toast(ok);
    } catch (e) {
      toast(messageOf(e), "err");
    }
    onChanged();
    if (close) onClose();
  };
  const remove = async () => {
    if (
      !(await confirm({
        title: "Delete volunteer?",
        text: `${r.name || "This volunteer"} will be removed permanently.`,
        ok: "Delete",
        danger: true
      }))
    )
      return;
    await attempt(() => deleteVolunteer(r.id), "Volunteer deleted.", true);
  };

  return (
    <Modal title={r.name || "Volunteer"} onClose={onClose}>
      <p>
        <Tag kind={r.status} />{" "}
        <Tag kind={onSite(r) ? "active" : "pending"}>
          {onSite(r) ? "Shown on website" : r.show_on_website ? "Will show once active" : "Not on website"}
        </Tag>
      </p>
      <div className="kvs">
        <KeyValue label="Phone">{r.phone}</KeyValue>
        <KeyValue label="Email">{r.email}</KeyValue>
        <KeyValue label="Area of interest">{r.area}</KeyValue>
        <KeyValue label="Signed up">{fmtDate(r.created_at)}</KeyValue>
      </div>
      {r.message ? (
        <div>
          <h2>Message</h2>
          <p className="pre">{r.message}</p>
        </div>
      ) : (
        <p className="mut">No message.</p>
      )}
      <h2>Works under</h2>
      <ManagerField
        selfKey={`volunteer:${r.id}`}
        saved={r.reports_to}
        value={under}
        onChange={async (key) => {
          setUnder(key);
          try {
            setR(await updateVolunteer(r.id, { reports_to: key }));
            toast("Saved.");
            onChanged();
          } catch (e) {
            toast(messageOf(e), "err");
          }
        }}
      />
      <h2>Website photo</h2>
      <div className="thumbs">
        {r.photo_path ? (
          <div>
            <img src={volunteerPhotoUrl(r.photo_path)} alt={`Photo of ${r.name}`} />
            <button
              className="danger sm"
              type="button"
              disabled={busy}
              onClick={() => attempt(async () => setR(await removeVolunteerPhoto(r)), "Photo removed.")}
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="mut">No photo yet: the website shows the volunteer’s initials instead.</p>
        )}
      </div>
      <Field label={`Upload a photo (JPG, PNG or WebP, up to ${MAX_MB} MB)`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const problem = imageProblem(file, MAX_MB);
            if (problem) return toast(problem, "err");
            attempt(async () => setR(await setVolunteerPhoto(r, file)), "Photo saved.");
          }}
        />
      </Field>
      <p className="mut">
        Only the name, area of interest and photo are ever shown on the website (About Us → Our Volunteers). Phone, email and message stay
        private.
      </p>
      <div className="row end">
        {r.status !== "active" && (
          <button
            className="sm"
            disabled={busy}
            onClick={() => attempt(() => updateVolunteer(r.id, { status: "active" }), `${r.name || "Volunteer"} is now active.`, true)}
          >
            {r.status === "pending" ? "Approve" : "Activate"}
          </button>
        )}
        {r.status === "active" && (
          <button
            className="ghost sm"
            disabled={busy}
            onClick={() => attempt(() => updateVolunteer(r.id, { status: "inactive" }), `${r.name || "Volunteer"} is now inactive.`, true)}
          >
            Deactivate
          </button>
        )}
        <button
          className="ghost sm"
          disabled={busy}
          onClick={() =>
            attempt(
              () => updateVolunteer(r.id, { show_on_website: !r.show_on_website }),
              r.show_on_website ? `${r.name} is hidden from the website.` : `${r.name} is now shown on the website.`,
              true
            )
          }
        >
          {r.show_on_website ? "Hide from website" : "Show on website"}
        </button>
        <button className="danger sm" disabled={busy} onClick={remove}>
          Delete
        </button>
      </div>
    </Modal>
  );
}

/** The "Volunteers" tab of the Team & Volunteers page. */
export function VolunteersTab() {
  const { rows, loading, error, reload } = useList("volunteers", getVolunteers);
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<Volunteer | null>(null);
  const [add, setAdd] = useState(false);

  const save = async (v: Volunteer, data: Record<string, unknown>, ok: string) => {
    try {
      await updateVolunteer(v.id, data);
      toast(ok);
    } catch (e) {
      toast(messageOf(e), "err");
    }
    reload();
  };
  const remove = async (v: Volunteer) => {
    if (
      !(await confirm({
        title: "Delete volunteer?",
        text: `${v.name || "This volunteer"} will be removed permanently.`,
        ok: "Delete",
        danger: true
      }))
    )
      return;
    try {
      await deleteVolunteer(v.id);
      toast("Volunteer deleted.");
      reload();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };
  const actions = (r: Volunteer) => (
    <>
      {r.status !== "active" && (
        <button className="sm" onClick={() => save(r, { status: "active" }, `${r.name || "Volunteer"} is now active.`)}>
          {r.status === "pending" ? "Approve" : "Activate"}
        </button>
      )}
      {r.status === "active" && (
        <button className="ghost sm" onClick={() => save(r, { status: "inactive" }, `${r.name || "Volunteer"} is now inactive.`)}>
          Deactivate
        </button>
      )}
      <button
        className="ghost sm"
        onClick={() =>
          save(
            r,
            { show_on_website: !r.show_on_website },
            r.show_on_website
              ? `${r.name} is hidden from the website.`
              : r.status === "active"
                ? `${r.name} is now shown on the website.`
                : `${r.name} will be shown on the website once active.`
          )
        }
      >
        {r.show_on_website ? "Hide from website" : "Show on website"}
      </button>
      <button className="danger sm" onClick={() => remove(r)}>
        Delete
      </button>
    </>
  );

  return (
    <div>
      <p className="mut">
        Sign-ups from the website Get Involved form arrive as “pending”; approve them to count them as active. Active volunteers marked
        “Show on website” appear by name (and photo) on the About Us page under “Our Volunteers”. Click a volunteer to add a photo.
      </p>
      <DataTable<Volunteer>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          { label: "Joined", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
          {
            label: "Name",
            cell: (r) => (
              <div className="row nowrap">
                {r.photo_path ? <img src={volunteerPhotoUrl(r.photo_path)} alt="" width={32} height={32} className="avatar" /> : null}
                <b>{r.name || "—"}</b>
              </div>
            ),
            sort: (r) => (r.name || "").toLowerCase()
          },
          { label: "Contact", cell: (r) => [r.phone, r.email].filter(Boolean).join(" · ") || "—" },
          { label: "Interest", cell: (r) => r.area || "—", sort: (r) => (r.area || "").toLowerCase() },
          { label: "Status", cell: (r) => <Tag kind={r.status} />, sort: (r) => STATUSES.indexOf(r.status) },
          {
            label: "Website",
            cell: (r) => <Tag kind={onSite(r) ? "active" : "inactive"}>{onSite(r) ? "Shown" : "Hidden"}</Tag>,
            sort: (r) => (onSite(r) ? 0 : 1)
          },
          { label: "", cls: "actions", cell: (r) => <span className="row nowrap">{actions(r)}</span> }
        ]}
        search={(r) => [r.name, r.phone, r.email, r.area, r.message].join(" ")}
        searchLabel="Search name, phone, email"
        filters={[
          {
            label: "Status",
            options: [
              ["pending", "Pending approval"],
              ["active", "Active"],
              ["inactive", "Inactive"]
            ],
            test: (r, v) => r.status === v
          },
          {
            label: "Website",
            options: [
              ["shown", "Shown"],
              ["hidden", "Hidden"]
            ],
            test: (r, v) => (v === "shown") === onSite(r)
          },
          {
            label: "Interest",
            options: (rs) => [...new Set(rs.map((r) => r.area).filter(Boolean) as string[])].sort().map((a) => [a, a]),
            test: (r, v) => r.area === v
          }
        ]}
        date={{ label: "Joined", get: (r) => r.created_at }}
        sort={{ i: 0, dir: "desc" }}
        onRow={setView}
        summary={(list) => (
          <p className="mut">{`${list.length} volunteer(s) · ${list.filter((r) => r.status === "active").length} active · ${list.filter((r) => r.status === "pending").length} pending · ${list.filter(onSite).length} shown on the website`}</p>
        )}
        empty="No volunteers yet. Sign-ups from the website Get Involved form arrive here as “pending”."
        tools={<button onClick={() => setAdd(true)}>+ Add volunteer</button>}
      />
      {view && <VolunteerView volunteer={view} onClose={() => setView(null)} onChanged={reload} />}
      {add && <VolunteerForm onClose={() => setAdd(false)} onSaved={reload} />}
    </div>
  );
}
