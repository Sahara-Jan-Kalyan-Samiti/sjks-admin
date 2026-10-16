import { supabase } from "@/lib/supabase";
import { unwrap, unwrapList } from "@/lib/errors";
import { backend } from "@/lib/backend";
import { publicUrl, removeFiles, safeName, uniquePath, uploadFile } from "@/lib/storage";
import type {
  AnnualReport,
  Award,
  BlogPost,
  BroadcastRecord,
  DonorItem,
  DonorProgramme,
  MedicalFunding,
  MemberCard,
  MemberOrganization,
  PageContentRow,
  SiteStat,
  TickerMessage
} from "@/types";
import { crud, listAll } from "./crud";

// ---------- annual reports (website Transparency → Annual Reports): one row per box, PDFs in "annual-reports" ----------
const reports = crud<AnnualReport>("annual_reports");
const reportError = (e: unknown): Error => {
  const m = (e as Error)?.message ?? "";
  if (/duplicate|unique/i.test(m)) return new Error("Another box already has this name. Use a different name.");
  if (/fy_check/.test(m))
    return new Error(
      "The database still only accepts names like 2004-05. Apply the latest migrations from the sjks-database repository, then save again."
    );
  return e as Error;
};
export const getAnnualReports = () => listAll<AnnualReport>("annual_reports", [{ column: "fy" }]);
export async function createAnnualReport(data: Record<string, unknown>) {
  try {
    return await reports.create(data);
  } catch (e) {
    throw reportError(e);
  }
}
export async function updateAnnualReport(id: number, data: Record<string, unknown>) {
  try {
    return await reports.update(id, data);
  } catch (e) {
    throw reportError(e);
  }
}
export async function deleteAnnualReport(r: AnnualReport): Promise<void> {
  await removeFiles("annual-reports", [r.storage_path]);
  await reports.remove(r.id);
}
/** Uploads a PDF and returns where it is. The box name is free text, so only letters, digits, dots and dashes go into the folder name. */
export async function uploadAnnualReportFile(fy: string, file: File): Promise<{ file_url: string; storage_path: string }> {
  const folder = fy.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "report";
  const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
  await uploadFile("annual-reports", path, file, "application/pdf");
  return { file_url: publicUrl("annual-reports", path), storage_path: path };
}
export const removeAnnualReportFile = (path: string | null | undefined) => removeFiles("annual-reports", [path]);

// ---------- awards & recognition ----------
const awards = crud<Award>("awards");
export const getAwards = () => listAll<Award>("awards", [{ column: "sort_order" }, { column: "created_at", ascending: false }]);
export const createAward = (data: Record<string, unknown>) => awards.create(data);
export const updateAward = (id: number, data: Record<string, unknown>) => awards.update(id, data);
export async function deleteAward(r: Award): Promise<void> {
  await removeFiles("award-certificates", [r.storage_path]);
  await awards.remove(r.id);
}
export async function uploadAwardCertificate(file: File): Promise<{ image_url: string; storage_path: string }> {
  const path = `${Date.now()}-${safeName(file.name)}`;
  await uploadFile("award-certificates", path, file);
  return { image_url: publicUrl("award-certificates", path), storage_path: path };
}
export const removeAwardCertificate = (path: string | null | undefined) => removeFiles("award-certificates", [path]);

// ---------- blog ----------
const blog = crud<BlogPost>("blog_posts");
const blogError = (e: unknown): Error =>
  /duplicate|unique/i.test((e as Error)?.message ?? "")
    ? new Error("Another post already uses this web address. Change the address (the part after /blog/).")
    : (e as Error);
export const getBlogPosts = () =>
  listAll<BlogPost>("blog_posts", [
    { column: "published_on", ascending: false },
    { column: "id", ascending: false }
  ]);
export async function createBlogPost(data: Record<string, unknown>) {
  try {
    return await blog.create(data);
  } catch (e) {
    throw blogError(e);
  }
}
export async function updateBlogPost(id: number, data: Record<string, unknown>) {
  try {
    return await blog.update(id, data);
  } catch (e) {
    throw blogError(e);
  }
}
export async function deleteBlogPost(r: BlogPost): Promise<void> {
  await blog.remove(r.id);
  await removeBlogImages([r.cover_path, r.photo_path]);
}
export async function uploadBlogImage(file: File): Promise<{ url: string; path: string }> {
  const path = `${Date.now()}-${safeName(file.name)}`;
  await uploadFile("blog-images", path, file);
  return { url: publicUrl("blog-images", path), path };
}
export const removeBlogImages = (paths: (string | null | undefined)[]) => removeFiles("blog-images", paths);

// ---------- medical funding (website Our Projects → Medical Facilities) ----------
const medical = crud<MedicalFunding>("medical_fundings");
export const getMedicalFundings = () =>
  listAll<MedicalFunding>("medical_fundings", [
    { column: "kind", ascending: false },
    { column: "amount", ascending: false },
    { column: "name" }
  ]);
export const createMedicalFunding = (data: Record<string, unknown>) => medical.create(data);
export const updateMedicalFunding = (id: number, data: Record<string, unknown>) => medical.update(id, data);
export const deleteMedicalFunding = (id: number) => medical.remove(id);

// ---------- member ID cards (website /member-id) ----------
const cards = crud<MemberCard>("member_cards");
export const getMemberCards = () => listAll<MemberCard>("member_cards", [{ column: "created_at", ascending: false }]);
/** Approving (status "approved") is what gives the card its number: the database assigns it. */
export const updateMemberCard = (id: number, data: Record<string, unknown>) => cards.update(id, data);
export async function deleteMemberCard(r: MemberCard): Promise<void> {
  await cards.remove(r.id);
  await removeFiles("member-photos", [r.photo_path]);
}

// ---------- member organisations (website Membership → Memberships) ----------
const orgs = crud<MemberOrganization>("member_organizations");
export const getMemberOrganizations = () =>
  listAll<MemberOrganization>("member_organizations", [{ column: "sort_order" }, { column: "id" }]);
export const createMemberOrganization = (data: Record<string, unknown>) => orgs.create(data);
export const updateMemberOrganization = (id: number, data: Record<string, unknown>) => orgs.update(id, data);
export const deleteMemberOrganization = (id: number) => orgs.remove(id);

// ---------- donor transparency: programmes, each with spending / impact / document / photo / date items ----------
const programmes = crud<DonorProgramme>("donor_programmes");
const items = crud<DonorItem>("donor_items");
export const getDonorProgrammes = () =>
  listAll<DonorProgramme>("donor_programmes", [{ column: "sort_order" }, { column: "created_at", ascending: false }]);
export const createDonorProgramme = (data: Record<string, unknown>) => programmes.create(data);
export const updateDonorProgramme = (id: number, data: Record<string, unknown>) => programmes.update(id, data);
export async function getDonorItems(programmeId: number): Promise<DonorItem[]> {
  return unwrapList(
    await supabase.from("donor_items").select("*").eq("programme_id", programmeId).order("sort_order").order("id")
  ) as DonorItem[];
}
export const createDonorItem = (data: Record<string, unknown>) => items.create(data);
export const updateDonorItem = (id: number, data: Record<string, unknown>) => items.update(id, data);
export async function deleteDonorItem(item: DonorItem): Promise<void> {
  await items.remove(item.id);
  await removeFiles("donor-transparency", [item.storage_path]);
}
/** Deletes the programme, all its items, and the files that were uploaded for them. */
export async function deleteDonorProgramme(id: number): Promise<void> {
  const list = await getDonorItems(id);
  await programmes.remove(id);
  await removeFiles(
    "donor-transparency",
    list.map((i) => i.storage_path)
  );
}
/** Uploads a photo or PDF and returns where it is. */
export async function uploadDonorFile(file: File): Promise<{ file_url: string; storage_path: string }> {
  const path = uniquePath(file.name);
  await uploadFile("donor-transparency", path, file);
  return { file_url: publicUrl("donor-transparency", path), storage_path: path };
}
export const removeDonorFile = (path: string | null | undefined) => removeFiles("donor-transparency", [path]);

// ---------- website page text: one row per text an admin has changed ----------
export async function getPageContent(): Promise<PageContentRow[]> {
  return unwrapList(await supabase.from("page_content").select("key, value, updated_at")) as PageContentRow[];
}
/** `changed` = texts to save; `reset` = keys that go back to their original wording. */
export async function savePageContent(changed: { key: string; value: string }[], reset: string[]): Promise<void> {
  if (changed.length) unwrap(await supabase.from("page_content").upsert(changed, { onConflict: "key" }));
  if (reset.length) unwrap(await supabase.from("page_content").delete().in("key", reset));
}

// ---------- the scrolling "Live" strip on top of the website ----------
export const getTickerMessages = () =>
  listAll<TickerMessage>("ticker_messages", [
    { column: "created_at", ascending: false },
    { column: "id", ascending: false }
  ]);
export async function createTickerMessage(message: string): Promise<TickerMessage> {
  return unwrap(await supabase.from("ticker_messages").insert([{ message }]).select().single()) as TickerMessage;
}
export async function deleteTickerMessage(id: number): Promise<void> {
  unwrap(await supabase.from("ticker_messages").delete().eq("id", id));
}

// ---------- e-mail broadcast (needs the backend and SMTP) ----------
export interface BroadcastInfo {
  counts: { volunteers: number; donors: number; all: number };
  history: BroadcastRecord[];
  mailReady: boolean;
}
export const getBroadcastInfo = () => backend<BroadcastInfo>("/api/broadcast");
export const sendBroadcast = (data: { audience: "volunteers" | "donors" | "all"; subject: string; message: string }) =>
  backend<{ sent: number; failed: number }>("/api/broadcast", { method: "POST", body: data });

// ---------- site statistics (first row = the beneficiary figure shown on the website) ----------
export const getSiteStats = () => listAll<SiteStat>("site_stats", [{ column: "sort_order" }]);
