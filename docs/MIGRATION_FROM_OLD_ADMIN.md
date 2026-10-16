# Old admin → new admin: where everything went

The old panel lived in `admin/js/*.js` of the single `sjks-ngo` repository. Every screen was kept; only the technology changed.

| Old file                                                 | New location                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `admin/index.html`, `admin/admin.css`                    | `index.html`, `src/styles/{tokens,base,layout,components}.css`                            |
| `admin/js/app.js` (shell, sign-in, menu, badges)         | `src/app/*`, `src/auth/*`, `src/components/layout/AppShell.tsx`, `src/hooks/useBadges.ts` |
| `admin/js/ui.js` (DOM helper, tables, charts, dialogs)   | `src/components/ui/*`, `src/components/data-table/*`, `src/components/forms/*`            |
| `admin/js/data.js` (all queries)                         | `src/api/*.ts` (one file per area)                                                        |
| `admin/js/supabase.js`                                   | `src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`                                        |
| `admin/js/api.js` (old Node server calls)                | `src/lib/backend.ts` (calls `sjks-backend` with the Supabase token)                       |
| `admin/js/lang.js`, `src/i18n/hi.admin.ts`               | `src/i18n/LangProvider.tsx`, `src/i18n/hi.admin.ts`                                       |
| `admin/js/notifications.js`                              | `src/api/notifications.ts`, `src/components/layout/NotificationBell.tsx`                  |
| `admin/print.js`                                         | not needed: the receipt page is produced by `sjks-backend`                                |
| `dashboard.js`                                           | `pages/Dashboard`                                                                         |
| `reports.js`                                             | `pages/Analytics`                                                                         |
| `projects.js`                                            | `pages/Projects`                                                                          |
| `medical.js`                                             | `pages/MedicalFunding`                                                                    |
| `donations.js`                                           | `pages/Donations`                                                                         |
| `volunteers.js`, `team.js`, `hierarchy.js`, `orgtree.js` | `pages/TeamVolunteers/{VolunteersTab,TeamTab,HierarchyTab,ManagerField}.tsx`              |
| `members.js`                                             | `pages/MemberCards`                                                                       |
| `memberorgs.js`                                          | `pages/MemberOrganizations`                                                               |
| `newsletter.js`                                          | `pages/Newsletter`                                                                        |
| `contacts.js`                                            | `pages/Contacts`                                                                          |
| `requests.js`                                            | `pages/DocumentRequests`                                                                  |
| `events.js`                                              | `pages/Events`                                                                            |
| `videos.js`, `photos.js`                                 | `pages/MediaGallery/{VideosTab,PhotosTab}.tsx`                                            |
| `annualreports.js`                                       | `pages/AnnualReports`                                                                     |
| `donor.js`                                               | `pages/DonorTransparency`                                                                 |
| `awards.js`                                              | `pages/Awards`                                                                            |
| `blog.js`                                                | `pages/Blog`                                                                              |
| `pagecontent.js`                                         | `pages/WebsitePages` (texts from `src/data/generated/page-texts.json`)                    |
| `broadcast.js`                                           | `pages/Broadcast` (Live strip tab + new E-mail tab)                                       |
| `admins.js`                                              | `pages/Admins`                                                                            |

## Behaviour that changed on purpose

| Before                                                                     | Now                                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| "Email sending requires a backend (not available on this deployment)"      | Receipts, 80G certificates, document e-mails and broadcasts are sent by `sjks-backend`                   |
| Adding an admin used Supabase public **sign-up** from the browser          | The backend creates the account with the service-role key; public sign-up stays off                      |
| Receipt print window built in the browser, numbered `SJKS-2026-000042`     | The backend's receipt page, numbered `SJKS/2026-27/00042` (financial year, same as the e-mailed receipt) |
| Hash routes: `#/donations`, `#/volunteers/signups`                         | Paths: `/donations`, `/volunteers?tab=volunteers`                                                        |
| "Sample events" from the website's `live.json`                             | Removed (the admin no longer reads the website's files)                                                  |
| Website portfolio and page texts imported straight from the website source | Exported to JSON by `npm run export:admin` in `sjks-frontend`                                            |
| Beneficiary reach read from `public/data/live.json`                        | Read from the `site_stats` table                                                                         |
