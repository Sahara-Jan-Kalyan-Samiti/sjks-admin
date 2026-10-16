import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardData } from "@/api/analytics";
import { getContactMessages } from "@/api/messages";
import { useMe } from "@/auth/AuthProvider";
import { BarChart, StatBars } from "@/components/ui/charts";
import { useToast } from "@/components/ui/feedback";
import { Button, EmptyState, Msg, PageHeader, Panel, Spinner, StatCard, Tag } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { backendConfigured } from "@/lib/backend";
import { messageOf } from "@/lib/errors";
import { fmtDateTime, inr, monthLabel, num, timeAgo } from "@/lib/format";
import type { ContactMessage } from "@/types";
import { ContactDialog, CONTACT_STATUS, exportContacts, useDeleteContact } from "../Contacts";
import { DonationForm } from "../Donations";
import { ProjectForm } from "../Projects";

const TYPE = { donation: "Donation", volunteer: "Volunteer", request: "Request" } as const;
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
};
const short = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`);

export default function Dashboard() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, run] = useBusy();
  const [openMessage, setOpenMessage] = useState<ContactMessage | null>(null);
  const [donationForm, setDonationForm] = useState(false);
  const [projectForm, setProjectForm] = useState(false);

  // the two parts load separately; a problem with the contact messages never hides the rest of the dashboard
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: getDashboardData });
  const contact = useQuery({ queryKey: ["dashboard-contacts"], queryFn: () => getContactMessages() });
  const reload = () =>
    ["dashboard", "dashboard-contacts", "badges", "contacts", "contact-counts", "notifications"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] })
    );
  const del = useDeleteContact(reload);

  if (dash.isLoading) return <Spinner />;
  if (dash.error || !dash.data) return <Msg kind="err">{messageOf(dash.error)}</Msg>;
  const d = dash.data;
  const c = d.counts;
  const waiting = contact.data ? contact.data.rows.filter((m) => m.status === "new").length : 0;
  const ongoing = d.ongoingProjects.website + d.ongoingProjects.added;

  const todo = [
    c.volunteers.pending ? (
      <Link
        key="v"
        to="/volunteers?tab=volunteers"
        className="chip warn"
      >{`${c.volunteers.pending} volunteer sign-up(s) awaiting approval`}</Link>
    ) : null,
    d.pendingRequests ? (
      <Link key="r" to="/requests" className="chip warn">{`${d.pendingRequests} document request(s) pending`}</Link>
    ) : null,
    d.funds.pending ? (
      <Link key="d" to="/donations" className="chip warn">{`${d.funds.pending} donation(s) with pending payment`}</Link>
    ) : null
  ].filter(Boolean);

  const projStatus = [
    { label: "Ongoing", value: c.projects.website.ongoing + c.projects.added.ongoing, cls: "ok" },
    { label: "Completed", value: c.projects.website.completed + c.projects.added.completed, cls: "dark" },
    { label: "Planned", value: c.projects.added.planned, cls: "warn" },
    { label: "Not dated (website)", value: c.projects.website["not dated"], cls: "mut" }
  ];

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${me.display_name || me.email} 👋`}
        actions={
          <button className="ghost" onClick={() => dash.refetch()}>
            Refresh
          </button>
        }
      >
        {`Here's an overview of your impact and activities · live from the database · updated ${new Date(dash.dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
      </PageHeader>
      <div className="row">
        <button onClick={() => setProjectForm(true)}>+ Add project</button>
        <button onClick={() => navigate("/broadcast")}>Broadcast message</button>
        <button onClick={() => setDonationForm(true)}>Record offline donation</button>
      </div>
      <div className="status-strip">
        {!backendConfigured && <span className="chip">● E-mail and receipts need the backend (set VITE_API_URL)</span>}
        {todo.length ? todo : <span className="chip ok">✓ Nothing waiting for approval</span>}
      </div>

      <div className="cards">
        <StatCard
          label="Total funds raised"
          value={inr(d.funds.total)}
          sub={`Online ${inr(d.funds.online)} · Offline ${inr(d.funds.offline)}`}
          href="/donations"
        />
        <StatCard
          label="Raised this month"
          value={inr(d.funds.thisMonth)}
          sub={d.funds.pending ? `${d.funds.pending} payment(s) pending` : "No pending payments"}
          href="/reports"
        />
        <StatCard
          label="Donation records"
          value={num(c.donations.records)}
          sub={`${num(c.donations.success)} successful · ${num(c.donations.pending)} pending · ${num(c.donations.failed + c.donations.cancelled + c.donations.refunded)} other`}
          href="/donations"
        />
        <StatCard
          label="Volunteers"
          value={num(c.volunteers.total)}
          sub={`${num(c.volunteers.active)} active · ${num(c.volunteers.pending)} pending · ${num(c.volunteers.inactive)} inactive`}
          href="/volunteers?tab=volunteers"
          tone={c.volunteers.pending ? "attn" : ""}
        />
        <StatCard
          label="Total projects"
          value={num(c.projects.website.total + c.projects.added.total)}
          sub={`${num(c.projects.website.total)} on website portfolio · ${num(c.projects.added.total)} added here`}
          href="/projects"
        />
        <StatCard
          label="Active projects"
          value={num(ongoing)}
          sub={`${num(c.projects.website.completed + c.projects.added.completed)} completed · ${num(c.projects.added.planned)} planned`}
          href="/projects"
        />
        <StatCard
          label="Beneficiary reach"
          value={num(d.reach.website + d.reach.added)}
          sub={`Website figure ${num(d.reach.website)} + ${num(d.reach.added)} from added projects`}
        />
        <StatCard
          label="Pending document requests"
          value={num(d.pendingRequests)}
          sub={`${num(c.requests.total)} received in total`}
          href="/requests"
          tone={d.pendingRequests ? "attn" : ""}
        />
        <StatCard
          label="Upcoming events"
          value={num(c.events.upcoming)}
          sub={`${num(c.events.published)} published · ${num(c.events.total)} in total`}
          href="/events"
        />
        <StatCard label="Admin users" value={num(c.admins)} sub="People who can sign in here" href="/admins" />
      </div>

      <div className="grid-2">
        <Panel title="Donations raised · last 12 months">
          <BarChart
            data={d.months.map((m) => ({ label: monthLabel(m.month), title: monthLabel(m.month, true), value: m.raised }))}
            format={short}
            emptyText="No successful donations in the last 12 months yet."
          />
          <Link to="/reports" className="more">
            Full analytics →
          </Link>
        </Panel>
        <section className="panel">
          <div className="row">
            <h2 className="grow" style={{ margin: 0 }}>
              Contact messages
            </h2>
            <Button
              className="ghost sm"
              busy={busy}
              busyText="Exporting…"
              onClick={() =>
                run(async () => {
                  const n = await exportContacts();
                  toast(n ? `Exported ${n} contact message(s).` : "There are no contact messages to export.", n ? "ok" : "err");
                }).catch((e) => toast(messageOf(e), "err"))
              }
            >
              Export Excel
            </Button>
          </div>
          <p className="mut">
            {contact.data
              ? `People who wrote to us from the website Contact Us page, newest first · ${contact.data.total} in total · ${waiting} not answered yet`
              : "People who wrote to us from the website Contact Us page."}
          </p>
          {contact.error ? (
            <Msg kind="err">{messageOf(contact.error)}</Msg>
          ) : contact.data?.rows.length ? (
            <ul className="feed">
              {contact.data.rows.map((m) => (
                <li key={m.id}>
                  <span className={`dot ${m.status === "new" ? "request" : "volunteer"}`} aria-hidden="true" />
                  <div className="grow">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setOpenMessage(m);
                      }}
                    >
                      {m.name || m.email || "Unnamed"}
                    </a>
                    <div className="mut">{[m.email, m.phone].filter(Boolean).join(" · ")}</div>
                    <div className="contact-msg" data-no-translate="">
                      {m.message || ""}
                    </div>
                  </div>
                  <div className="feed-r">
                    <Tag kind={m.status === "new" ? "pending" : "active"}>{CONTACT_STATUS[m.status] || m.status}</Tag>
                    <div className="mut">{timeAgo(m.created_at)}</div>
                    <div className="row nowrap contact-actions">
                      <button
                        type="button"
                        className="ghost sm"
                        aria-label={`View message from ${m.name || m.email || "this person"}`}
                        onClick={() => setOpenMessage(m)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="danger sm"
                        aria-label={`Delete message from ${m.name || m.email || "this person"}`}
                        onClick={() => del(m)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No contact messages yet. Messages sent from the website Contact Us page appear here." />
          )}
          <Link to="/messages" className="more">
            All contact messages →
          </Link>
        </section>
      </div>

      <div className="grid-3">
        <Panel title="Recent submissions">
          {d.recent.length ? (
            <ul className="feed">
              {d.recent.map((r, i) => (
                <li key={i}>
                  <span className={`dot ${r.type}`} aria-hidden="true" />
                  <div className="grow">
                    <Link to={"/" + r.page}>{r.title}</Link>
                    <div className="mut">{`${TYPE[r.type]} · ${r.sub}`}</div>
                  </div>
                  <div className="feed-r">
                    <Tag kind={r.status}>{r.status === "new" ? "pending" : r.status}</Tag>
                    <div className="mut">{timeAgo(r.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No donations, volunteer sign-ups or document requests yet. They appear here as soon as they arrive." />
          )}
        </Panel>
        <Panel title="Recent admin activity">
          {d.activity.length ? (
            <ul className="feed">
              {d.activity.map((a) => (
                <li key={a.id}>
                  <span className={`dot act-${a.action}`} aria-hidden="true" />
                  <div className="grow">
                    {a.summary}
                    <div className="mut">{a.admin_label || ""}</div>
                  </div>
                  <div className="feed-r mut" title={fmtDateTime(a.created_at)}>
                    {timeAgo(a.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Admin changes (projects, donations, volunteers, events…) will be listed here." />
          )}
          <Link to="/admins" className="more">
            Full activity log →
          </Link>
        </Panel>
        <Panel title="Projects by status">
          <StatBars items={projStatus} />
          <p className="mut">Website portfolio + projects added in admin.</p>
        </Panel>
      </div>
      <p className="mut">Funds count successful INR donations only.</p>

      {openMessage && <ContactDialog message={openMessage} onClose={() => setOpenMessage(null)} onChanged={reload} />}
      {donationForm && (
        <DonationForm
          onClose={() => setDonationForm(false)}
          onSaved={() => {
            reload();
            navigate("/donations");
          }}
        />
      )}
      {projectForm && (
        <ProjectForm
          onClose={() => setProjectForm(false)}
          onSaved={() => {
            reload();
            navigate("/projects");
          }}
        />
      )}
    </div>
  );
}
