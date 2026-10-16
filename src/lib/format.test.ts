import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./export";
import { clip, fmtDate, inr, localDay, slugify, stamp } from "./format";

describe("format", () => {
  it("formats rupees the Indian way", () => {
    expect(inr(125000)).toBe("₹1,25,000");
    expect(inr(null)).toBe("₹0");
  });
  it("turns a title into a web address", () => {
    expect(slugify("A Mat, a Slate… and a Second Chance!")).toBe("a-mat-a-slate-and-a-second-chance");
    expect(slugify("   ")).toBe("");
  });
  it("shortens long text and tidies whitespace", () => {
    expect(clip("a   b\n c", 10)).toBe("a b c");
    expect(clip("x".repeat(20), 5)).toBe("xxxxx…");
  });
  it("uses the local day, not UTC", () => expect(localDay(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05"));
  it("writes stamps for exports", () => expect(stamp(new Date(2026, 9, 5, 7, 5))).toBe("2026-10-05 07:05"));
  it("formats dates and tolerates empty ones", () => {
    expect(fmtDate("2026-07-22")).toMatch(/22/);
    expect(fmtDate(null)).toBe("");
  });
});

describe("csv export", () => {
  it("blocks spreadsheet formulas and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('""');
  });
  it("joins rows", () =>
    expect(
      toCsv([
        ["a", "b"],
        [1, 2]
      ])
    ).toBe(`"a","b"\n"1","2"`));
});
