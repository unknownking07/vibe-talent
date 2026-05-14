import { describe, it, expect } from "vitest";
import { mondayOf } from "../weekly-snapshot";

describe("mondayOf", () => {
  it("returns the same day when given a Monday", () => {
    const mon = new Date("2026-05-11T15:00:00Z");      // a Monday
    expect(mondayOf(mon).toISOString().slice(0, 10)).toBe("2026-05-11");
  });
  it("returns the previous Monday when given a Sunday", () => {
    const sun = new Date("2026-05-10T15:00:00Z");
    expect(mondayOf(sun).toISOString().slice(0, 10)).toBe("2026-05-04");
  });
  it("returns the previous Monday when given a Wednesday", () => {
    const wed = new Date("2026-05-13T15:00:00Z");
    expect(mondayOf(wed).toISOString().slice(0, 10)).toBe("2026-05-11");
  });
});
