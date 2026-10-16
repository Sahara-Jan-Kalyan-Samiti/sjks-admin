import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteDocumentRequest,
  deleteRequestAttachment,
  getDefaultMessage,
  getDocumentRequest,
  getDocumentRequests,
  getRequestAttachments,
  getRequestFileUrl,
  sendRequestDocuments,
  updateDocumentRequest,
  uploadRequestAttachment
} from "@/api/requests";
import { DataTable } from "@/components/data-table/DataTable";
import { Field } from "@/components/forms/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button, KeyValue, Msg, PageHeader, Spinner, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { backendConfigured } from "@/lib/backend";
import { messageOf } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import type { DocumentRequest } from "@/types";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.zip,.mp3,.m4a,.wav,.ogg";
const STATUS_ORDER = ["new", "sent", "completed"];

function RequestDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [busy, run] = useBusy();
  const { data: r } = useQuery({ queryKey: ["document_request", id], queryFn: () => getDocumentRequest(id) });
  const files = useQuery({ queryKey: ["request_attachments", id], queryFn: () => getRequestAttachments(id) });
  const mail = useQuery({
    queryKey: ["request_default_message", id],
    queryFn: () => getDefaultMessage(id),
    enabled: backendConfigured,
    retry: false
  });
  const [note, setNote] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);

  if (!r)
    return (
      <Modal title="Document request" onClose={onClose}>
        <Spinner />
      </Modal>
    );
  const message = note ?? mail.data?.message ?? r.admin_message ?? "";
  const mailSubject = subject ?? `Your document request ${r.reference || ""}`.trim();
  const refreshFiles = () => qc.invalidateQueries({ queryKey: ["request_attachments", id] });
  const attempt = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await run(fn);
      if (ok) toast(ok);
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };
  const setStatus = (status: string, text: string) =>
    attempt(async () => {
      await updateDocumentRequest(id, { status, admin_message: message });
      onChanged();
      onClose();
    }, text);

  return (
    <Modal title="Document request" onClose={onClose}>
      <p>
        <Tag kind={r.status} />{" "}
        <span className="mut">{`${r.reference || ""} · received ${fmtDate(r.created_at)}${r.sent_at ? " · sent " + fmtDate(r.sent_at) : ""}`}</span>
      </p>
      <div className="kvs">
        <KeyValue label="Requester">{r.name}</KeyValue>
        <KeyValue label="Organisation">{r.organisation}</KeyValue>
        <KeyValue label="Email">{r.email}</KeyValue>
        <KeyValue label="Phone">{r.phone}</KeyValue>
        <KeyValue label="Request">{`${r.request_type || ""}: ${r.document_type || ""}${r.financial_year ? " (" + r.financial_year + ")" : ""}`}</KeyValue>
        <KeyValue label="Purpose">{r.purpose}</KeyValue>
        <KeyValue label="Delivery">{r.delivery}</KeyValue>
        <KeyValue label="Postal address">{r.delivery_address}</KeyValue>
      </div>
      {r.message && <KeyValue label="Message from requester">{r.message}</KeyValue>}

      <h2>Documents to send</h2>
      <ul className="files">
        {files.isLoading ? (
          <li className="mut">Loading…</li>
        ) : files.data?.length ? (
          files.data.map((a) => (
            <li key={a.id}>
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  attempt(async () => window.open(await getRequestFileUrl(a.storage_path), "_blank", "noopener"));
                }}
              >
                {a.filename}
              </a>
              <span className="mut">{`${Math.round((a.size_bytes || 0) / 1024)} KB`}</span>
              <button
                className="danger sm"
                onClick={() =>
                  attempt(async () => {
                    await deleteRequestAttachment(a);
                    refreshFiles();
                  })
                }
              >
                Remove
              </button>
            </li>
          ))
        ) : (
          <li className="mut">No attachments yet.</li>
        )}
      </ul>
      <Field label="Add document(s) (PDF, image, audio, Office)">
        <input
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          onChange={async (e) => {
            const picked = [...(e.target.files ?? [])];
            e.target.value = "";
            for (const f of picked) {
              try {
                await run(() => uploadRequestAttachment(id, f));
              } catch (err) {
                toast(messageOf(err), "err");
                break;
              }
            }
            refreshFiles();
          }}
        />
      </Field>

      {backendConfigured ? (
        <>
          <Field label="Subject of the e-mail">
            <input value={mailSubject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Message to the requester (also kept as the internal note)">
            <textarea rows={9} value={message} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {mail.data && !mail.data.mailReady && (
            <Msg kind="info">
              E-mail is not configured on the backend (SMTP). You can still download the documents and send them yourself, then mark the
              request as sent.
            </Msg>
          )}
          <div className="row">
            <Button
              busy={busy}
              busyText="Sending…"
              disabled={!mail.data?.mailReady || !files.data?.length}
              onClick={() =>
                attempt(async () => {
                  await sendRequestDocuments(id, mailSubject, message);
                  onChanged();
                  onClose();
                }, "Documents e-mailed.")
              }
            >
              E-mail documents to requester
            </Button>
          </div>
        </>
      ) : (
        <>
          <Msg kind="info">
            Sending e-mail needs the backend (set VITE_API_URL). Download the documents above and send them yourself, then mark the request
            as sent.
          </Msg>
          <Field label="Internal note">
            <textarea rows={5} value={message} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </>
      )}

      <div className="row">
        <button className="ghost" disabled={busy} onClick={() => setStatus("sent", "Marked as sent.")}>
          Mark as sent
        </button>
        <button className="ghost" disabled={busy} onClick={() => setStatus("completed", "Marked completed.")}>
          Mark completed
        </button>
        {r.status !== "new" && (
          <button className="ghost" disabled={busy} onClick={() => setStatus("new", "Back to pending.")}>
            Back to pending
          </button>
        )}
        <button
          className="danger"
          disabled={busy}
          onClick={async () => {
            if (
              !(await confirm({
                title: "Delete request?",
                text: "This document request will be removed permanently.",
                ok: "Delete",
                danger: true
              }))
            )
              return;
            attempt(async () => {
              await deleteDocumentRequest(id);
              onChanged();
              onClose();
            }, "Request deleted.");
          }}
        >
          Delete request
        </button>
      </div>
    </Modal>
  );
}

export default function DocumentRequests() {
  const { rows, loading, error, reload } = useList("document_requests", getDocumentRequests);
  const [open, setOpen] = useState<DocumentRequest | null>(null);
  return (
    <div>
      <PageHeader title="Certificate / document requests">
        Showing pending requests first. Change the Status filter to see sent and completed ones.
      </PageHeader>
      <DataTable<DocumentRequest>
        rows={rows}
        loading={loading}
        error={error}
        columns={[
          { label: "Received", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at, firstDir: "desc" },
          { label: "Ref", cell: (r) => r.reference, sort: (r) => r.reference || "" },
          {
            label: "Requester",
            cell: (r) => (
              <div>
                {r.name || "—"}
                {r.organisation ? <div className="mut">{r.organisation}</div> : null}
              </div>
            ),
            sort: (r) => (r.name || "").toLowerCase()
          },
          {
            label: "Document",
            cell: (r) => (
              <div>
                {r.document_type || "—"}
                <div className="mut">{[r.request_type, r.financial_year].filter(Boolean).join(" · ")}</div>
              </div>
            ),
            sort: (r) => r.document_type || ""
          },
          { label: "Status", cell: (r) => <Tag kind={r.status} />, sort: (r) => STATUS_ORDER.indexOf(r.status) }
        ]}
        search={(r) => [r.reference, r.name, r.organisation, r.email, r.phone, r.document_type, r.purpose, r.message].join(" ")}
        searchLabel="Search ref, name, email, document"
        filters={[
          {
            label: "Status",
            value: "new",
            options: [
              ["new", "Pending"],
              ["sent", "Sent"],
              ["completed", "Completed"]
            ],
            test: (r, v) => r.status === v
          },
          {
            label: "Type",
            options: [
              ["Certificate", "Certificate"],
              ["Audit report", "Audit report"]
            ],
            test: (r, v) => r.request_type === v
          }
        ]}
        date={{ label: "Received", get: (r) => r.created_at }}
        sort={{ i: 0, dir: "desc" }}
        onRow={setOpen}
        empty="No document requests yet. Requests from the website Transparency page arrive here."
      />
      {open && <RequestDetail id={open.id} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
