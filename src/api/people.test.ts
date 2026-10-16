import { describe, expect, it, vi } from "vitest";
import { makeSupabaseStub } from "@/test/supabaseStub";

vi.mock("@/lib/supabase", () => ({
  supabase: makeSupabaseStub({
    team_members: [
      { id: 1, name: "President", post: "President", reports_to: null, team: "committee", sort_order: 1 },
      { id: 2, name: "Secretary", post: "Secretary", reports_to: "team:1", team: "committee", sort_order: 2 }
    ],
    volunteers: [
      { id: 7, name: "Ravi", area: "Health", status: "active", reports_to: "team:2" },
      { id: 8, name: "Orphan", area: "", status: "active", reports_to: "team:999" }, // the lead was deleted
      { id: 9, name: "Loop A", area: "", status: "active", reports_to: "volunteer:10" },
      { id: 10, name: "Loop B", area: "", status: "active", reports_to: "volunteer:9" }
    ]
  }),
  supabaseConfigured: true
}));
const { loadPeople, peopleBelow } = await import("./people");

describe("team hierarchy", () => {
  it("lists team first, then volunteers, with their lead", async () => {
    const people = await loadPeople();
    expect(people.map((p) => p.key)).toEqual(["team:1", "team:2", "volunteer:7", "volunteer:8", "volunteer:9", "volunteer:10"]);
    expect(people.find((p) => p.key === "volunteer:7")?.under).toBe("team:2");
  });
  it("a deleted lead counts as working under no one", async () => {
    expect((await loadPeople()).find((p) => p.key === "volunteer:8")?.under).toBeNull();
  });
  it("breaks a loop instead of drawing it forever", async () => {
    const people = await loadPeople();
    const a = people.find((p) => p.key === "volunteer:9")!;
    const b = people.find((p) => p.key === "volunteer:10")!;
    expect(a.under === null || b.under === null).toBe(true);
  });
  it("everyone below a person cannot become that person as lead", async () => {
    const people = await loadPeople();
    expect([...peopleBelow(people, "team:1")].sort()).toEqual(["team:2", "volunteer:7"]);
    expect(peopleBelow(people, null).size).toBe(0);
  });
});
