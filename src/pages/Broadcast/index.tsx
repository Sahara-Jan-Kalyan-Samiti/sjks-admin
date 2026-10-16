import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createTickerMessage, deleteTickerMessage, getBroadcastInfo, getTickerMessages, sendBroadcast } from "@/api/content";
import { Field, Select } from "@/components/forms/controls";
import { rules } from "@/components/forms/rules";
import { useForm } from "@/components/forms/useForm";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Button, Msg, PageHeader, Panel, Spinner, Tabs } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { useList } from "@/hooks/useList";
import { backendConfigured } from "@/lib/backend";
import { messageOf } from "@/lib/errors";
import { fmtDateTime } from "@/lib/format";

// "Live strip" = the scrolling line at the very top of every page of the website.
const MAX = 160;

function LiveStrip() {
  const { rows, loading, error, reload } = useList("ticker_messages", getTickerMessages);
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const f = useForm({ message: "" });

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ message: rules.required("Message", MAX) })) return;
    try {
      await run(() => createTickerMessage(f.values.message.trim().replace(/\s+/g, " ")));
      f.set("message", "");
      toast("Sent. It is now showing at the top of the website.");
      reload();
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <div>
      <p className="mut">
        Messages here scroll in the “Live” strip at the very top of every page of the website. A new message appears first.
      </p>
      <div className="panel">
        <form noValidate onSubmit={send}>
          <Field label={`Message (up to ${MAX} characters)`} error={f.errors.message}>
            <textarea
              {...f.field("message")}
              rows={3}
              maxLength={MAX}
              placeholder="e.g. 🎉 New event is live now: join our health camp this Sunday"
            />
          </Field>
          <div className="row">
            <Button type="submit" busy={busy} busyText="Sending…">
              Send to website
            </Button>
          </div>
        </form>
      </div>
      <h2 className="sec">Showing on the website now</h2>
      <div className="panel">
        {loading ? (
          <Spinner />
        ) : error ? (
          <Msg kind="err">{error}</Msg>
        ) : rows.length ? (
          <ul className="feed">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="grow">
                  <div className="pre">{r.message}</div>
                  <div className="mut">{`Sent ${fmtDateTime(r.created_at)}`}</div>
                </div>
                <button
                  type="button"
                  className="danger sm"
                  onClick={async () => {
                    if (
                      !(await confirm({
                        title: "Remove message?",
                        text: `“${r.message}” will stop showing on the website.`,
                        ok: "Remove",
                        danger: true
                      }))
                    )
                      return;
                    try {
                      await deleteTickerMessage(r.id);
                      toast("Message removed from the website.");
                      reload();
                    } catch (e) {
                      toast(messageOf(e), "err");
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mut">No messages. The website shows its built-in text until you send one.</p>
        )}
      </div>
    </div>
  );
}

/** E-mail to volunteers and/or donors, sent by the backend (BCC, in batches). */
function EmailBroadcast() {
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busy, run] = useBusy();
  const info = useQuery({ queryKey: ["broadcast-info"], queryFn: getBroadcastInfo, enabled: backendConfigured, retry: false });
  const f = useForm({ audience: "volunteers", subject: "", message: "" });

  if (!backendConfigured)
    return <Msg kind="info">E-mail broadcasts are sent by the backend. Set VITE_API_URL to the sjks-backend address to enable them.</Msg>;
  if (info.isLoading) return <Spinner />;
  if (info.error || !info.data) return <Msg kind="err">{messageOf(info.error)}</Msg>;
  const { counts, history, mailReady } = info.data;
  const audience = f.values.audience as "volunteers" | "donors" | "all";

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.validate({ subject: rules.required("Subject", 200), message: rules.required("Message", 5000) })) return;
    if (
      !(await confirm({
        title: "Send this e-mail?",
        text: `It goes to ${counts[audience]} recipient(s). This cannot be undone.`,
        ok: "Send"
      }))
    )
      return;
    try {
      const r = await run(() => sendBroadcast({ audience, subject: f.values.subject.trim(), message: f.values.message.trim() }));
      toast(`Sent to ${r.sent} recipient(s)${r.failed ? `, ${r.failed} failed` : ""}.`);
      f.setValues((v) => ({ ...v, subject: "", message: "" }));
      qc.invalidateQueries({ queryKey: ["broadcast-info"] });
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  return (
    <div>
      <p className="mut">
        Write an e-mail to active volunteers and/or donors with a successful donation. Recipients never see each other (BCC).
      </p>
      {!mailReady && <Msg kind="info">E-mail is not configured on the backend (SMTP), so nothing can be sent yet.</Msg>}
      <div className="panel">
        <form noValidate onSubmit={send}>
          <Field label="Send to">
            <Select
              {...f.field("audience")}
              options={[
                ["volunteers", `Active volunteers (${counts.volunteers})`],
                ["donors", `Donors (${counts.donors})`],
                ["all", `Everyone (${counts.all})`]
              ]}
            />
          </Field>
          <Field label="Subject" error={f.errors.subject}>
            <input {...f.field("subject")} maxLength={200} />
          </Field>
          <Field label="Message" error={f.errors.message}>
            <textarea {...f.field("message")} rows={8} maxLength={5000} />
          </Field>
          <div className="row">
            <Button type="submit" busy={busy} busyText="Sending…" disabled={!mailReady}>
              Send e-mail
            </Button>
          </div>
        </form>
      </div>
      <h2 className="sec">Sent e-mails</h2>
      <Panel>
        {history.length ? (
          <ul className="feed">
            {history.map((h) => (
              <li key={h.id}>
                <div className="grow">
                  <b>{h.subject}</b>
                  <div className="mut">{`${h.audience} · ${fmtDateTime(h.created_at)}`}</div>
                </div>
                <div className="feed-r">{`${h.recipients} sent${h.failed ? ` · ${h.failed} failed` : ""}`}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mut">Nothing sent yet.</p>
        )}
      </Panel>
    </div>
  );
}

export default function Broadcast() {
  const [tab, setTab] = useState("strip");
  return (
    <div>
      <PageHeader title="Broadcast message">Messages for the website's Live strip, and e-mails to volunteers and donors.</PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "strip", label: "Website Live strip", count: "" },
          { key: "email", label: "E-mail", count: "" }
        ]}
      />
      {tab === "strip" ? <LiveStrip /> : <EmailBroadcast />}
    </div>
  );
}
