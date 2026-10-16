import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getNotifications, KINDS, readStore } from "@/api/notifications";
import type { Me } from "@/auth/AuthProvider";
import { timeAgo } from "@/lib/format";

const BellIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 9a6 6 0 0112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
    <path d="M10 19.5a2.2 2.2 0 004 0" />
  </svg>
);

/** The bell in the top bar. The list reloads every minute and whenever it is opened. Which ones were read is remembered on this device. */
export function NotificationBell({ me }: { me: Me }) {
  const read = useMemo(() => readStore(me.id), [me.id]);
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [, bump] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const {
    data: items = [],
    isSuccess,
    refetch
  } = useQuery({ queryKey: ["notifications", me.id], queryFn: () => getNotifications(me), refetchInterval: 60_000 });

  useEffect(() => {
    if (!open) return;
    refetch();
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refetch]);

  const unread = items.filter((n) => !read.has(n.id)).length;
  const shown = onlyUnread ? items.filter((n) => !read.has(n.id)) : items;
  const mark = (ids: string[]) => {
    read.add(ids);
    bump((n) => n + 1);
  };

  return (
    <div className="notif" ref={box}>
      <button
        type="button"
        className="notif-btn ghost"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        title="Notifications"
        onClick={() => setOpen(!open)}
      >
        <BellIcon />
        {unread > 0 && <span className="notif-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <b className="grow">Notifications</b>
            <button type="button" className="ghost sm" aria-pressed={onlyUnread} onClick={() => setOnlyUnread(!onlyUnread)}>
              Unread only
            </button>
            <button type="button" className="ghost sm" disabled={!unread} onClick={() => mark(items.map((n) => n.id))}>
              Mark all as read
            </button>
          </div>
          <ul className="notif-list">
            {!isSuccess ? (
              <li className="notif-empty mut">Loading…</li>
            ) : !shown.length ? (
              <li className="notif-empty mut">
                {items.length ? "No unread notifications." : "You are all caught up. Nothing needs your attention."}
              </li>
            ) : (
              shown.map((n) => (
                <li key={n.id}>
                  <Link
                    to={KINDS[n.kind][1]}
                    className={read.has(n.id) ? "" : "unread"}
                    onClick={() => {
                      mark([n.id]);
                      setOpen(false);
                    }}
                  >
                    <span className={`notif-dot ${KINDS[n.kind][0]}`} aria-hidden="true" />
                    <span className="notif-text">
                      <b>{n.title}</b>
                      {n.sub ? <span data-no-translate="">{n.sub}</span> : null}
                      <small>{n.when || timeAgo(n.at)}</small>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
          <p className="notif-foot mut">
            New messages, sign-ups, requests and donations, reminders for events and drafts, and changes by other admins.
          </p>
        </div>
      )}
    </div>
  );
}
