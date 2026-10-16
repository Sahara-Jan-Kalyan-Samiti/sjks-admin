import { supabase } from "./supabase";
import { friendlyError } from "./errors";

export type Bucket =
  | "admin-photos"
  | "volunteer-photos"
  | "member-photos"
  | "event-images"
  | "gallery-photos"
  | "project-photos"
  | "blog-images"
  | "annual-reports"
  | "award-certificates"
  | "donor-transparency"
  | "request-files";

/** File names go into storage paths: only letters, digits, dots, dashes and underscores are kept. */
export const safeName = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, "-");

/** A path that cannot clash with an existing file: year/timestamp-random-name. */
export const uniquePath = (name: string, folder = `${new Date().getFullYear()}`): string =>
  `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(name).slice(-60)}`;

export const publicUrl = (bucket: Bucket, path: string): string => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

export async function uploadFile(bucket: Bucket, path: string, file: File, contentType = file.type): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType });
  if (error)
    throw /bucket not found/i.test(error.message)
      ? new Error(`The storage bucket “${bucket}” does not exist yet. Apply the latest migrations from sjks-database.`)
      : friendlyError(error);
}

/** Removing a file that is already gone is not an error: this is cleanup after the database row was changed. */
export async function removeFiles(bucket: Bucket, paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await supabase.storage.from(bucket).remove(list);
}

export async function signedUrl(bucket: Bucket, path: string, seconds = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw friendlyError(error);
  return data.signedUrl;
}

/** Checks a photo before it is uploaded. Returns what is wrong, or null. */
export function imageProblem(file: File, maxMb: number, label = "photo"): string | null {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return `Please choose a JPG, PNG or WebP ${label}.`;
  if (file.size > maxMb * 1024 * 1024) return `“${file.name}” is larger than ${maxMb} MB.`;
  return null;
}
