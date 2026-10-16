import { friendlyError } from "@/lib/errors";
import { publicUrl, removeFiles, uniquePath, uploadFile } from "@/lib/storage";
import type { GalleryPhoto, GalleryVideo } from "@/types";
import { crud, listAll } from "./crud";

// ---------- videos (website Media & Gallery). In website order: oldest first. ----------
const videos = crud<GalleryVideo>("gallery_videos");
const FEATURED_SETUP =
  "Choosing the large video is not set up yet. Apply the latest migrations from the sjks-database repository, then try again.";
const videoError = (error: unknown, data: Record<string, unknown>): Error => {
  const e = error as { code?: string; message?: string };
  if (/already|duplicate|unique/i.test(e.message ?? "")) return new Error("This video is already in the gallery.");
  if ("featured" in data && /featured/i.test(e.message ?? "")) return new Error(FEATURED_SETUP);
  return friendlyError(e);
};
export const getVideos = () => listAll<GalleryVideo>("gallery_videos", [{ column: "created_at" }, { column: "id" }]);
export async function createVideo(data: Record<string, unknown>): Promise<GalleryVideo> {
  try {
    return await videos.create(data);
  } catch (e) {
    throw videoError(e, data);
  }
}
export async function updateVideo(id: number, data: Record<string, unknown>): Promise<GalleryVideo> {
  try {
    return await videos.update(id, data);
  } catch (e) {
    throw videoError(e, data);
  }
}
export const deleteVideo = (id: number) => videos.remove(id);

/** The 11-character video id from any YouTube link (watch, youtu.be, shorts, embed, live) or the id itself. Null when it is not one. */
export function youtubeId(input: string): string | null {
  const s = String(input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    id = m ? m[1] : u.searchParams.get("v");
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const youtubeLink = (id: string) => `https://www.youtube.com/watch?v=${id}`;

// ---------- photos (website Photo Gallery): newest first ----------
const photos = crud<GalleryPhoto>("gallery_photos");
export const getGalleryPhotos = () =>
  listAll<GalleryPhoto>("gallery_photos", [
    { column: "created_at", ascending: false },
    { column: "id", ascending: false }
  ]);
export const createGalleryPhoto = (data: Record<string, unknown>) => photos.create(data);
export const updateGalleryPhoto = (id: number, data: Record<string, unknown>) => photos.update(id, data);
export async function deleteGalleryPhoto(r: GalleryPhoto): Promise<void> {
  await photos.remove(r.id);
  await removeFiles("gallery-photos", [r.storage_path]);
}
/** Uploads one photo and returns where it is. */
export async function uploadGalleryPhoto(file: File): Promise<{ image_url: string; storage_path: string }> {
  const path = uniquePath(file.name);
  await uploadFile("gallery-photos", path, file);
  return { image_url: publicUrl("gallery-photos", path), storage_path: path };
}
export const removeGalleryPhotoFile = (path: string | null | undefined) => removeFiles("gallery-photos", [path]);
