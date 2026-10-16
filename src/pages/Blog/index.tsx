import { useState } from "react";
import { createBlogPost, deleteBlogPost, getBlogPosts, removeBlogImages, updateBlogPost, uploadBlogImage } from "@/api/content";
import { DataTable } from "@/components/data-table/DataTable";
import { emptySlot, Field, FileSlot, type FileSlotValue } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate, localDay, slugify } from "@/lib/format";
import { imageProblem } from "@/lib/storage";
import { site } from "@/config/organisation";
import type { BlogPost } from "@/types";

// Same groups as the website offers first. Another group can be typed in.
const CATEGORIES = ["Education", "Health", "Women Empowerment", "Environment", "Social Relief", "Volunteers", "Stories"];
const MAX_MB = 8;

function PostForm({ post, onClose, onSaved }: { post?: BlogPost; onClose: () => void; onSaved: () => void }) {
  const r = post;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [which, setWhich] = useState<"main" | "other">("main");
  const [cover, setCover] = useState<FileSlotValue>(emptySlot);
  const [photo, setPhoto] = useState<FileSlotValue>(emptySlot);
  // The main button keeps a post as it is (a new post is published); the second one switches draft ↔ published.
  const live = r ? !!r.published : true;
  const [slugTouched, setSlugTouched] = useState(!!r); // a new post takes its address from the title until the address is typed by hand
  const f = useForm({
    title: r?.title ?? "",
    slug: r?.slug ?? "",
    category: r?.category ?? CATEGORIES[0],
    published_on: r?.published_on ?? localDay(),
    author: r?.author ?? "Sahara Team",
    excerpt: r?.excerpt ?? "",
    body: r?.body ?? "",
    photo_caption: r?.photo_caption ?? ""
  });

  async function save(publish: boolean, button: "main" | "other") {
    const slug = slugify(f.values.slug);
    f.set("slug", slug);
    // a draft may be unfinished: the post text is only needed to publish
    const ok = f.validate({
      title: rules.required("Title", 200),
      slug: () => (!slug ? "Web address is required" : null),
      category: rules.required("Group", 60),
      author: rules.max("Author", 80),
      published_on: rules.required("Date"),
      excerpt: rules.max("Summary", 400),
      body: publish ? rules.required("Post", 20000) : rules.max("Post", 20000),
      photo_caption: rules.max("Caption", 300)
    });
    if (!ok) return;
    const problem = [cover, photo].map((s) => s.file && imageProblem(s.file, MAX_MB)).find(Boolean);
    if (problem) return toast(problem, "err");
    const v = f.values;
    const body: Record<string, unknown> = {
      title: v.title.trim(),
      slug,
      category: v.category.trim(),
      author: v.author.trim(),
      published_on: v.published_on,
      excerpt: v.excerpt.trim(),
      body: v.body.trim(),
      photo_caption: v.photo_caption.trim(),
      published: publish
    };
    setWhich(button);
    try {
      await run(async () => {
        const fresh: string[] = []; // files uploaded by this save
        const stale: (string | null | undefined)[] = []; // files no longer used after it
        try {
          for (const [slot, key] of [
            [cover, "cover"],
            [photo, "photo"]
          ] as const) {
            const old = r?.[`${key}_path` as "cover_path" | "photo_path"];
            if (slot.file) {
              const up = await uploadBlogImage(slot.file);
              fresh.push(up.path);
              body[`${key}_url`] = up.url;
              body[`${key}_path`] = up.path;
              stale.push(old);
            } else if (slot.cleared) {
              body[`${key}_url`] = null;
              body[`${key}_path`] = null;
              stale.push(old);
            }
          }
          await (r ? updateBlogPost(r.id, body) : createBlogPost(body));
        } catch (err) {
          await removeBlogImages(fresh); // do not leave orphan uploads behind
          throw err;
        }
        await removeBlogImages(stale);
      });
      toast(
        !publish
          ? r && live
            ? "Post moved to drafts. It is no longer on the website."
            : "Draft saved. It is not on the website until you publish it."
          : r && live
            ? "Post saved."
            : "Post published. It now shows on the website Blog page."
      );
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
        title: "Remove post?",
        text: `“${r.title}” and its photos will be removed from the website. This cannot be undone.`,
        ok: "Remove",
        danger: true
      }))
    )
      return;
    try {
      await deleteBlogPost(r);
      toast("Post removed.");
      onSaved();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  const uploading = Boolean(cover.file || photo.file);
  return (
    <Modal title={!r ? "New post" : live ? "Edit post" : "Edit draft"} onClose={onClose}>
      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          save(live, "main");
        }}
      >
        <Field label="Title *" error={f.errors.title}>
          <input
            {...f.field("title")}
            required
            maxLength={200}
            placeholder="e.g. A Mat, a Slate and a Second Chance"
            onChange={(e) => {
              f.set("title", e.target.value);
              if (!slugTouched) f.set("slug", slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Web address * (the post opens at /blog/ followed by this; small letters, numbers and hyphens)" error={f.errors.slug}>
          <input
            {...f.field("slug")}
            required
            maxLength={120}
            placeholder="a-short-name-for-the-post"
            onChange={(e) => {
              setSlugTouched(true);
              f.set("slug", e.target.value);
            }}
          />
        </Field>
        <div className="grid2">
          <Field label="Group * (choose one, or type your own)" error={f.errors.category}>
            <input {...f.field("category")} required maxLength={60} list="blog-cats" />
          </Field>
          <Field label="Date * (shown on the post; the newest comes first)" error={f.errors.published_on}>
            <input {...f.field("published_on")} type="date" required />
          </Field>
        </div>
        <Field label="Author" error={f.errors.author}>
          <input {...f.field("author")} maxLength={80} placeholder="e.g. Sahara Team" />
        </Field>
        <datalist id="blog-cats">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field
          label="Summary (one or two sentences shown on the Blog page and at the top of the post; up to 400 characters)"
          error={f.errors.excerpt}
        >
          <textarea {...f.field("excerpt")} rows={3} maxLength={400} />
        </Field>
        <Field label="Post * (leave an empty line between paragraphs)" error={f.errors.body}>
          <textarea {...f.field("body")} rows={14} maxLength={20000} />
        </Field>
        <p className="mut">Start a line with ## to make it a heading, or with &gt; to show it as a highlighted quote.</p>
        <h2>Cover photo</h2>
        <FileSlot
          value={cover}
          onChange={setCover}
          currentUrl={r?.cover_url}
          accept="image/jpeg,image/png,image/webp"
          label={`Upload a photo (JPG, PNG or WebP, up to ${MAX_MB} MB)${r?.cover_url ? ": replaces the current one" : ""}`}
        />
        <h2>Second photo</h2>
        <FileSlot
          value={photo}
          onChange={setPhoto}
          currentUrl={r?.photo_url}
          accept="image/jpeg,image/png,image/webp"
          label={`Upload a photo (JPG, PNG or WebP, up to ${MAX_MB} MB)${r?.photo_url ? ": replaces the current one" : ""}`}
        />
        <Field label="Caption of the second photo (shown under it inside the post; up to 300 characters)" error={f.errors.photo_caption}>
          <input {...f.field("photo_caption")} maxLength={300} />
        </Field>
        <p className="mut">
          {!r
            ? "Not ready yet? Save it as a draft: it stays in the admin panel only until you publish it."
            : live
              ? "This post is published: it is on the website."
              : "This post is a draft: it is not on the website until you publish it."}
        </p>
        <div className="row end">
          {r && (
            <button className="danger" type="button" onClick={remove}>
              Remove post
            </button>
          )}
          {r?.published && (
            <a className="btn ghost" href={`${site.url}/blog/${r.slug}`} target="_blank" rel="noopener noreferrer">
              View on website ↗
            </a>
          )}
          <div className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button
            type="button"
            className="ghost"
            busy={busy && which === "other"}
            busyText={uploading ? "Uploading…" : "Saving…"}
            onClick={() => save(!live, "other")}
          >
            {!r ? "Save as draft" : live ? "Move to drafts" : "Publish post"}
          </Button>
          <Button type="submit" busy={busy && which === "main"} busyText={uploading ? "Uploading…" : "Saving…"}>
            {!r ? "Publish post" : live ? "Save changes" : "Save draft"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Blog() {
  const { rows, loading, error, reload } = useList("blog_posts", getBlogPosts);
  const [form, setForm] = useState<BlogPost | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Blogs">
        Posts shown on the website Blog page, newest date first: the newest one is the large story at the top. Drafts are saved here only
        and are not on the website until published. Click a row to edit it, change its photos, publish it or remove it.
      </PageHeader>
      <DataTable<BlogPost>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          {
            label: "Cover",
            cell: (r) =>
              r.cover_url ? (
                <div className="thumbs">
                  <div>
                    <img src={r.cover_url} alt="" loading="lazy" />
                  </div>
                </div>
              ) : (
                <span className="mut">None</span>
              )
          },
          {
            label: "Post",
            cell: (r) => (
              <div>
                <b>{r.title}</b>
                {r.excerpt ? <div className="mut">{r.excerpt.length > 120 ? r.excerpt.slice(0, 120) + "…" : r.excerpt}</div> : null}
              </div>
            ),
            sort: (r) => (r.title || "").toLowerCase()
          },
          { label: "Group", cell: (r) => r.category, sort: (r) => r.category },
          { label: "Author", cell: (r) => r.author || <span className="mut">Not set</span>, sort: (r) => (r.author || "").toLowerCase() },
          { label: "Date", cell: (r) => fmtDate(r.published_on), sort: (r) => r.published_on },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Draft"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.title, r.excerpt, r.category, r.author].join(" ")}
        searchLabel="Search posts"
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
              ["draft", "Draft"]
            ],
            test: (r, x) => (x === "published") === !!r.published
          }
        ]}
        sort={{ i: 4, dir: "desc" }}
        pageSize={25}
        onRow={setForm}
        summary={(list) => (
          <p className="mut">{`${list.length} post(s) · ${list.filter((r) => r.published).length} published · ${list.filter((r) => !r.published).length} draft(s)`}</p>
        )}
        empty="No posts yet. Write one and it appears on the website under Blog."
        tools={<button onClick={() => setForm("new")}>+ New post</button>}
      />
      {form && <PostForm post={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={reload} />}
    </div>
  );
}
