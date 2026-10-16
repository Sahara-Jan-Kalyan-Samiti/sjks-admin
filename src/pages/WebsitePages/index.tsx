import { useState } from "react";
import { getPageContent, savePageContent } from "@/api/content";
import pageTextData from "@/data/generated/page-texts.json";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Button, Msg, PageHeader, Panel, Spinner, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDateTime } from "@/lib/format";
import { site } from "@/config/organisation";
import type { PageContentRow } from "@/types";

interface PageText {
  key: string;
  page: string;
  label: string;
  text: string;
  long?: boolean;
  section?: string;
}
const pageTexts = pageTextData.texts as PageText[];
const MAX = pageTextData.max as number;

// Website address of each page, for the "View this page" link.
const PATHS: Record<string, string> = {
  "Home: Impact Numbers": "/",
  "About Us": "/about",
  "Our Projects": "/projects",
  "Medical Facilities": "/projects/medical-facilities",
  Memberships: "/memberships",
  "Photo & Video Gallery": "/media",
  "Latest News": "/news",
  "Events Calendar": "/events",
  "Transparency & Reports": "/transparency",
  "Get Involved": "/get-involved",
  "Contact Us": "/contact",
  Donate: "/donate",
  "Privacy Policy": "/privacy",
  "Terms of Use": "/terms",
  "DPDP Compliance Notice": "/dpdp"
};
const pages = [...new Set(pageTexts.map((x) => x.page))];

/** One page of the website: every text on it in a box, saved together with the page's "Save changes" button. */
function PageForm({ page, saved, reload }: { page: string; saved: Record<string, PageContentRow>; reload: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const items = pageTexts.filter((x) => x.page === page);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((x) => [x.key, saved[x.key]?.value ?? x.text]))
  );
  const set = (key: string, v: string) => setValues((o) => ({ ...o, [key]: v }));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const empty = items.find((x) => !values[x.key].trim());
    if (empty) return toast(`"${empty.label}" is empty. Type the text, or press "Use original".`, "err");
    // only what differs from the saved state is sent: new wording is stored, wording equal to the original removes its row
    const changed: { key: string; value: string }[] = [];
    const reset: string[] = [];
    for (const x of items) {
      const value = values[x.key].trim();
      const was = saved[x.key]?.value;
      if (value === x.text) {
        if (was !== undefined) reset.push(x.key);
      } else if (value !== was) changed.push({ key: x.key, value });
    }
    if (!changed.length && !reset.length) return toast("Nothing to save: no text was changed.");
    try {
      await run(() => savePageContent(changed, reset));
      toast(`${page} saved. The website shows the new text now.`);
      reload();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }
  async function resetAll() {
    if (
      !(await confirm({
        title: `Put back all original text on ${page}?`,
        text: "Every text on this page goes back to its original wording. Your changes on this page are removed.",
        ok: "Put back originals",
        danger: true
      }))
    )
      return;
    try {
      await savePageContent(
        [],
        items.map((x) => x.key)
      );
      toast(`${page} is back to its original text.`);
      reload();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  const body: React.ReactNode[] = [];
  items.forEach((x, n) => {
    // a number and its text ("...value" then "...label") share one line: no label above each box, just the two boxes
    const pairOf = x.key.endsWith(".label") && items[n - 1]?.key === x.key.replace(/label$/, "value") ? items[n - 1] : null;
    const paired = !!pairOf || (x.key.endsWith(".value") && items[n + 1]?.key === x.key.replace(/value$/, "label"));
    const changed = values[x.key].trim() !== x.text;
    const state = (
      <>
        {changed && !paired ? <Tag kind="pending">Changed</Tag> : null}
        {changed ? (
          <button type="button" className="ghost sm" title={`Original: ${x.text}`} onClick={() => set(x.key, x.text)}>
            {paired ? "Undo" : "Use original"}
          </button>
        ) : null}
      </>
    );
    const input = x.long ? (
      <textarea
        name={x.key}
        rows={Math.min(8, Math.max(3, Math.ceil(x.text.length / 90)))}
        maxLength={MAX}
        value={values[x.key]}
        onChange={(e) => set(x.key, e.target.value)}
      />
    ) : (
      <input
        name={x.key}
        maxLength={MAX}
        value={values[x.key]}
        aria-label={paired ? x.label : undefined}
        onChange={(e) => set(x.key, e.target.value)}
      />
    );
    if (x.section && x.section !== items[n - 1]?.section) {
      body.push(
        <h4 className="pt-head" key={`${x.key}-head`}>
          {x.section}
        </h4>
      );
      if (paired)
        body.push(
          <div className="pt-pair pt-cols mut" key={`${x.key}-cols`}>
            <span>Number</span>
            <span>Text shown with it</span>
          </div>
        );
    }
    if (pairOf) {
      body.push(
        <div className="pt-pair" key={x.key}>
          <input
            name={pairOf.key}
            maxLength={MAX}
            value={values[pairOf.key]}
            aria-label={pairOf.label}
            onChange={(e) => set(pairOf.key, e.target.value)}
          />
          {input}
          <span className="row nowrap">
            {values[pairOf.key].trim() !== pairOf.text && (
              <button type="button" className="ghost sm" title={`Original: ${pairOf.text}`} onClick={() => set(pairOf.key, pairOf.text)}>
                Undo
              </button>
            )}
            {state}
          </span>
        </div>
      );
    } else if (!paired) {
      body.push(
        <label key={x.key}>
          <span className="row nowrap">
            {x.label} {state}
          </span>
          {input}
        </label>
      );
    }
  });

  return (
    <form noValidate onSubmit={submit}>
      {body}
      <div className="row end">
        <button type="button" className="ghost" onClick={resetAll}>
          Put back all originals
        </button>
        <div className="grow" />
        <Button type="submit" busy={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export default function WebsitePages() {
  const { rows, loading, error, reload } = useList<PageContentRow>("page_content", getPageContent);
  const [open, setOpen] = useState(pages[0]);
  if (loading) return <Spinner />;
  if (error) return <Msg kind="err">{error}</Msg>;
  const saved = Object.fromEntries(rows.map((r) => [r.key, r]));
  return (
    <div>
      <PageHeader title="Website Pages">
        The headings and paragraphs of the website pages. Pick a page, change the text and press “Save changes”. A text you have not changed
        keeps its original wording. Changed text is shown as typed in both English and Hindi.
      </PageHeader>
      {pages.map((page) => {
        const keys = pageTexts.filter((x) => x.page === page).map((x) => x.key);
        const mine = keys.map((k) => saved[k]).filter(Boolean);
        const last = mine
          .map((r) => r.updated_at)
          .sort()
          .pop();
        return (
          <Panel key={page}>
            <details open={page === open} onToggle={(ev) => ev.currentTarget.open && setOpen(page)}>
              <summary>
                <b>{page}</b>{" "}
                <span className="mut">{`${keys.length} texts · ${mine.length ? `${mine.length} changed, last on ${fmtDateTime(last)}` : "all original"}`}</span>
              </summary>
              <p className="mut">
                <a href={site.url + (PATHS[page] || "/")} target="_blank" rel="noopener noreferrer">
                  View this page on the website ↗
                </a>
              </p>
              <PageForm page={page} saved={saved} reload={reload} />
            </details>
          </Panel>
        );
      })}
    </div>
  );
}
