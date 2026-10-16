import type { PortfolioProject, Project } from "@/types";
import { removeFiles, safeName, uploadFile, publicUrl } from "@/lib/storage";
import portfolioData from "@/data/generated/portfolio.json";
import { crud, listAll } from "./crud";

const projects = crud<Project>("projects");
const SETUP = "Project photos are not set up yet. Apply the latest migrations from the sjks-database repository, then try again.";
const photoError = (e: unknown): Error =>
  /image_url|storage_path|bucket/i.test((e as Error)?.message ?? "") ? new Error(SETUP) : (e as Error);

export const getProjects = () => listAll<Project>("projects", [{ column: "created_at", ascending: false }]);
export async function createProject(data: Record<string, unknown>): Promise<Project> {
  try {
    return await projects.create(data);
  } catch (e) {
    throw photoError(e);
  }
}
export async function updateProject(id: number, data: Record<string, unknown>): Promise<Project> {
  try {
    return await projects.update(id, data);
  } catch (e) {
    throw photoError(e);
  }
}
export const deleteProject = (id: number) => projects.remove(id);

/** Uploads a project photo and returns where it is. */
export async function uploadProjectPhoto(file: File): Promise<{ image_url: string; storage_path: string }> {
  const path = `${Date.now()}-${safeName(file.name)}`;
  try {
    await uploadFile("project-photos", path, file);
  } catch (e) {
    throw photoError(e);
  }
  return { image_url: publicUrl("project-photos", path), storage_path: path };
}
export const removeProjectPhoto = (path: string | null | undefined) => removeFiles("project-photos", [path]);

// ---------- the read-only website portfolio ----------
export const AREA_NAMES: Record<string, string> = {
  "child-education": "Child education",
  "medical-facilities": "Medical facilities",
  "health-nutrition": "Health & nutrition",
  "women-empowerment": "Women empowerment",
  environment: "Environment",
  "social-welfare": "Social welfare"
};

const statusOf = (period?: string): NonNullable<PortfolioProject["status"]> =>
  !period ? "not dated" : /present|ongoing/i.test(period) ? "ongoing" : "completed";

/** The portfolio shown on the website, exported from sjks-frontend (see README: npm run export:admin). */
export const websitePortfolio: PortfolioProject[] = (portfolioData as PortfolioProject[]).map((p) => ({
  ...p,
  status: statusOf(p.period)
}));
