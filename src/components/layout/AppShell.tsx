import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { pages } from "@/app/navigation";
import { adminPhotoUrl } from "@/api/people";
import { useAuth, useMe } from "@/auth/AuthProvider";
import { Spinner } from "@/components/ui/primitives";
import { useBadges } from "@/hooks/useBadges";
import { LanguageSwitch } from "@/i18n/LangProvider";
import { site } from "@/config/organisation";
import { NotificationBell } from "./NotificationBell";

const ROLE = { admin: "Administrator", editor: "Editor", viewer: "Viewer" } as const;

/** The frame around every screen: sidebar menu, top bar and the page itself. */
export function AppShell() {
  const me = useMe();
  const { signOut } = useAuth();
  const badges = useBadges();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const current = pages.find((p) => pathname === "/" + p.path || pathname.startsWith("/" + p.path + "/"));

  useEffect(() => {
    setOpen(false);
    document.title = `${current?.label ?? "Admin"} · Admin`;
  }, [pathname, current?.label]);

  const initial = (me.email || "A")[0].toUpperCase();
  return (
    <div className="shell">
      <nav className={`side${open ? " open" : ""}`} aria-label="Admin">
        <div className="side-top">
          <NavLink to="/dashboard" className="brand">
            <img src="/assets/images/logo.png" alt="" onError={(e) => e.currentTarget.remove()} />
            <b>NGO Admin</b>
          </NavLink>
          <button
            type="button"
            className="menu-btn ghost sm"
            aria-expanded={open}
            aria-controls="side-links"
            onClick={() => setOpen(!open)}
          >
            Menu
          </button>
        </div>
        <div className="side-links" id="side-links">
          {pages.map((p) => {
            const n = p.badge && badges ? badges[p.badge] : 0;
            return (
              <NavLink key={p.path} to={"/" + p.path} className={({ isActive }) => (isActive ? "on" : "")}>
                <span>{p.label}</span>
                {n ? (
                  <span className="badge" title={`${n} need attention`}>
                    {n}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
          <a href={site.url} target="_blank" rel="noopener noreferrer">
            View website ↗
          </a>
          <button type="button" className="ghost" onClick={() => signOut()}>
            Sign out ({me.email})
          </button>
        </div>
        <div className="side-card">
          <img src="/assets/images/field-9.jpg" alt="" onError={(e) => e.currentTarget.remove()} />
          <strong>Creating Brighter Futures</strong>
          <span>Your work helps empower communities.</span>
        </div>
      </nav>

      <div className="content">
        <header className="topbar">
          <span className="crumb">{current?.label ?? "Admin"}</span>
          <div className="grow" />
          <LanguageSwitch />
          <NotificationBell me={me} />
          <div className="who">
            {me.photo_path ? (
              <img
                className="avatar"
                alt=""
                src={adminPhotoUrl(me.photo_path)}
                onError={(e) =>
                  e.currentTarget.replaceWith(Object.assign(document.createElement("span"), { className: "avatar", textContent: initial }))
                }
              />
            ) : (
              <span className="avatar" aria-hidden="true">
                {initial}
              </span>
            )}
            <span>
              <b>{me.display_name || me.email}</b>
              <small>{ROLE[me.role]}</small>
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
