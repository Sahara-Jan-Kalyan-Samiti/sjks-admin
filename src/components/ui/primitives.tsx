import { icons, type IconName } from "./icons";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

/** Small "Loading…" indicator. */
export const Spinner = ({ text = "Loading…" }: { text?: string }) => (
  <div className="loading" role="status">
    <span className="spin" aria-hidden="true" />
    {text}
  </div>
);

/** Friendly empty state, optionally with an action button. */
export const EmptyState = ({ text, action }: { text: string; action?: ReactNode }) => (
  <div className="empty">
    <p>{text}</p>
    {action}
  </div>
);

/** Inline message: error, success or information. */
export const Msg = ({ kind, children }: { kind: "err" | "ok" | "info"; children: ReactNode }) => (
  <div className={`msg ${kind}`} role={kind === "err" ? "alert" : "status"}>
    {children}
  </div>
);

/** Coloured status pill. `kind` picks the colour (active, pending, failed, success, ...). */
export const Tag = ({ kind, children }: { kind?: string; children?: ReactNode }) => (
  <span className={`tag ${kind ?? ""}`}>{children ?? kind}</span>
);

/** Dashboard stat card; a link when `href` is given (opens another admin page). */
export function StatCard({
  label,
  value,
  sub,
  href,
  tone,
  icon,
  accent
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  tone?: string;
  /** A small picture in front of the number (see components/ui/icons.tsx). */
  icon?: IconName;
  /** Colour of the picture: blue (default), green, amber or rose. */
  accent?: "green" | "amber" | "rose";
}) {
  const inner = (
    <>
      {icon ? <span className="ic">{icons[icon]}</span> : null}
      <div className="n">{value}</div>
      <div className="l">{label}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </>
  );
  const cls = ["card", icon ? "has-icon" : "", accent ?? "", tone ?? ""].filter(Boolean).join(" ");
  return href ? (
    <Link className={cls} to={href}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** A titled panel. */
export const Panel = ({ title, children }: { title?: ReactNode; children: ReactNode }) => (
  <section className="panel">
    {title ? <h2>{title}</h2> : null}
    {children}
  </section>
);

/** Page title with a description and, on the right, optional actions. */
export const PageHeader = ({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) => (
  <div className="page-head">
    <div className="grow">
      <h1>{title}</h1>
      {children ? <p className="mut">{children}</p> : null}
    </div>
    {actions}
  </div>
);

/** A button that is disabled and shows `busyText` while an async action runs. */
export function Button({
  busy,
  busyText = "Saving…",
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; busyText?: string }) {
  return (
    <button
      {...rest}
      className={[className, busy ? "is-busy" : ""].filter(Boolean).join(" ") || undefined}
      disabled={rest.disabled || busy}
    >
      {busy ? busyText : children}
    </button>
  );
}

export interface TabItem {
  key: string;
  label: string;
  count?: number | string;
}
export function Tabs({ tabs, value, onChange }: { tabs: TabItem[]; value: string; onChange: (key: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`tab${value === t.key ? " on" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label} <span className="count">{t.count ?? "…"}</span>
        </button>
      ))}
    </div>
  );
}

/** Key/value line inside a details dialog. */
export const KeyValue = ({ label, children }: { label: string; children?: ReactNode }) => (
  <div className="kv">
    <span className="mut">{label}</span>
    <span>{children || "—"}</span>
  </div>
);
