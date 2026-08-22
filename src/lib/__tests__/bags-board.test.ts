import { describe, it, expect } from "vitest";

import {
  buildBagsBoard,
  buildUnverifiedLaunches,
  shortMint,
  type BagsBuilderRow,
  type BagsLaunchRow,
} from "@/lib/bags-board";

function builder(
  over: Partial<BagsBuilderRow> & { id: string },
): BagsBuilderRow {
  return {
    username: `u-${over.id}`,
    display_name: null,
    avatar_url: null,
    // Present by default: the board only carries GitHub-verified builders, so
    // an unset handle is the exception a test opts into, not the baseline.
    github_username: `gh-${over.id}`,
    vibe_score: 0,
    streak: 0,
    ...over,
  };
}

function launch(
  over: Partial<BagsLaunchRow> & { token_mint: string; user_id: string },
): BagsLaunchRow {
  return {
    royalty_bps: 0,
    first_seen_at: "2026-08-20T00:00:00Z",
    ...over,
  };
}

describe("buildBagsBoard", () => {
  it("groups launches under their builder and counts them", () => {
    const board = buildBagsBoard(
      [
        launch({ token_mint: "mintA", user_id: "1" }),
        launch({ token_mint: "mintB", user_id: "1" }),
        launch({ token_mint: "mintC", user_id: "2" }),
      ],
      [builder({ id: "1" }), builder({ id: "2" })],
    );

    expect(board).toHaveLength(2);
    expect(board.find((e) => e.username === "u-1")?.launchCount).toBe(2);
    expect(board.find((e) => e.username === "u-2")?.launchCount).toBe(1);
  });

  it("ranks by vibe score, not by launch count", () => {
    // The builder with more launches must not outrank the one who ships more:
    // minting is cheap, and rewarding it is the failure mode of this board.
    const board = buildBagsBoard(
      [
        launch({ token_mint: "mintA", user_id: "prolific" }),
        launch({ token_mint: "mintB", user_id: "prolific" }),
        launch({ token_mint: "mintC", user_id: "builder" }),
      ],
      [
        builder({ id: "prolific", username: "prolific", vibe_score: 10 }),
        builder({ id: "builder", username: "builder", vibe_score: 900 }),
      ],
    );

    expect(board.map((e) => e.username)).toEqual(["builder", "prolific"]);
  });

  it("breaks a vibe-score tie on launch count, then on username", () => {
    const board = buildBagsBoard(
      [
        launch({ token_mint: "m1", user_id: "a" }),
        launch({ token_mint: "m2", user_id: "b" }),
        launch({ token_mint: "m3", user_id: "b" }),
        launch({ token_mint: "m4", user_id: "c" }),
      ],
      [
        builder({ id: "a", username: "aaa", vibe_score: 100 }),
        builder({ id: "b", username: "bbb", vibe_score: 100 }),
        builder({ id: "c", username: "ccc", vibe_score: 100 }),
      ],
    );

    expect(board.map((e) => e.username)).toEqual(["bbb", "aaa", "ccc"]);
  });

  it("drops a builder with no GitHub handle", () => {
    // The board states in as many words that every builder on it is
    // GitHub-verified, and linking a wallet does not require GitHub. A row
    // without a handle would sit under that sentence and make it false.
    const board = buildBagsBoard(
      [
        launch({ token_mint: "unverified", user_id: "no-gh" }),
        launch({ token_mint: "blank-gh", user_id: "blank" }),
        launch({ token_mint: "good", user_id: "ok" }),
      ],
      [
        builder({ id: "no-gh", username: "nogh", github_username: null }),
        builder({ id: "blank", username: "blank", github_username: "   " }),
        builder({ id: "ok", username: "ok" }),
      ],
    );

    expect(board.map((e) => e.username)).toEqual(["ok"]);
  });

  it("drops launches whose builder is missing or has no username", () => {
    const board = buildBagsBoard(
      [
        launch({ token_mint: "orphan", user_id: "gone" }),
        launch({ token_mint: "nameless", user_id: "no-name" }),
        launch({ token_mint: "good", user_id: "ok" }),
      ],
      [
        builder({ id: "no-name", username: null }),
        builder({ id: "ok", username: "ok" }),
      ],
    );

    expect(board.map((e) => e.username)).toEqual(["ok"]);
  });

  it("orders a builder's mints newest first and reports their earliest launch", () => {
    const board = buildBagsBoard(
      [
        launch({
          token_mint: "older",
          user_id: "1",
          first_seen_at: "2026-01-02T00:00:00Z",
        }),
        launch({
          token_mint: "newest",
          user_id: "1",
          first_seen_at: "2026-08-20T00:00:00Z",
        }),
        launch({
          token_mint: "middle",
          user_id: "1",
          first_seen_at: "2026-05-05T00:00:00Z",
        }),
      ],
      [builder({ id: "1" })],
    );

    expect(board[0]!.mints).toEqual(["newest", "middle", "older"]);
    expect(board[0]!.firstLaunchAt).toBe("2026-01-02T00:00:00Z");
  });

  it("treats a null vibe score or streak as zero rather than dropping the row", () => {
    const board = buildBagsBoard(
      [launch({ token_mint: "m", user_id: "1" })],
      [builder({ id: "1", vibe_score: null, streak: null })],
    );

    expect(board[0]).toMatchObject({ vibeScore: 0, streak: 0 });
  });

  it("returns an empty board when nobody has launched", () => {
    expect(buildBagsBoard([], [builder({ id: "1" })])).toEqual([]);
  });
});

describe("shortMint", () => {
  it("keeps both recognisable ends of a mint", () => {
    expect(shortMint("FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS")).toBe(
      "FfDYT3…BAGS",
    );
  });

  it("leaves an already-short value alone", () => {
    expect(shortMint("SHORT")).toBe("SHORT");
  });
});

describe("buildUnverifiedLaunches", () => {
  it("lists a launch nobody has claimed", () => {
    const board = buildUnverifiedLaunches(
      [
        launch({
          token_mint: "orphan",
          user_id: null as unknown as string,
          token_name: "SOME COIN",
          token_symbol: "SOME",
          volume_24h_usd: 10,
          bags_username: "someone",
        }),
      ],
      [],
    );

    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({
      mint: "orphan",
      name: "SOME COIN",
      bagsUsername: "someone",
      profileUsername: null,
    });
  });

  it("leaves verified launches to the verified board", () => {
    const board = buildUnverifiedLaunches(
      [launch({ token_mint: "good", user_id: "ok" })],
      [builder({ id: "ok", username: "ok" })],
    );
    expect(board).toEqual([]);
  });

  it("keeps a claimed launch whose builder misses the verification bar", () => {
    // Dropping it would make a builder's coin vanish after they linked a
    // wallet, which reads as a bug and removes the nudge to finish verifying.
    const board = buildUnverifiedLaunches(
      [launch({ token_mint: "thin", user_id: "nogh" })],
      [builder({ id: "nogh", username: "nogh", github_username: null })],
    );

    expect(board).toHaveLength(1);
    expect(board[0]!.profileUsername).toBe("nogh");
  });

  it("ranks by 24h volume, then by mint so the order is stable", () => {
    const board = buildUnverifiedLaunches(
      [
        launch({
          token_mint: "bbb",
          user_id: null as unknown as string,
          volume_24h_usd: 5,
        }),
        launch({
          token_mint: "aaa",
          user_id: null as unknown as string,
          volume_24h_usd: 5,
        }),
        launch({
          token_mint: "busy",
          user_id: null as unknown as string,
          volume_24h_usd: 900,
        }),
        launch({
          token_mint: "quiet",
          user_id: null as unknown as string,
          volume_24h_usd: null,
        }),
      ],
      [],
    );

    expect(board.map((l) => l.mint)).toEqual(["busy", "aaa", "bbb", "quiet"]);
  });

  it("passes hostile names through for the renderer to sanitise", () => {
    const hostile = "\u202EAYNA";
    const board = buildUnverifiedLaunches(
      [
        launch({
          token_mint: "spoof",
          user_id: null as unknown as string,
          token_name: hostile,
        }),
      ],
      [],
    );
    expect(board[0]!.name).toBe(hostile);
  });
});
