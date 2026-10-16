# sjks-admin

Admin panel of **Sahara Jan Kalyan Samiti**: donations, volunteers, events, gallery, blog, reports and everything else that is shown on the public website.

| Repository                | What it is                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| sjks-frontend             | Public website (Next.js)                                               |
| **sjks-admin** (this one) | Admin panel (React)                                                    |
| sjks-backend              | Node API: payments webhook, receipts, e-mail, exports, creating admins |
| sjks-database             | Supabase migrations, access rules, storage buckets                     |

## Tech stack

React 18 · TypeScript 5.5 · Vite 5.4 · React Router 6 · TanStack Query 5 · Supabase JS (Auth, database, Storage) · `write-excel-file` · Vitest + Testing Library

## How it works

- **Sign-in:** Supabase Auth (e-mail + password). Only a user with an **active** row in `admin_profiles` gets in.
- **Data:** most screens read and write Supabase directly. What a signed-in admin may do is decided by row-level security in `sjks-database`; the browser only holds the _publishable_ key.
- **Backend:** screens that need a secret or an e-mail account call `sjks-backend` with the admin's access token: print or e-mail a receipt, e-mail documents of a request, e-mail broadcasts, create an admin, download the full donations CSV. Without `VITE_API_URL` these buttons explain what is missing instead of failing.
- **Language:** English / Hindi (top bar). Hindi is applied on screen from `src/i18n/hi.admin.ts`, downloaded only when Hindi is switched on.

## Getting started

```bash
npm ci
cp .env.example .env      # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (and VITE_API_URL for the backend features)
npm run dev               # http://localhost:5174
```

For the backend features, start `sjks-backend` (port 8080), set `VITE_API_URL=http://localhost:8080` in `.env`, and make sure the backend's `CORS_ORIGINS` contains `http://localhost:5174`.

| Script                                    | Purpose                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                             | Dev server                                                                        |
| `npm run typecheck` · `npm run lint`      | Static checks                                                                     |
| `npm run format` · `npm run format:check` | Apply or check Prettier formatting (CI fails on unformatted code)                 |
| `npm test`                                | Unit and screen tests (the database is replaced by a stub that answers "no rows") |
| `npm run build`                           | Type-check and build to `dist/`                                                   |

Create the first admin in Supabase (see `sjks-database/docs/NEW_ACCOUNT_SETUP.md`); further admins are added from **Admins & activity → + Add admin**.

## Environment variables (all public)

| Variable                                             | Purpose                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase connection                                         |
| `VITE_API_URL`                                       | `sjks-backend` address, e.g. `https://api.saharangosag.com` |
| `VITE_SITE_URL`                                      | Public website, for the "View website" links                |

## Folder structure

```
index.html · vite.config.ts · tsconfig.json · eslint.config.js · vitest.config.ts · .prettierrc · .editorconfig
.github/                  CI workflow (deploy.yml), pull request template, Dependabot
public/assets/images/     logo and sidebar picture
src/
  main.tsx                Providers: query cache, router, language, toasts, confirm dialogs, auth
  app/
    App.tsx               Setup message / sign-in page / the routes
    navigation.tsx        The 20 screens in menu order (each loaded only when opened)
  auth/                   AuthProvider (session + active-admin check), LoginPage
  styles/                 tokens.css (colours), base.css (elements), layout.css (shell), components.css
  components/
    layout/               AppShell (sidebar, top bar), NotificationBell
    ui/                   primitives (Spinner, Tag, StatCard, Panel, Tabs ...), charts, Modal, feedback (toasts + confirm)
    data-table/           DataTable (search, filters, dates, sorting, paging), ServerList (database-side paging), Pager
    forms/                useForm, rules, controls (Field, Check, Select, FileSlot)
  api/                    Typed data access, one file per area (donations, people, events, projects, requests,
                          messages, media, content, analytics, notifications) + crud.ts
  lib/                    supabase client, backend client, errors, storage helpers, formatting, CSV / Excel export
  hooks/                  useList, useBusy, useBadges
  types/                  Row types of the tables
  i18n/                   LangProvider + switch, domTranslate, hi.admin (Hindi)
  config/organisation.ts  Name and website used on the member ID card
  utils/                  memberCard (ID card drawing), pdf
  data/generated/         page-texts.json and portfolio.json exported from sjks-frontend
  pages/<Screen>/         One folder per screen (see below)
  test/                   Supabase stub for tests
```

### Screens

| Menu                   | Folder                                                    | Needs the backend for                                  |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Dashboard              | `pages/Dashboard`                                         |                                                        |
| Analytics              | `pages/Analytics`                                         |                                                        |
| Projects               | `pages/Projects`                                          |                                                        |
| Medical Funding        | `pages/MedicalFunding`                                    |                                                        |
| Donations              | `pages/Donations`                                         | print / e-mail receipts and 80G certificates, full CSV |
| Team & Volunteers      | `pages/TeamVolunteers` (Team, Volunteers, Hierarchy tabs) |                                                        |
| Member ID Cards        | `pages/MemberCards`                                       |                                                        |
| Member Organizations   | `pages/MemberOrganizations`                               |                                                        |
| Newsletter Subscribers | `pages/Newsletter`                                        |                                                        |
| Contact messages       | `pages/Contacts`                                          |                                                        |
| Document requests      | `pages/DocumentRequests`                                  | e-mailing the documents                                |
| Events                 | `pages/Events`                                            |                                                        |
| Media & Gallery        | `pages/MediaGallery` (Videos, Photos tabs)                |                                                        |
| Annual Reports         | `pages/AnnualReports`                                     |                                                        |
| Donor Transparency     | `pages/DonorTransparency`                                 |                                                        |
| Awards & Recognition   | `pages/Awards`                                            |                                                        |
| Blogs                  | `pages/Blog`                                              |                                                        |
| Website Pages          | `pages/WebsitePages`                                      |                                                        |
| Broadcast              | `pages/Broadcast` (Live strip, E-mail tabs)               | e-mail broadcast                                       |
| Admins & activity      | `pages/Admins`                                            | creating an admin                                      |

### Adding a screen

1. Add the row type to `src/types/index.ts` and the queries to a file in `src/api/`.
2. Create `src/pages/<Name>/index.tsx` using `useList` + `DataTable` (copy a small one such as `MedicalFunding`).
3. Add it to `src/app/navigation.tsx`.

## Data exported from the website

The "Website Pages" screen lists every editable website text, and "Projects" shows the website portfolio. Both come from `sjks-frontend`:

```bash
cd ../sjks-frontend
npm run export:admin -- ../sjks-admin/src/data/generated
```

Run it whenever `pageContent.ts` or `portfolio.ts` changes in the website, then commit the two JSON files here.

## Deployment (Google Cloud)

Static files, like the website: a Cloud Storage bucket behind an HTTPS load balancer with Cloud CDN, on `admin.saharangosag.com`. See `.github/workflows/deploy.yml` (same GitHub variables as the website, with its own buckets).

Set these response headers on the load balancer (the old Vercel config, moved):

```
X-Frame-Options: DENY
X-Robots-Tag: noindex
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co <API_ORIGIN>; frame-ancestors 'none'
```

Optionally restrict the hostname with Identity-Aware Proxy or an IP allow-list.
Every unknown path must return `index.html` (single-page app).

## Differences from the old admin

- Rebuilt in React; the screens and their behaviour are the same.
- **E-mail, receipts and creating admins go through the backend** (the old panel said "requires a backend").
- **Creating an admin** no longer uses public sign-up: the backend creates the account (public sign-up can stay off in Supabase).
- Routes are real paths (`/donations`) instead of `#/donations`; `?tab=volunteers` replaces `#/volunteers/signups`.
- The "sample events" read from the website's `public/data/live.json` are gone (the admin no longer sits next to the website's files).
- The beneficiary figure on the dashboard comes from the `site_stats` table.
- Only the `admin` role can change data today: row-level security uses `is_admin()` everywhere. `editor` and `viewer` exist in `admin_profiles` but need matching policies in `sjks-database` before they are useful.

## Known issues

- `npm audit` reports two moderate advisories in `react-router` 6. They concern server-side rendering and a redirect case; this app is a plain browser app with fixed internal links, so the real risk is low. The fix is React Router 7, a breaking upgrade that is planned separately.
