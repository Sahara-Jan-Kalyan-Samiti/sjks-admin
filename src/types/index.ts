/**
 * Row types of the tables the admin panel reads and writes (see sjks-database/docs/SCHEMA.md).
 * Only the columns the screens use are listed.
 */

export type DonationStatus = "pending" | "success" | "failed" | "refunded" | "cancelled";
export interface Donation {
  id: number;
  seq?: number;
  created_at: string;
  donated_at: string;
  mode: "online" | "offline";
  method: string | null;
  status: DonationStatus;
  amount: number;
  currency: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  donor_pan: string | null;
  donor_address: string | null;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
  gateway: string | null;
  gateway_payment_id: string | null;
  gateway_order_id: string | null;
  gateway_status: string | null;
  gateway_error: string | null;
  receipt_sent_at: string | null;
  tax_receipt_issued_at: string | null;
  /** added by the API layer: SJKS/2026-27/00042 */
  receipt_no?: string;
}

export type VolunteerStatus = "pending" | "active" | "inactive";
export interface Volunteer {
  id: number;
  created_at: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  area: string | null;
  message: string | null;
  status: VolunteerStatus;
  photo_path: string | null;
  show_on_website: boolean;
  reports_to: string | null;
}

export interface TeamMember {
  id: number;
  team: "committee" | "management";
  name: string;
  post: string;
  role: string | null;
  sort_order: number;
  published: boolean;
  reports_to: string | null;
}

export type ProjectStatus = "planned" | "ongoing" | "completed";
export interface Project {
  id: number;
  created_at: string;
  name: string;
  area: string | null;
  location: string | null;
  description: string | null;
  status: ProjectStatus;
  beneficiaries: number;
  published: boolean;
  image_url: string | null;
  storage_path: string | null;
}
/** One programme of the read-only website portfolio (sjks-frontend src/data/content/portfolio.ts, exported to JSON). */
export interface PortfolioProject {
  no: number;
  name: string;
  period?: string;
  location?: string;
  area: string;
  summary?: string;
  beneficiaries?: string;
  budget?: string;
  funding?: string;
  status?: "ongoing" | "completed" | "not dated";
}

export interface EventImage {
  id: number;
  event_id: number;
  storage_path: string;
  position: number;
}
export interface EventRow {
  id: number;
  created_at: string;
  title: string;
  event_date: string;
  event_time: string | null;
  place: string | null;
  description: string | null;
  published: boolean;
  images: EventImage[];
}

export type RequestStatus = "new" | "sent" | "completed";
export interface DocumentRequest {
  id: number;
  created_at: string;
  reference: string | null;
  request_type: string | null;
  document_type: string | null;
  financial_year: string | null;
  delivery: string | null;
  delivery_address: string | null;
  name: string | null;
  organisation: string | null;
  email: string;
  phone: string | null;
  purpose: string | null;
  message: string | null;
  status: RequestStatus;
  admin_message: string | null;
  sent_at: string | null;
  completed_at: string | null;
}
export interface RequestAttachment {
  id: number;
  request_id: number;
  filename: string;
  storage_path: string;
  mime: string | null;
  size_bytes: number | null;
}

export type ContactStatus = "new" | "contacted" | "closed";
export interface ContactMessage {
  id: number;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: ContactStatus;
}
export interface Subscriber {
  id: number;
  email: string;
  status: "active" | "unsubscribed";
  source: string | null;
  subscribed_at: string;
}

export interface GalleryVideo {
  id: number;
  created_at: string;
  youtube_id: string;
  title: string | null;
  description: string | null;
  published: boolean;
  featured: boolean;
}
export interface GalleryPhoto {
  id: number;
  created_at: string;
  image_url: string;
  storage_path: string | null;
  category: string;
  caption: string | null;
  published: boolean;
}

export interface AnnualReport {
  id: number;
  fy: string;
  title: string | null;
  description: string | null;
  file_url: string | null;
  storage_path: string | null;
  published: boolean;
  updated_at: string;
}
export interface Award {
  id: number;
  created_at: string;
  title: string;
  category: string;
  description: string | null;
  image_url: string | null;
  storage_path: string | null;
  published: boolean;
  sort_order: number;
}
export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  category: string;
  author: string | null;
  published_on: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  cover_path: string | null;
  photo_url: string | null;
  photo_path: string | null;
  photo_caption: string | null;
  published: boolean;
}
export interface MedicalFunding {
  id: number;
  created_at: string;
  kind: "hospital" | "facility";
  name: string;
  location: string | null;
  amount: number;
  period: string | null;
  purpose: string | null;
  published: boolean;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";
export interface MemberCard {
  id: number;
  created_at: string;
  issued_at: string | null;
  full_name: string;
  role: string;
  phone: string;
  blood_group: string | null;
  valid_till: string | null;
  card_id: string | null;
  status: ApprovalStatus;
  photo_path: string | null;
  admin_note: string | null;
}
export interface MemberOrganization {
  id: number;
  created_at: string;
  name: string;
  location: string | null;
  description: string | null;
  sort_order: number;
  published: boolean;
  status: ApprovalStatus;
  org_type: string | null;
  registration_no: string | null;
  year_founded: number | null;
  website: string | null;
  focus_areas: string[] | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  admin_note: string | null;
}

export interface DonorProgramme {
  id: number;
  name: string;
  period: string | null;
  place: string | null;
  summary: string | null;
  received: number;
  published: boolean;
  sort_order: number;
}
export type DonorItemKind = "spending" | "outcome" | "proof" | "photo" | "date";
export interface DonorItem {
  id: number;
  programme_id: number;
  kind: DonorItemKind;
  title: string;
  detail: string | null;
  extra: string | null;
  amount: number | null;
  file_url: string | null;
  storage_path: string | null;
  sort_order: number;
}

export interface TickerMessage {
  id: number;
  message: string;
  created_at: string;
}
export interface BroadcastRecord {
  id: number;
  created_at: string;
  audience: string;
  subject: string;
  recipients: number;
  failed: number;
}
export interface SiteStat {
  id: number;
  label: string;
  value: number;
  suffix: string | null;
  plain: boolean;
  sort_order: number;
}

export type AdminRole = "admin" | "editor" | "viewer";
export interface AdminProfile {
  id: string;
  display_name: string | null;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  photo_path: string | null;
  email?: string | null;
}
export interface AdminListItem extends AdminProfile {
  email: string;
  actions: number;
}
export interface ActivityEntry {
  id: number;
  created_at: string;
  admin_id: string | null;
  admin_label: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string;
}
export interface PageContentRow {
  key: string;
  value: string;
  updated_at: string;
}
