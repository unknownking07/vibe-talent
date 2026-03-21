import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getIP, checkRateLimit } from "../rate-limit";

describe("getIP", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getIP(req)).toBe("1.2.3.4");
  });

  it("extracts IP from x-real-ip header", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getIP(req)).toBe("9.8.7.6");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "9.8.7.6",
      },
    });
    expect(getIP(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(getIP(req)).toBe("unknown");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" },
    });
    expect(getIP(req)).toBe("1.2.3.4");
  });
});

describe("checkRateLimit", () => {
  it("allows request when limiter is null (Redis unavailable)", async () => {
    const result = await checkRateLimit(null, "test-ip");
    expect(result.success).toBe(true);
  });
});
