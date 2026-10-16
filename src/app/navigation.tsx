import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Badges } from "@/hooks/useBadges";

export interface PageDef {
  /** URL path, e.g. "donations" opens /donations */
  path: string;
  label: string;
  /** which "needs attention" number is shown next to the menu item */
  badge?: keyof Badges;
  Component: LazyExoticComponent<ComponentType>;
}

/** Every screen of the panel, in menu order. Each is loaded only when it is opened. */
export const pages: PageDef[] = [
  { path: "dashboard", label: "Dashboard", Component: lazy(() => import("@/pages/Dashboard")) },
  { path: "reports", label: "Analytics", Component: lazy(() => import("@/pages/Analytics")) },
  { path: "projects", label: "Projects", Component: lazy(() => import("@/pages/Projects")) },
  { path: "medical", label: "Medical Funding", Component: lazy(() => import("@/pages/MedicalFunding")) },
  { path: "donations", label: "Donations", badge: "donations", Component: lazy(() => import("@/pages/Donations")) },
  { path: "volunteers", label: "Team & Volunteers", badge: "volunteers", Component: lazy(() => import("@/pages/TeamVolunteers")) },
  { path: "members", label: "Member ID Cards", badge: "members", Component: lazy(() => import("@/pages/MemberCards")) },
  { path: "memberorgs", label: "Member Organizations", badge: "memberorgs", Component: lazy(() => import("@/pages/MemberOrganizations")) },
  { path: "subscribers", label: "Newsletter Subscribers", Component: lazy(() => import("@/pages/Newsletter")) },
  { path: "messages", label: "Contact messages", badge: "messages", Component: lazy(() => import("@/pages/Contacts")) },
  { path: "requests", label: "Document requests", badge: "requests", Component: lazy(() => import("@/pages/DocumentRequests")) },
  { path: "events", label: "Events", Component: lazy(() => import("@/pages/Events")) },
  { path: "videos", label: "Media & Gallery", Component: lazy(() => import("@/pages/MediaGallery")) },
  { path: "annualreports", label: "Annual Reports", Component: lazy(() => import("@/pages/AnnualReports")) },
  { path: "donor", label: "Donor Transparency", Component: lazy(() => import("@/pages/DonorTransparency")) },
  { path: "awards", label: "Awards & Recognition", Component: lazy(() => import("@/pages/Awards")) },
  { path: "blog", label: "Blogs", Component: lazy(() => import("@/pages/Blog")) },
  { path: "pagecontent", label: "Website Pages", Component: lazy(() => import("@/pages/WebsitePages")) },
  { path: "broadcast", label: "Broadcast", Component: lazy(() => import("@/pages/Broadcast")) },
  { path: "admins", label: "Admins & activity", Component: lazy(() => import("@/pages/Admins")) }
];
