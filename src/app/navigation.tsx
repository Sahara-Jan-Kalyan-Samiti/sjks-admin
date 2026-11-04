import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { IconName } from "@/components/ui/icons";
import type { Badges } from "@/hooks/useBadges";

/** Headings of the sidebar, in the order they appear. */
export const groups = ["Overview", "Programmes", "Funds & people", "Messages", "Website content", "Administration"] as const;
export type Group = (typeof groups)[number];

export interface PageDef {
  /** URL path, e.g. "donations" opens /donations */
  path: string;
  label: string;
  /** the sidebar heading this screen is listed under */
  group: Group;
  icon: IconName;
  /** which "needs attention" number is shown next to the menu item */
  badge?: keyof Badges;
  Component: LazyExoticComponent<ComponentType>;
}

/** Every screen of the panel, in menu order (grouped by heading). Each is loaded only when it is opened. */
export const pages: PageDef[] = [
  { path: "dashboard", label: "Dashboard", group: "Overview", icon: "dashboard", Component: lazy(() => import("@/pages/Dashboard")) },
  { path: "reports", label: "Analytics", group: "Overview", icon: "chart", Component: lazy(() => import("@/pages/Analytics")) },

  { path: "projects", label: "Projects", group: "Programmes", icon: "folder", Component: lazy(() => import("@/pages/Projects")) },
  {
    path: "medical",
    label: "Medical Funding",
    group: "Programmes",
    icon: "cross",
    Component: lazy(() => import("@/pages/MedicalFunding"))
  },
  {
    path: "campaigns",
    label: "Campaigns",
    group: "Programmes",
    icon: "heart",
    Component: lazy(() => import("@/pages/Campaigns"))
  },
  { path: "events", label: "Events", group: "Programmes", icon: "calendar", Component: lazy(() => import("@/pages/Events")) },
  {
    path: "donor",
    label: "Donor Transparency",
    group: "Programmes",
    icon: "shield",
    Component: lazy(() => import("@/pages/DonorTransparency"))
  },

  {
    path: "donations",
    label: "Donations",
    group: "Funds & people",
    icon: "rupee",
    badge: "donations",
    Component: lazy(() => import("@/pages/Donations"))
  },
  {
    path: "volunteers",
    label: "Team & Volunteers",
    group: "Funds & people",
    icon: "users",
    badge: "volunteers",
    Component: lazy(() => import("@/pages/TeamVolunteers"))
  },
  {
    path: "members",
    label: "Member ID Cards",
    group: "Funds & people",
    icon: "idCard",
    badge: "members",
    Component: lazy(() => import("@/pages/MemberCards"))
  },
  {
    path: "memberorgs",
    label: "Member Organizations",
    group: "Funds & people",
    icon: "building",
    badge: "memberorgs",
    Component: lazy(() => import("@/pages/MemberOrganizations"))
  },
  {
    path: "subscribers",
    label: "Newsletter Subscribers",
    group: "Funds & people",
    icon: "mail",
    Component: lazy(() => import("@/pages/Newsletter"))
  },

  {
    path: "messages",
    label: "Contact messages",
    group: "Messages",
    icon: "message",
    badge: "messages",
    Component: lazy(() => import("@/pages/Contacts"))
  },
  {
    path: "requests",
    label: "Document requests",
    group: "Messages",
    icon: "fileText",
    badge: "requests",
    Component: lazy(() => import("@/pages/DocumentRequests"))
  },
  { path: "broadcast", label: "Broadcast", group: "Messages", icon: "megaphone", Component: lazy(() => import("@/pages/Broadcast")) },

  {
    path: "videos",
    label: "Media & Gallery",
    group: "Website content",
    icon: "image",
    Component: lazy(() => import("@/pages/MediaGallery"))
  },
  {
    path: "annualreports",
    label: "Annual Reports",
    group: "Website content",
    icon: "book",
    Component: lazy(() => import("@/pages/AnnualReports"))
  },
  {
    path: "awards",
    label: "Awards & Recognition",
    group: "Website content",
    icon: "award",
    Component: lazy(() => import("@/pages/Awards"))
  },
  { path: "blog", label: "Blogs", group: "Website content", icon: "pen", Component: lazy(() => import("@/pages/Blog")) },
  {
    path: "pagecontent",
    label: "Website Pages",
    group: "Website content",
    icon: "globe",
    Component: lazy(() => import("@/pages/WebsitePages"))
  },

  { path: "admins", label: "Admins & activity", group: "Administration", icon: "lock", Component: lazy(() => import("@/pages/Admins")) }
];
