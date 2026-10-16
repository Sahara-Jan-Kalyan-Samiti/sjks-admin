import { supabase } from "@/lib/supabase";
import { friendlyError, unwrap, unwrapList } from "@/lib/errors";
import { backend } from "@/lib/backend";
import { publicUrl, removeFiles, safeName, uploadFile } from "@/lib/storage";
import type { ActivityEntry, AdminListItem, AdminProfile, TeamMember, Volunteer } from "@/types";
import { crud, listAll } from "./crud";

// ---------- who works under whom ----------
// A team member or a volunteer can work under any other one. It is saved on the person as "team:<id>" or "volunteer:<id>"
// (column reports_to). Admin panel only: the website never shows it.
const SETUP_HINT = "“Works under” is not set up yet. Apply the latest migrations from the sjks-database repository, then try again.";
// PGRST204 / 42703 = the reports_to column does not exist yet, 42501 = admins may not change it yet
const treeError = (error: unknown, data: Record<string, unknown>): Error => {
  const e = error as { code?: string };
  return "reports_to" in data && ["PGRST204", "42703", "42501"].includes(e.code ?? "") ? new Error(SETUP_HINT) : friendlyError(e);
};

// ---------- volunteers ----------
const volunteers = crud<Volunteer>("volunteers");
export const getVolunteers = () => listAll<Volunteer>("volunteers", [{ column: "created_at", ascending: false }]);
export async function createVolunteer(data: Record<string, unknown>): Promise<Volunteer> {
  try {
    return await volunteers.create(data);
  } catch (e) {
    throw treeError(e, data);
  }
}
export async function updateVolunteer(id: number, data: Record<string, unknown>): Promise<Volunteer> {
  try {
    return await volunteers.update(id, data);
  } catch (e) {
    throw treeError(e, data);
  }
}
export async function deleteVolunteer(id: number): Promise<void> {
  const { data: row } = await supabase.from("volunteers").select("photo_path").eq("id", id).maybeSingle();
  await removeFiles("volunteer-photos", [row?.photo_path]);
  await volunteers.remove(id);
}
export const volunteerPhotoUrl = (path: string) => publicUrl("volunteer-photos", path);

/** Uploads the photo, saves its path on the volunteer and removes the photo it replaces. Returns the updated volunteer. */
export async function setVolunteerPhoto(v: Volunteer, file: File): Promise<Volunteer> {
  const path = `${v.id}/${Date.now()}-${safeName(file.name)}`;
  await uploadFile("volunteer-photos", path, file);
  let saved: Volunteer;
  try {
    saved = await updateVolunteer(v.id, { photo_path: path });
  } catch (e) {
    await removeFiles("volunteer-photos", [path]);
    throw e;
  }
  await removeFiles("volunteer-photos", [v.photo_path]);
  return saved;
}
export async function removeVolunteerPhoto(v: Volunteer): Promise<Volunteer> {
  const saved = await updateVolunteer(v.id, { photo_path: null });
  await removeFiles("volunteer-photos", [v.photo_path]);
  return saved;
}

// ---------- team (website About Us: Executive Committee and Management Team) ----------
const team = crud<TeamMember>("team_members");
export const getTeamMembers = () => listAll<TeamMember>("team_members", [{ column: "team" }, { column: "sort_order" }, { column: "id" }]);
export async function createTeamMember(data: Record<string, unknown>): Promise<TeamMember> {
  try {
    return await team.create(data);
  } catch (e) {
    throw treeError(e, data);
  }
}
export async function updateTeamMember(id: number, data: Record<string, unknown>): Promise<TeamMember> {
  try {
    return await team.update(id, data);
  } catch (e) {
    throw treeError(e, data);
  }
}
export const deleteTeamMember = (id: number) => team.remove(id);

// ---------- hierarchy ----------
export interface Person {
  key: string;
  id: number;
  type: "team" | "volunteer";
  name: string;
  sub: string;
  status?: string;
  under: string | null;
}

/** Everyone who can be chosen, team first. A lead that was deleted, or a loop, counts as working under no one. */
export async function loadPeople(): Promise<Person[]> {
  const [t, v] = await Promise.all([getTeamMembers(), getVolunteers()]);
  const people: Person[] = [
    ...t.map((r) => ({ key: `team:${r.id}`, id: r.id, type: "team" as const, name: r.name, sub: r.post, under: r.reports_to || null })),
    ...v.map((r) => ({
      key: `volunteer:${r.id}`,
      id: r.id,
      type: "volunteer" as const,
      name: r.name || "Unnamed",
      sub: r.area || "",
      status: r.status,
      under: r.reports_to || null
    }))
  ];
  const by = new Map(people.map((p) => [p.key, p]));
  people.forEach((p) => {
    if (p.under && !by.has(p.under)) p.under = null;
  });
  people.forEach((p) => {
    const seen = new Set([p.key]);
    for (let x = p.under ? by.get(p.under) : undefined; x; x = x.under ? by.get(x.under) : undefined) {
      if (seen.has(x.key)) {
        p.under = null;
        break;
      }
      seen.add(x.key);
    }
  });
  return people;
}

/** Keys of everyone below `key`, at any depth (they cannot become that person's lead: it would make a loop). */
export function peopleBelow(people: Person[], key: string | null): Set<string> {
  const out = new Set<string>();
  const walk = (k: string) =>
    people.forEach((p) => {
      if (p.under === k && !out.has(p.key)) {
        out.add(p.key);
        walk(p.key);
      }
    });
  if (key) walk(key);
  return out;
}

// ---------- admins and activity ----------
export const adminPhotoUrl = (path: string) => publicUrl("admin-photos", path);

export async function getActivityLog(limit = 100): Promise<ActivityEntry[]> {
  return unwrapList(
    await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit)
  ) as ActivityEntry[];
}

export async function getAdminsList(me: { id: string; email: string }): Promise<AdminListItem[]> {
  const [admins, log] = await Promise.all([listAll<AdminProfile>("admin_profiles", [{ column: "created_at" }]), getActivityLog(1000)]);
  const counts: Record<string, number> = {};
  const labelOf: Record<string, string> = {};
  log.forEach((l) => {
    if (!l.admin_id) return;
    counts[l.admin_id] = (counts[l.admin_id] || 0) + 1;
    if (l.admin_label && !labelOf[l.admin_id]) labelOf[l.admin_id] = l.admin_label;
  });
  return admins.map((a) => ({
    ...a,
    email: a.id === me.id ? me.email : a.email || labelOf[a.id] || a.display_name || a.id.slice(0, 8),
    actions: counts[a.id] || 0
  }));
}

/** Creates the sign-in account and its admin profile. Done by the backend (service role), so public sign-up can stay off. */
export const createAdmin = (data: { email: string; password: string; display_name?: string }) =>
  backend<AdminProfile>("/api/admins", { method: "POST", body: data });

export async function updateAdmin(id: string, data: Record<string, unknown>): Promise<AdminProfile> {
  return unwrap(await supabase.from("admin_profiles").update(data).eq("id", id).select().single()) as AdminProfile;
}
export async function setAdminPhoto(a: AdminProfile, file: File): Promise<AdminProfile> {
  const path = `${a.id}/${Date.now()}-${safeName(file.name)}`;
  await uploadFile("admin-photos", path, file);
  let saved: AdminProfile;
  try {
    saved = await updateAdmin(a.id, { photo_path: path });
  } catch (e) {
    await removeFiles("admin-photos", [path]);
    throw e;
  }
  await removeFiles("admin-photos", [a.photo_path]);
  return saved;
}
export async function removeAdminPhoto(a: AdminProfile): Promise<AdminProfile> {
  const saved = await updateAdmin(a.id, { photo_path: null });
  await removeFiles("admin-photos", [a.photo_path]);
  return saved;
}
