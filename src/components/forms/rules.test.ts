import { describe, expect, it } from "vitest";
import { rules } from "./rules";

describe("form rules", () => {
  it("required / max", () => {
    expect(rules.required("Name", 5)("", {})).toBe("Name is required");
    expect(rules.required("Name", 5)("toolong", {})).toBe("Name must be 5 characters or fewer");
    expect(rules.required("Name", 5)("ok", {})).toBeNull();
    expect(rules.max("Note", 3)("abcd", {})).toMatch(/3 characters/);
  });
  it("email and phone accept empty (they are optional) but not nonsense", () => {
    expect(rules.email("", {})).toBeNull();
    expect(rules.email("a@b.co", {})).toBeNull();
    expect(rules.email("nope", {})).not.toBeNull();
    expect(rules.phone("+91 98765 43210", {})).toBeNull();
    expect(rules.phone("abc", {})).not.toBeNull();
  });
  it("whole numbers and amounts", () => {
    expect(rules.wholeNumber("Order")("12", {})).toBeNull();
    expect(rules.wholeNumber("Order")("1.5", {})).not.toBeNull();
    expect(rules.amount("Amount", true)("", {})).toBe("Amount is required");
    expect(rules.amount("Amount")("2500.50", {})).toBeNull();
    expect(rules.amount("Amount")("2500.555", {})).not.toBeNull();
  });
  it("all() returns the first complaint", () => {
    const r = rules.all(rules.email, rules.max("Email", 8));
    expect(r("not-an-email", {})).toBe("Enter a valid email address");
    expect(r("a@b.co", {})).toBeNull();
    expect(r("long@address.com", {})).toMatch(/8 characters/);
  });
});
