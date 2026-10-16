import { useState } from "react";
import { createEvent, deleteEvent, deleteEventImage, eventImageUrl, getEvents, updateEvent, uploadEventImage } from "@/api/events";
import { DataTable } from "@/components/data-table/DataTable";
import { Field } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { messageOf } from "@/lib/errors";
import { fmtDate, localDay } from "@/lib/format";
import type { EventImage, EventRow } from "@/types";

function EventForm({
  event,
  onClose,
  onSaved,
  onCreated
}: {
  event?: EventRow;
  onClose: () => void;
  onSaved: () => void;
  onCreated: (e: EventRow) => void;
}) {
  const e = event;
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const [images, setImages] = useState<EventImage[]>(e?.images ?? []);
  // The main button keeps an event as it is (a new event is published); the second one switches draft ↔ published.
  const live = e ? !!e.published : true;
  const [which, setWhich] = useState<"main" | "other" | null>(null);
  const f = useForm({
    title: e?.title ?? "",
    event_date: e?.event_date ?? "",
    event_time: e?.event_time ?? "",
    place: e?.place ?? "",
    description: e?.description ?? ""
  });

  async function save(publish: boolean, button: "main" | "other") {
    if (
      !f.validate({
        title: rules.required("Event name", 160),
        event_date: (v) => (!v ? "Date is required" : null),
        event_time: rules.max("Time", 60),
        place: rules.max("Place", 200),
        description: rules.max("Description", 3000)
      })
    )
      return;
    setWhich(button);
    try {
      const saved = await run(() =>
        e ? updateEvent(e.id, { ...f.values, published: publish }) : createEvent({ ...f.values, published: publish })
      );
      toast(
        !e
          ? publish
            ? "Event published. You can add images now."
            : "Draft saved. You can add images now, then publish it."
          : publish === live
            ? live
              ? "Event saved."
              : "Draft saved. It is not on the website until you publish it."
            : publish
              ? "Event published. It now shows on the website Events page."
              : "Event moved to drafts. It is no longer on the website."
      );
      onSaved();
      if (e) onClose();
      else onCreated({ ...(saved as EventRow), images: [] }); // after creating, reopen so images can be added
    } catch (err) {
      toast(messageOf(err), "err");
    }
  }

  async function remove() {
    if (
      !e ||
      !(await confirm({
        title: "Delete event?",
        text: "This event and its images will be deleted. This cannot be undone.",
        ok: "Delete event",
        danger: true
      }))
    )
      return;
    try {
      await deleteEvent(e.id);
      toast("Event deleted.");
      onSaved();
      onClose();
    } catch (err) {
      toast(messageOf(err), "err");
    }
  }

  return (
    <Modal title={!e ? "New event" : live ? "Edit event" : "Edit draft"} onClose={onClose}>
      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          save(live, "main");
        }}
      >
        <div className="grid2">
          <Field label="Event name" error={f.errors.title}>
            <input {...f.field("title")} required />
          </Field>
          <Field label="Date (today or later = Upcoming, earlier = Past events)" error={f.errors.event_date}>
            <input {...f.field("event_date")} type="date" required />
          </Field>
          <Field label="Time (e.g. 10:00 AM - 2:00 PM)" error={f.errors.event_time}>
            <input {...f.field("event_time")} />
          </Field>
          <Field label="Place" error={f.errors.place}>
            <input {...f.field("place")} />
          </Field>
        </div>
        <Field label="Description" error={f.errors.description}>
          <textarea {...f.field("description")} rows={4} />
        </Field>
        <p className="mut">
          {!e
            ? "Not ready yet? Save it as a draft: it stays in the admin panel only until you publish it."
            : live
              ? "This event is published: it is on the website Events page."
              : "This event is a draft: it is not on the website until you publish it."}
        </p>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="button" className="ghost" busy={busy && which === "other"} onClick={() => save(!live, "other")}>
            {!e ? "Save as draft" : live ? "Move to drafts" : "Publish event"}
          </Button>
          <Button type="submit" busy={busy && which === "main"}>
            {!e ? "Publish event" : live ? "Save changes" : "Save draft"}
          </Button>
        </div>
      </form>

      {e ? (
        <div>
          <h2>Images (JPG/PNG/WebP, up to 6)</h2>
          <div className="thumbs">
            {images.map((img) => (
              <div key={img.id}>
                <img src={eventImageUrl(img.storage_path)} alt="" />
                <button
                  className="danger sm"
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteEventImage(img);
                      setImages((l) => l.filter((x) => x.id !== img.id));
                      onSaved();
                    } catch (err) {
                      toast(messageOf(err), "err");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <Field label="Add image">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              multiple
              onChange={async (ev) => {
                const picked = [...(ev.target.files ?? [])];
                ev.target.value = "";
                for (const file of picked) {
                  try {
                    const img = await uploadEventImage(e.id, file);
                    setImages((l) => [...l, img]);
                  } catch (err) {
                    toast(messageOf(err), "err");
                    break;
                  }
                }
                onSaved();
              }}
            />
          </Field>
          <div className="row">
            <button className="danger" type="button" onClick={remove}>
              Delete event
            </button>
          </div>
        </div>
      ) : (
        <p className="mut">Images can be added right after the event is created.</p>
      )}
    </Modal>
  );
}

export default function Events() {
  const { rows, loading, error, reload } = useList("events", getEvents);
  const [form, setForm] = useState<EventRow | "new" | null>(null);
  const today = localDay();
  return (
    <div>
      <PageHeader title="Events">Click an event to edit it, add images or publish a draft. Drafts are not on the website.</PageHeader>
      <DataTable<EventRow>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          { label: "Date", cell: (r) => fmtDate(r.event_date), sort: (r) => r.event_date },
          {
            label: "Event",
            cell: (r) => (
              <div>
                <b>{r.title}</b>
                {r.event_time ? <div className="mut">{r.event_time}</div> : null}
              </div>
            ),
            sort: (r) => r.title.toLowerCase()
          },
          { label: "Place", cell: (r) => r.place || "—", sort: (r) => (r.place || "").toLowerCase() },
          { label: "Images", cell: (r) => r.images.length, sort: (r) => r.images.length, cls: "num" },
          {
            label: "When",
            cell: (r) => <Tag kind={r.event_date >= today ? "active" : "cancelled"}>{r.event_date >= today ? "Upcoming" : "Past"}</Tag>,
            sort: (r) => (r.event_date >= today ? 0 : 1)
          },
          {
            label: "Status",
            cell: (r) => <Tag kind={r.published ? "active" : "pending"}>{r.published ? "Published" : "Draft"}</Tag>,
            sort: (r) => (r.published ? 0 : 1)
          }
        ]}
        search={(r) => [r.title, r.place, r.description, r.event_time].join(" ")}
        searchLabel="Search events"
        filters={[
          {
            label: "When",
            options: [
              ["upcoming", "Upcoming"],
              ["past", "Past"]
            ],
            test: (r, v) => (v === "upcoming") === r.event_date >= today
          },
          {
            label: "Status",
            options: [
              ["published", "Published"],
              ["draft", "Draft"]
            ],
            test: (r, v) => (v === "published") === !!r.published
          }
        ]}
        date={{ label: "Date", get: (r) => r.event_date }}
        sort={{ i: 0, dir: "desc" }}
        onRow={setForm}
        summary={(list) => <p className="mut">{`${list.length} event(s) · ${list.filter((r) => !r.published).length} draft(s)`}</p>}
        empty="No events yet. Published events appear on the website Events page."
        tools={<button onClick={() => setForm("new")}>+ New event</button>}
      />
      {form && (
        <EventForm
          key={form === "new" ? "new" : form.id}
          event={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={reload}
          onCreated={(e) => setForm(e)}
        />
      )}
    </div>
  );
}
