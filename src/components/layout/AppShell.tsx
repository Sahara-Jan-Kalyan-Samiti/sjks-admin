import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { groups, pages } from "@/app/navigation";
import { adminPhotoUrl } from "@/api/people";
import { useAuth, useMe } from "@/auth/AuthProvider";
import { icons } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/primitives";
import { useBadges } from "@/hooks/useBadges";
import { LanguageSwitch } from "@/i18n/LangProvider";
import { site } from "@/config/organisation";
import { MyProfile } from "./MyProfile";
import { NotificationBell } from "./NotificationBell";

const ROLE = { admin: "Administrator", editor: "Editor", viewer: "Viewer" } as const;

/** The frame around every screen: sidebar menu, top bar and the page itself. */
export function AppShell() {
  const me = useMe();
  const { signOut } = useAuth();
  const badges = useBadges();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
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
            <b>NPO Admin</b>
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
          <div className="side-scroll">
            {groups.map((g) => (
              <section key={g} className="side-group" aria-label={g}>
                <h3>{g}</h3>
                {pages
                  .filter((p) => p.group === g)
                  .map((p) => {
                    const n = p.badge && badges ? badges[p.badge] : 0;
                    return (
                      <NavLink key={p.path} to={"/" + p.path} className={({ isActive }) => (isActive ? "on" : "")}>
                        <span className="ic">{icons[p.icon]}</span>
                        <span className="lbl">{p.label}</span>
                        {n ? (
                          <span className="badge" title={`${n} need attention`}>
                            {n}
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
              </section>
            ))}
          </div>
          <div className="side-foot">
            <a href={site.url} target="_blank" rel="noopener noreferrer">
              <span className="ic">{icons.external}</span>
              <span className="lbl">View website</span>
            </a>
            <button type="button" onClick={() => signOut()} title={me.email}>
              <span className="ic">{icons.logout}</span>
              <span className="lbl">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="content">
        <header className="topbar">
          <span className="crumb">{current?.label ?? "Admin"}</span>
          <div className="grow" />
          <LanguageSwitch />
          <NotificationBell me={me} />
          <button type="button" className="who" title="Edit my name and photo" aria-haspopup="dialog" onClick={() => setProfile(true)}>
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
            <span className="who-text">
              <b>{me.display_name || me.email}</b>
              <small>{ROLE[me.role]}</small>
            </span>
            <svg className="who-edit" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </header>
        {profile && <MyProfile onClose={() => setProfile(false)} />}
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
