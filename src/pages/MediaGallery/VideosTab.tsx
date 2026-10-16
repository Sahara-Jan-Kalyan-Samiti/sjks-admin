import { useState } from "react";
import { createVideo, deleteVideo, getVideos, updateVideo, youtubeId, youtubeLink, youtubeThumb } from "@/api/media";
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
import type { GalleryVideo } from "@/types";

function VideoForm({ video, onClose, onSaved }: { video?: GalleryVideo; onClose: () => void; onSaved: () => void }) {
  const v = video;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const f = useForm({
    url: v?.youtube_id ? youtubeLink(v.youtube_id) : "",
    title: v?.title ?? "",
    description: v?.description ?? "",
    published: v ? !!v.published : true,
    featured: !!v?.featured
  });
  const id = youtubeId(f.values.url);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (
      !f.validate({
        url: (x) => (!x ? "YouTube link is required" : youtubeId(x) ? null : "This does not look like a YouTube video link"),
        title: rules.max("Title", 160),
        description: rules.max("Description", 600)
      })
    )
      return;
    const x = f.values;
    const body: Record<string, unknown> = {
      youtube_id: youtubeId(x.url),
      title: x.title.trim(),
      description: x.description.trim(),
      published: x.published
    };
    // only sent when it changes, so saving still works on a database where the column has not been added yet
    if (x.featured !== !!v?.featured) body.featured = x.featured;
    try {
      await run(() => (v ? updateVideo(v.id, body) : createVideo(body)));
      toast(v ? "Video saved." : "Video added. It now shows after the earlier videos on the website.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  async function remove() {
    if (
      !v ||
      !(await confirm({
        title: "Remove video?",
        text: "It will be removed from the website Video Gallery. The video itself stays on YouTube.",
        ok: "Remove video",
        danger: true
      }))
    )
      return;
    try {
      await deleteVideo(v.id);
      toast("Video removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <Modal title={v ? "Edit video" : "Add video"} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="YouTube link" error={f.errors.url}>
          <input {...f.field("url")} required placeholder="https://www.youtube.com/watch?v=..." />
        </Field>
        <div className="thumbs">
          {id ? (
            <div>
              <img src={youtubeThumb(id)} alt="Video preview" />
            </div>
          ) : null}
        </div>
        <Field label="Title (shown under the video; optional)" error={f.errors.title}>
          <input {...f.field("title")} maxLength={160} />
        </Field>
        <Field label="Description (shown under the title; optional, up to 600 characters)" error={f.errors.description}>
          <textarea {...f.field("description")} rows={4} maxLength={600} />
        </Field>
        <Check {...f.check("published")}>Published (visible on the website Video Gallery)</Check>
        <Check {...f.check("featured")}>
          Large video (shows as a big tile on the website, like the large photos; untick for a small tile)
        </Check>
        <div className="row end">
          {v && (
            <button className="danger" type="button" onClick={remove}>
              Remove video
            </button>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            {v ? "Save changes" : "Add video"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type Row = GalleryVideo & { n: number };

/** The "Videos" tab of the Media & Gallery page. `onCount(n)` tells the page how many videos there are. */
export function VideosTab() {
  const { rows, loading, error, reload } = useList("gallery_videos", async () => (await getVideos()).map((r, i) => ({ ...r, n: i + 1 })));
  const [form, setForm] = useState<GalleryVideo | "new" | null>(null);
  return (
    <div>
      <p className="mut">
        YouTube videos shown on the website under Media & Gallery. They appear left to right in this order; a new video goes after the last
        one. Click a video to edit or remove it.
      </p>
      <p className="mut">
        With two or more published videos the website shows them as a tile grid like the photo gallery. A tile opens the video with its
        title and description.
      </p>
      <p className="mut">
        To make a video a big tile, open it and tick “Large video”; untick it for a small tile. You can have as many large videos as you
        like. If none is marked, the first video is shown large.
      </p>
      <DataTable<Row>
        rows={rows as Row[]}
        loading={loading}
        error={error}
        columns={[
          { label: "Order", cell: (r) => r.n, sort: (r) => r.n, cls: "num" },
          {
            label: "Video",
            cell: (r) => (
              <div className="thumbs">
                <div>
                  <img src={youtubeThumb(r.youtube_id)} alt="" />
                </div>
              </div>
            )
          },
          {
            label: "Title",
            cell: (r) => (
              <div>
                <b>{r.title || "Untitled"}</b>
                {r.featured ? (
                  <>
                    {" "}
                    <Tag kind="active">Large video</Tag>
                  </>
                ) : null}
                {r.description ? (
                  <div className="mut">{r.description.length > 110 ? r.description.slice(0, 110) + "…" : r.description}</div>
                ) : null}
                <div className="mut">
                  <a href={youtubeLink(r.youtube_id)} target="_blank" rel="noopener noreferrer">
                    Open on YouTube ↗
                  </a>
                </div>
              </div>
            ),
            sort: (r) => (r.title || "").toLowerCase()
          },
          { label: "Added", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Hidden"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.title, r.description, r.youtube_id].join(" ")}
        searchLabel="Search videos"
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
        sort={{ i: 0, dir: "asc" }}
        onRow={setForm}
        empty="No videos yet. Add a YouTube link and it appears in the website Video Gallery."
        tools={<button onClick={() => setForm("new")}>+ Add video</button>}
      />
      {form && <VideoForm video={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
