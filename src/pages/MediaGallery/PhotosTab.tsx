import { useState } from "react";
import {
  createGalleryPhoto,
  deleteGalleryPhoto,
  getGalleryPhotos,
  removeGalleryPhotoFile,
  updateGalleryPhoto,
  uploadGalleryPhoto
} from "@/api/media";
import { DataTable } from "@/components/data-table/DataTable";
import { Check, Field } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import { imageProblem } from "@/lib/storage";
import type { GalleryPhoto } from "@/types";

// Same groups as the filter buttons of the website Photo Gallery. Another group can be typed in.
const CATEGORIES = [
  "Education",
  "Health",
  "Women Empowerment",
  "Environment",
  "Social Relief",
  "Solar Lantern",
  "Skill Development",
  "CSR & Volunteering"
];
const MAX_MB = 8;
const MAX_FILES = 12;
const NEW_GROUP = "\u0000new";

/**
 * The group of a photo: a drop-down that lists every group, with "New group…" as its last choice, which opens a box to type a name.
 * `onChange` receives the chosen (or typed) group name.
 */
function GroupField({
  value,
  groups,
  onChange,
  error
}: {
  value: string;
  groups: string[];
  onChange: (v: string) => void;
  error?: string;
}) {
  const all = [...new Set([...CATEGORIES, ...groups, value].filter(Boolean))];
  const [typing, setTyping] = useState(false);
  return (
    <Field label="Group * (the filter button it appears under on the website)" error={error}>
      <select
        aria-label="Group"
        value={typing ? NEW_GROUP : value}
        onChange={(e) => {
          const isNew = e.target.value === NEW_GROUP;
          setTyping(isNew);
          onChange(isNew ? "" : e.target.value);
        }}
      >
        {all.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_GROUP}>+ New group…</option>
      </select>
      {typing && (
        <input
          maxLength={60}
          placeholder="Name of the new group"
          aria-label="Name of the new group"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
const CaptionField = ({
  many,
  value,
  onChange,
  error
}: {
  many?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) => (
  <Field
    label={
      many
        ? "Caption (optional; shown under every photo you add now; up to 300 characters)"
        : "Caption (shown under the photo; up to 300 characters)"
    }
    error={error}
  >
    <textarea
      rows={2}
      maxLength={300}
      placeholder="e.g. Children studying together at a Sahara learning centre"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </Field>
);

/** Add one or several photos at once: they share the group and caption typed here (each can be edited afterwards). */
function AddPhotos({ groups, onClose, onSaved }: { groups: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, run] = useBusy();
  const [files, setFiles] = useState<File[]>([]);
  const f = useForm({ category: CATEGORIES[0], caption: "", published: true });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ category: rules.required("Group", 60), caption: rules.max("Caption", 300) })) return;
    if (!files.length) return toast("Choose at least one photo.", "err");
    if (files.length > MAX_FILES) return toast(`Add up to ${MAX_FILES} photos at a time.`, "err");
    const problem = files.map((x) => imageProblem(x, MAX_MB, "photos")).find(Boolean);
    if (problem) return toast(problem, "err");
    const b = { category: f.values.category.trim(), caption: f.values.caption.trim(), published: f.values.published };
    let done = 0;
    try {
      await run(async () => {
        for (const file of files) {
          const up = await uploadGalleryPhoto(file);
          try {
            await createGalleryPhoto({ ...b, ...up });
          } catch (err) {
            await removeGalleryPhotoFile(up.storage_path); // do not leave an orphan upload behind
            throw err;
          }
          done++;
        }
      });
      toast(`${done} photo(s) added. They now show first in the website Photo Gallery.`);
      onSaved();
      onClose();
    } catch (e) {
      toast(done ? `${done} photo(s) added, then: ${messageOf(e)}` : messageOf(e), "err");
      if (done) onSaved();
    }
  }

  return (
    <Modal title="Add photos" onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label={`Photos * (JPG, PNG or WebP, up to ${MAX_MB} MB each; you can choose up to ${MAX_FILES} together)`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
        </Field>
        <GroupField value={f.values.category} groups={groups} onChange={(v) => f.set("category", v)} error={f.errors.category} />
        <CaptionField many value={f.values.caption} onChange={(v) => f.set("caption", v)} error={f.errors.caption} />
        <Check {...f.check("published")}>Published (visible on the website Photo Gallery)</Check>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} busyText="Uploading…">
            Add photos
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditPhoto({
  photo: r,
  groups,
  onClose,
  onSaved
}: {
  photo: GalleryPhoto;
  groups: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const f = useForm({ category: r.category, caption: r.caption ?? "", published: !!r.published });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ category: rules.required("Group", 60), caption: rules.max("Caption", 300) })) return;
    try {
      await run(() =>
        updateGalleryPhoto(r.id, { category: f.values.category.trim(), caption: f.values.caption.trim(), published: f.values.published })
      );
      toast("Photo saved.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  async function remove() {
    if (
      !(await confirm({
        title: "Remove photo?",
        text: "This photo will be removed from the website Photo Gallery. This cannot be undone.",
        ok: "Remove photo",
        danger: true
      }))
    )
      return;
    try {
      await deleteGalleryPhoto(r);
      toast("Photo removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  return (
    <Modal title="Edit photo" onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <div className="photo-preview">
          <a href={r.image_url} target="_blank" rel="noopener noreferrer">
            <img src={r.image_url} alt="" />
          </a>
        </div>
        <GroupField value={f.values.category} groups={groups} onChange={(v) => f.set("category", v)} error={f.errors.category} />
        <CaptionField value={f.values.caption} onChange={(v) => f.set("caption", v)} error={f.errors.caption} />
        <Check {...f.check("published")}>Published (visible on the website Photo Gallery)</Check>
        <div className="row end">
          <button className="danger" type="button" onClick={remove}>
            Remove photo
          </button>
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The "Photos" tab of the Media & Gallery page. */
export function PhotosTab() {
  const { rows, loading, error, reload } = useList("gallery_photos", getGalleryPhotos);
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<GalleryPhoto | null>(null);
  const groups = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();

  /** Drop-down on a row: moves the photo to another slideshow group straight away. "New group…" opens the edit form. */
  const rowGroup = (r: GalleryPhoto) => {
    const all = [...new Set([...CATEGORIES, ...groups, r.category].filter(Boolean))];
    return (
      <select
        aria-label={`Slideshow group of this photo (${r.category})`}
        value={r.category}
        onChange={async (e) => {
          if (e.target.value === NEW_GROUP) return setEdit(r);
          try {
            await updateGalleryPhoto(r.id, { category: e.target.value });
            toast(`Moved to “${e.target.value}”.`);
          } catch (err) {
            toast(messageOf(err), "err");
          }
          reload();
        }}
      >
        {all.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_GROUP}>+ New group…</option>
      </select>
    );
  };

  return (
    <div>
      <p className="mut">
        Every photo of the website Photo Gallery (Media & Gallery), group by group. Photos you add show first on the website, newest first,
        before the ones that came with it. On the website, clicking a photo plays a slideshow of the photos in the same group, so the group
        you choose here decides which slideshow a photo belongs to. Use the drop-down on a row to move a photo to another slideshow group,
        or click the photo to change its caption, hide it or remove it.
      </p>
      <DataTable<GalleryPhoto>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Photo",
            cell: (r) => (
              <div className="thumbs">
                <div>
                  <img src={r.image_url} alt="" loading="lazy" />
                </div>
              </div>
            )
          },
          {
            label: "Caption",
            cell: (r) =>
              r.caption ? r.caption.length > 120 ? r.caption.slice(0, 120) + "…" : r.caption : <span className="mut">No caption</span>,
            sort: (r) => (r.caption || "").toLowerCase()
          },
          { label: "Slideshow group", cell: rowGroup, sort: (r) => r.category },
          {
            label: "Added",
            cell: (r) => (r.storage_path ? fmtDate(r.created_at) : <span className="mut">Came with the website</span>),
            sort: (r) => r.created_at
          },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.caption, r.category].join(" ")}
        searchLabel="Search photos"
        filters={[
          {
            label: "Group",
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
        sort={{ i: 2, dir: "asc" }}
        pageSize={50}
        onRow={setEdit}
        summary={(list) => (
          <p className="mut">
            {`${list.length} photo(s): `}
            {[...new Set(list.map((r) => r.category))]
              .sort()
              .map((c) => `${c} ${list.filter((r) => r.category === c).length}`)
              .join(" · ")}
          </p>
        )}
        empty="No photos added yet. Add photos and they appear first in the website Photo Gallery."
        tools={<button onClick={() => setAdd(true)}>+ Add photos</button>}
      />
      {add && <AddPhotos groups={groups} onClose={() => setAdd(false)} onSaved={reload} />}
      {edit && <EditPhoto photo={edit} groups={groups} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
