import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteContactMessage,
  getAllContactMessages,
  getContactMessageCounts,
  getContactMessagesPage,
  setContactMessageStatus
} from "@/api/messages";
import { ServerList } from "@/components/data-table/ServerList";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, PageHeader, StatCard, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { exportExcel, fileStamp } from "@/lib/export";
import { fmtDateTime, num, stamp, timeAgo } from "@/lib/format";
import { messageOf } from "@/lib/errors";
import type { ContactMessage } from "@/types";

export const CONTACT_STATUS: Record<string, string> = { new: "New", contacted: "Contacted", closed: "Closed" };

/** Link that opens Gmail's "new message" page with the person's address, a subject and their message quoted underneath. */
function gmailReply(m: ContactMessage): string {
  const quoted = m.message ? `\n\n\n--- Your message, ${fmtDateTime(m.created_at)} ---\n${m.message}` : "";
  const q = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: m.email ?? "",
    su: "Re: your message to Sahara Jan Kalyan Samiti",
    body: `Dear ${m.name || "Sir / Madam"},${quoted}`.slice(0, 1500)
  });
  return `https://mail.google.com/mail/?${q}`;
}

/** Contact messages as an Excel file: all of them, or only those matching a search and status filter. */
export async function exportContacts(filter?: { q?: string; status?: string }): Promise<number> {
  const rows = await getAllContactMessages(filter);
  if (!rows.length) return 0;
  await exportExcel({
    sheet: "Contact messages",
    fileName: `contact-messages-${fileStamp()}.xlsx`,
    head: ["Received", "Name", "Email", "Phone", "Message", "Status"],
    rows: rows.map((r) => [
      stamp(r.created_at),
      r.name || "",
      r.email || "",
      r.phone || "",
      r.message || "",
      CONTACT_STATUS[r.status] || r.status
    ]),
    widths: [18, 26, 34, 18, 70, 14]
  });
  return rows.length;
}

/** Deletes a message after asking. Returns true when it was deleted. */
export function useDeleteContact(after: () => void) {
  const confirm = useConfirm();
  const toast = useToast();
  return async (m: ContactMessage): Promise<boolean> => {
    if (
      !(await confirm({
        title: "Delete message?",
        text: `The message from ${m.name || m.email || "this person"} will be removed permanently. This cannot be undone.`,
        ok: "Delete message",
        danger: true
      }))
    )
      return false;
    try {
      await deleteContactMessage(m.id);
      toast("Message deleted.");
      after();
      return true;
    } catch (e) {
      toast(messageOf(e), "err");
      return false;
    }
  };
}

/** One message from the website Contact Us form: everything the person wrote, links to answer, and its status. */
export function ContactDialog({ message: m, onClose, onChanged }: { message: ContactMessage; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const del = useDeleteContact(onChanged);
  const set = async (status: "new" | "contacted") => {
    try {
      await setContactMessageStatus(m.id, status);
      toast("Status updated.");
      onChanged();
      onClose();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };
  return (
    <Modal title={m.name || "Contact message"} onClose={onClose}>
      <p className="mut">
        {`Received ${fmtDateTime(m.created_at)}`} ·{" "}
        <Tag kind={m.status === "new" ? "pending" : "active"}>{CONTACT_STATUS[m.status] || m.status}</Tag>
      </p>
      <p>
        {m.email && <a href={`mailto:${m.email}`}>{m.email}</a>}
        {m.email && m.phone ? " · " : null}
        {m.phone && <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}>{m.phone}</a>}
      </p>
      <p className="pre" data-no-translate="">
        {m.message || "No message."}
      </p>
      <div className="row end">
        {m.email && (
          <a className="btn" target="_blank" rel="noopener noreferrer" href={gmailReply(m)}>
            Reply by email
          </a>
        )}
        <button type="button" className="danger" onClick={async () => (await del(m)) && onClose()}>
          Delete message
        </button>
        <div className="grow" />
        {m.status === "new" ? (
          <button type="button" onClick={() => set("contacted")}>
            Mark as contacted
          </button>
        ) : (
          <button type="button" className="ghost" onClick={() => set("new")}>
            Back to new
          </button>
        )}
      </div>
    </Modal>
  );
}

export default function Contacts() {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<ContactMessage | null>(null);
  const [busy, run] = useBusy();
  const counts = useQuery({ queryKey: ["contact-counts"], queryFn: getContactMessageCounts });
  // after a status change or a delete: this list, the numbers above it and the number next to the menu item
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["contact-counts"] });
    qc.invalidateQueries({ queryKey: ["badges"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const del = useDeleteContact(refresh);
  const c = counts.data;
  const who = (m: ContactMessage) => m.name || m.email || "this person";

  return (
    <div>
      <PageHeader title="Contact messages">People who wrote to us from the website Contact Us page.</PageHeader>
      <div className="cards">
        <StatCard label="Total messages" icon="message" value={num(c?.total)} sub="Everything received from the Contact Us page" />
        <StatCard
          label="Not answered yet"
          icon="mail"
          accent="amber"
          value={num(c?.waiting)}
          sub="Waiting for a reply"
          tone={c?.waiting ? "attn" : ""}
        />
        <StatCard label="Contacted" icon="checkCircle" accent="green" value={num(c?.contacted)} sub="Already answered" />
        <StatCard label="New messages" icon="trend" value={num(c?.recent)} sub="Received in the last 30 days" />
      </div>
      <ServerList<ContactMessage>
        queryKey="contacts"
        load={getContactMessagesPage}
        searchLabel="Search messages by name, email, phone or text"
        searchPlaceholder="Search messages…"
        statuses={Object.entries(CONTACT_STATUS)}
        headers={["Name", "Message", "Status", "Received", ""]}
        empty="No contact messages yet. Messages sent from the website Contact Us page appear here."
        emptyFiltered="No messages match these filters."
        tools={(filter) => (
          <Button
            className="ghost"
            busy={busy}
            busyText="Exporting…"
            onClick={() =>
              run(async () => {
                const n = await exportContacts(filter);
                toast(n ? `Exported ${n} contact message(s).` : "There are no contact messages to export.", n ? "ok" : "err");
              }).catch((e) => toast(messageOf(e), "err"))
            }
          >
            Export Excel
          </Button>
        )}
        row={(m) => (
          <>
            <td>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(m);
                }}
              >
                <b>{m.name || m.email || "Unnamed"}</b>
              </a>
              <div className="mut">{[m.email, m.phone].filter(Boolean).join(" · ")}</div>
            </td>
            <td>
              <div className="contact-msg" data-no-translate="">
                {m.message || ""}
              </div>
            </td>
            <td>
              <Tag kind={m.status === "new" ? "pending" : "active"}>{CONTACT_STATUS[m.status] || m.status}</Tag>
            </td>
            <td title={fmtDateTime(m.created_at)}>{timeAgo(m.created_at)}</td>
            <td className="actions">
              <button type="button" className="ghost sm" aria-label={`View message from ${who(m)}`} onClick={() => setOpen(m)}>
                View
              </button>
              <button type="button" className="danger sm" aria-label={`Delete message from ${who(m)}`} onClick={() => del(m)}>
                Delete
              </button>
            </td>
          </>
        )}
      />
      {open && <ContactDialog message={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}
