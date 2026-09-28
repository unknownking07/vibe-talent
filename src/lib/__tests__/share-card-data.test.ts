import { describe, expect, it } from "vitest";
import { weeklyWindow } from "@/lib/share-card-data";

describe("weekly share card dates", () => {
  it("uses the completed Monday-to-Sunday week before the digest", () => {
    expect(weeklyWindow("2026-09-28")).toEqual({
      start: "2026-09-21",
      end: "2026-09-28",
      label: "Sep 21 — Sep 27",
    });
  });

  it("handles a week that crosses the year boundary", () => {
    expect(weeklyWindow("2027-01-04")).toEqual({
      start: "2026-12-28",
      end: "2027-01-04",
      label: "Dec 28 — Jan 3",
    });
  });

  it.each(["2026-09-29", "2026-02-30", "2026-9-28", "random"])("rejects invalid week %s", (value) => {
    expect(weeklyWindow(value)).toBeNull();
  });
});
