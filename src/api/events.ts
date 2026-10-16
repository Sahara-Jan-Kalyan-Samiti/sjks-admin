import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/errors";
import { publicUrl, removeFiles, uploadFile } from "@/lib/storage";
import type { EventImage, EventRow } from "@/types";
import { crud } from "./crud";

const events = crud<EventRow>("events");

type RawEvent = Omit<EventRow, "images"> & { event_images?: EventImage[] };
const withImages = (e: RawEvent): EventRow => ({ ...e, images: [...(e.event_images ?? [])].sort((a, b) => a.position - b.position) });

export async function getEvents(): Promise<EventRow[]> {
  const data = unwrap(await supabase.from("events").select("*, event_images(*)").order("event_date", { ascending: false })) ?? [];
  return (data as RawEvent[]).map(withImages);
}
export async function createEvent(data: Record<string, unknown>): Promise<EventRow> {
  return { ...(await events.create(data)), images: [] };
}
export const updateEvent = (id: number, data: Record<string, unknown>) => events.update(id, data);

export async function deleteEvent(id: number): Promise<void> {
  const { data: images } = await supabase.from("event_images").select("storage_path").eq("event_id", id);
  await removeFiles(
    "event-images",
    (images ?? []).map((i) => i.storage_path)
  );
  await events.remove(id);
}

export const eventImageUrl = (path: string) => publicUrl("event-images", path);

export async function uploadEventImage(eventId: number, file: File): Promise<EventImage> {
  const path = `${eventId}/${Date.now()}-${file.name}`;
  await uploadFile("event-images", path, file);
  const { count } = await supabase.from("event_images").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  return unwrap(
    await supabase
      .from("event_images")
      .insert([{ event_id: eventId, storage_path: path, position: count || 0 }])
      .select()
      .single()
  ) as EventImage;
}
export async function deleteEventImage(img: EventImage): Promise<void> {
  await removeFiles("event-images", [img.storage_path]);
  unwrap(await supabase.from("event_images").delete().eq("id", img.id));
}
