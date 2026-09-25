import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

const getClaims = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims }, from }),
}));

function query(result: object) {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: object) => void) => Promise.resolve(result).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

describe("/api/notifications auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not read notifications without a verified JWT", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const response = await GET(new NextRequest("https://www.vibetalent.work/api/notifications?count=1"));
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("scopes the unread count to the verified subject", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "verified-user" } }, error: null });
    const builder = query({ count: 3 });
    from.mockReturnValue(builder);

    const response = await GET(new NextRequest("https://www.vibetalent.work/api/notifications?count=1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [], unread_count: 3 });
    expect(builder.eq).toHaveBeenCalledWith("user_id", "verified-user");
    expect(builder.eq).toHaveBeenCalledWith("read", false);
  });

  it("scopes mark-all updates to the verified subject", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "verified-user" } }, error: null });
    const builder = query({ error: null });
    from.mockReturnValue(builder);

    const response = await PATCH(new NextRequest("https://www.vibetalent.work/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ mark_all: true }),
    }));

    expect(response.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "verified-user");
    expect(builder.eq).toHaveBeenCalledWith("read", false);
  });
});
