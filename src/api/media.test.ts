import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {}, supabaseConfigured: true }));
const { youtubeId } = await import("./media");

describe("youtubeId", () => {
  const ID = "dQw4w9WgXcQ";
  it("reads every common link shape", () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `m.youtube.com/watch?v=${ID}&t=3s`,
      ID
    ]) {
      expect(youtubeId(url)).toBe(ID);
    }
  });
  it("rejects other links", () => {
    expect(youtubeId("https://example.com/watch?v=" + ID)).toBeNull();
    expect(youtubeId("not a link")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });
});
