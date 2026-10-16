import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminPhotoUrl, createAdmin, getActivityLog, getAdminsList, removeAdminPhoto, setAdminPhoto, updateAdmin } from "@/api/people";
import { useAuth, useMe } from "@/auth/AuthProvider";
import { DataTable } from "@/components/data-table/DataTable";
import { Field } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, Panel, StatCard, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { backendConfigured } from "@/lib/backend";
import { messageOf } from "@/lib/errors";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { imageProblem } from "@/lib/storage";
import type { ActivityEntry, AdminListItem } from "@/types";

const MAX_MB = 5;
const ACTION: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  emailed: "E-mailed",
  uploaded: "Uploaded"
};
const tone = (a: string) => ({ created: "active", updated: "new", deleted: "cancelled" })[a] || "";
const ROLE = { admin: "Administrator", editor: "Editor", viewer: "Viewer" } as const;

const Face = ({ a }: { a: AdminListItem }) =>
  a.photo_path ? (
    <img className="avatar" alt="" src={adminPhotoUrl(a.photo_path)} />
  ) : (
    <span className="avatar" aria-hidden="true">
      {(a.email || "A")[0].toUpperCase()}
    </span>
  );

/** Add an admin: just an email, a password and (optionally) a photo. The account is created by the backend. */
function AddAdmin({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, run] = useBusy();
  const [photo, setPhoto] = useState<File | null>(null);
  const f = useForm({ email: "", password: "", display_name: "" });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        email: (v) => (!v ? "Email is required" : rules.email(v, {})),
        password: (v) => (v.length < 8 ? "Use at least 8 characters" : v.length > 72 ? "Use 72 characters or fewer" : null),
        display_name: rules.max("Name", 80)
      })
    )
      return;
    const problem = photo && imageProblem(photo, MAX_MB);
    if (problem) return toast(problem, "err");
    try {
      const email = f.values.email.trim().toLowerCase();
      await run(async () => {
        const a = await createAdmin({ email, password: f.values.password, display_name: f.values.display_name.trim() || undefined });
        if (photo) {
          try {
            await setAdminPhoto(a, photo);
          } catch (err) {
            toast(`Admin added, but the photo could not be saved: ${messageOf(err)}`, "err");
          }
        }
      });
      toast(`Admin added. ${email} can sign in now.`);
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  return (
    <Modal title="Add admin" onClose={onClose}>
      <form noValidate autoComplete="off" onSubmit={submit}>
        {!backendConfigured && (
          <p className="msg info">Creating admins is done by the backend. Set VITE_API_URL to the sjks-backend address.</p>
        )}
        <Field label="Email (e.g. name@gmail.com) *" error={f.errors.email}>
          <input {...f.field("email")} type="email" required autoComplete="off" maxLength={160} />
        </Field>
        <Field label="Password * (at least 8 characters; tell it to the new admin yourself)" error={f.errors.password}>
          <input {...f.field("password")} type="password" required autoComplete="new-password" maxLength={72} />
        </Field>
        <Field label="Name (optional)" error={f.errors.display_name}>
          <input {...f.field("display_name")} maxLength={80} />
        </Field>
        <Field label={`Photo (optional; JPG, PNG or WebP, up to ${MAX_MB} MB)`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </Field>
        <p className="mut">The new admin signs in on this page with that email and password, and can do everything you can.</p>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} busyText="Adding…" disabled={!backendConfigured}>
            Add admin
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Click an admin: change the photo, or switch the account off / on. */
function EditAdmin({ admin, onClose, onChanged }: { admin: AdminListItem; onClose: () => void; onChanged: () => void }) {
  const me = useMe();
  const { refresh } = useAuth();
  const toast = useToast();
  const [a, setA] = useState(admin);
  const [busy, run] = useBusy();

  const attempt = async (fn: () => Promise<void>, ok: string) => {
    try {
      await run(fn);
      toast(ok);
      onChanged();
      if (a.id === me.id) refresh(); // your own photo is also in the top bar
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };

  return (
    <Modal title={a.email} onClose={onClose}>
      <p>
        <Tag kind={a.is_active ? "active" : "inactive"}>{a.is_active ? "Active" : "Switched off"}</Tag>
        {a.id === me.id ? <span className="mut"> This is you.</span> : null}
      </p>
      <h2>Photo</h2>
      <div className="thumbs">
        {a.photo_path ? (
          <div>
            <img src={adminPhotoUrl(a.photo_path)} alt={`Photo of ${a.email}`} />
            <button
              className="danger sm"
              type="button"
              disabled={busy}
              onClick={() => attempt(async () => setA({ ...a, photo_path: (await removeAdminPhoto(a)).photo_path }), "Photo removed.")}
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="mut">No photo yet: the first letter of the email is shown instead.</p>
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
            attempt(async () => setA({ ...a, photo_path: (await setAdminPhoto(a, file)).photo_path }), "Photo saved.");
          }}
        />
      </Field>
      <div className="row end">
        {a.id !== me.id && (
          <button
            type="button"
            className={a.is_active ? "danger" : ""}
            disabled={busy}
            onClick={() =>
              attempt(
                async () => {
                  await updateAdmin(a.id, { is_active: !a.is_active });
                  onClose();
                },
                a.is_active ? `${a.email} can no longer sign in to this panel.` : `${a.email} can sign in again.`
              )
            }
          >
            {a.is_active ? "Switch off this admin" : "Switch this admin back on"}
          </button>
        )}
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

export default function Admins() {
  const me = useMe();
  const admins = useQuery({ queryKey: ["admins"], queryFn: () => getAdminsList(me) });
  const log = useQuery({ queryKey: ["activity_log"], queryFn: () => getActivityLog(1000) });
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<AdminListItem | null>(null);

  return (
    <div>
      <PageHeader title="Admins & activity">Who can sign in, and every change made in this admin panel.</PageHeader>
      <div className="cards">
        <StatCard label="Signed in as" value={me.email} sub={ROLE[me.role]} />
        <StatCard label="Admin users" value={admins.data?.length ?? "…"} sub="Accounts that can open this panel" />
        <StatCard
          label="E-mail sending"
          value={backendConfigured ? "Via backend" : "Off"}
          sub={
            backendConfigured ? "Receipts, documents and broadcasts go through sjks-backend" : "Set VITE_API_URL to connect sjks-backend"
          }
          tone={backendConfigured ? "" : "attn"}
        />
      </div>
      <Panel title="Admin users">
        <DataTable<AdminListItem>
          rows={admins.data ?? []}
          loading={admins.isLoading}
          error={admins.error ? messageOf(admins.error) : null}
          columns={[
            {
              label: "Admin",
              cell: (a) => (
                <div className="row nowrap">
                  <Face a={a} />
                  <b>
                    {a.email}
                    {a.id === me.id ? <span className="mut"> (you)</span> : null}
                  </b>
                </div>
              ),
              sort: (a) => a.email
            },
            {
              label: "Status",
              cell: (a) => <Tag kind={a.is_active ? "active" : "inactive"}>{a.is_active ? "Active" : "Switched off"}</Tag>,
              sort: (a) => (a.is_active ? 0 : 1)
            },
            { label: "Role", cell: (a) => <Tag kind={a.role} />, sort: (a) => a.role },
            { label: "Created", cell: (a) => fmtDateTime(a.created_at), sort: (a) => a.created_at },
            {
              label: "Last sign-in",
              cell: (a) => (a.last_login_at ? `${fmtDateTime(a.last_login_at)} · ${timeAgo(a.last_login_at)}` : "Never"),
              sort: (a) => a.last_login_at || "",
              firstDir: "desc"
            },
            { label: "Logged actions", cell: (a) => a.actions, sort: (a) => a.actions, cls: "num", firstDir: "desc" }
          ]}
          sort={{ i: 0, dir: "asc" }}
          empty="No admins found."
          onRow={setEdit}
          tools={
            <button type="button" onClick={() => setAdd(true)}>
              + Add admin
            </button>
          }
        />
        <p className="mut">
          Use “+ Add admin” to give someone access with an email and a password. Click an admin to change their photo or switch their access
          off.
        </p>
      </Panel>
      <h2 className="sec">Activity log</h2>
      <DataTable<ActivityEntry>
        rows={log.data ?? []}
        loading={log.isLoading}
        error={log.error ? messageOf(log.error) : null}
        columns={[
          {
            label: "When",
            cell: (r) => <span title={fmtDateTime(r.created_at)}>{fmtDateTime(r.created_at)}</span>,
            sort: (r) => r.created_at + String(r.id).padStart(9, "0"),
            firstDir: "desc"
          },
          { label: "Admin", cell: (r) => r.admin_label || "—", sort: (r) => r.admin_label || "" },
          { label: "Action", cell: (r) => <Tag kind={tone(r.action)}>{ACTION[r.action] || r.action}</Tag>, sort: (r) => r.action },
          { label: "What happened", cell: (r) => r.summary }
        ]}
        search={(r) => [r.summary, r.admin_label, r.entity].join(" ")}
        searchLabel="Search activity"
        filters={[
          {
            label: "Admin",
            options: (rs) => [...new Set(rs.map((r) => r.admin_label).filter(Boolean) as string[])].sort().map((a) => [a, a]),
            test: (r, v) => r.admin_label === v
          },
          {
            label: "Section",
            options: (rs) => [...new Set(rs.map((r) => r.entity).filter(Boolean) as string[])].sort().map((e) => [e, e]),
            test: (r, v) => r.entity === v
          },
          { label: "Action", options: Object.entries(ACTION), test: (r, v) => r.action === v }
        ]}
        date={{ label: "Date", get: (r) => r.created_at }}
        sort={{ i: 0, dir: "desc" }}
        pageSize={25}
        empty="No admin activity recorded yet. Changes made in this admin panel are logged here from now on."
      />
      {add && <AddAdmin onClose={() => setAdd(false)} onSaved={() => admins.refetch()} />}
      {edit && <EditAdmin admin={edit} onClose={() => setEdit(null)} onChanged={() => admins.refetch()} />}
    </div>
  );
}
