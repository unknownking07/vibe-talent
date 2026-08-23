import { describe, it, expect, afterEach, vi } from "vitest";

import {
  transferMemo,
  transferNonceKey,
  verifyTransferProof,
  findTransferProof,
  SIGNATURE_RE,
  TRANSFER_NONCE_TTL_SECONDS,
} from "@/lib/wallet-transfer-proof";

const WALLET = "4EvnGaySWW6fhmQeTbjb7HXRbqzyCGWXPy8J8zziWwX9";
const OTHER_WALLET = "DYp2cUmgoBEYPxN9xPwiqKZoi5WR4SRAWJnLD1d5QAdT";
const SIG =
  "5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7";

function mockTx(result: unknown, init: { ok?: boolean } = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** A confirmed transaction carrying `memo`, signed by `signer`. */
function tx(memo: string, signer = WALLET) {
  return {
    meta: { err: null },
    transaction: {
      message: {
        accountKeys: [
          { pubkey: signer, signer: true, writable: true },
          {
            pubkey: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
            signer: false,
          },
        ],
        instructions: [{ program: "spl-memo", parsed: memo }],
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("transferMemo", () => {
  it("names the site in words the signer can read before approving", () => {
    // A bare transfer says nothing. This is the sentence that makes the
    // scheme non-relayable, so it has to be legible in a wallet.
    expect(transferMemo("abc")).toBe("Link wallet to vibetalent.work | abc");
  });

  it("changes with the challenge, so one transaction cannot satisfy two", () => {
    expect(transferMemo("one")).not.toBe(transferMemo("two"));
  });
});

describe("transferNonceKey", () => {
  it("is scoped per account and distinct from the signing challenge", () => {
    expect(transferNonceKey("u1")).toBe("wallet-transfer-nonce:u1");
    expect(transferNonceKey("u1")).not.toBe(transferNonceKey("u2"));
  });
});

describe("TRANSFER_NONCE_TTL_SECONDS", () => {
  it("allows longer than a signing prompt, because a transaction must be built", () => {
    expect(TRANSFER_NONCE_TTL_SECONDS).toBe(900);
  });
});

describe("SIGNATURE_RE", () => {
  it("accepts a real Solana signature", () => {
    expect(SIGNATURE_RE.test(SIG)).toBe(true);
  });

  it("rejects short input and base58's excluded characters", () => {
    expect(SIGNATURE_RE.test("abc")).toBe(false);
    expect(SIGNATURE_RE.test(`${SIG.slice(0, -1)}0`)).toBe(false);
  });
});

describe("verifyTransferProof", () => {
  const memo = transferMemo("nonce-1");

  it("returns the wallet that signed, read off the transaction", async () => {
    mockTx(tx(memo));
    await expect(verifyTransferProof(SIG, memo)).resolves.toEqual({
      ok: true,
      wallet: WALLET,
    });
  });

  it("never lets the caller name the wallet being proved", async () => {
    // The signer comes from the chain. Someone submitting a stranger's
    // transaction proves that stranger's wallet, not their own, and the link
    // route then refuses it as already taken or links the right key.
    mockTx(tx(memo, OTHER_WALLET));
    const result = await verifyTransferProof(SIG, memo);
    expect(result).toEqual({ ok: true, wallet: OTHER_WALLET });
  });

  it("rejects a transaction carrying a different challenge's memo", async () => {
    // The relay attack in one line: an attacker's challenge cannot be satisfied
    // by a transaction the victim broadcast for something else.
    mockTx(tx(transferMemo("someone-elses-nonce")));
    const result = await verifyTransferProof(SIG, memo);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a transaction with no memo at all", async () => {
    mockTx({
      meta: { err: null },
      transaction: {
        message: {
          accountKeys: [{ pubkey: WALLET, signer: true }],
          instructions: [{ program: "system", parsed: { type: "transfer" } }],
        },
      },
    });
    const result = await verifyTransferProof(SIG, memo);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a memo that merely contains the expected text", async () => {
    mockTx(tx(`${memo} and something else`));
    expect(await verifyTransferProof(SIG, memo)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a transaction that failed on-chain", async () => {
    mockTx({ ...tx(memo), meta: { err: { InstructionError: [0, "Custom"] } } });
    expect(await verifyTransferProof(SIG, memo)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a fee payer that is not a signer", async () => {
    mockTx({
      meta: { err: null },
      transaction: {
        message: {
          accountKeys: [{ pubkey: WALLET, signer: false }],
          instructions: [{ program: "spl-memo", parsed: memo }],
        },
      },
    });
    expect(await verifyTransferProof(SIG, memo)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("asks the client to retry when the transaction is not visible yet", async () => {
    // 404, not 400: the wallet may have returned before the RPC saw it, and the
    // builder has already paid the fee.
    mockTx(null);
    expect(await verifyTransferProof(SIG, memo)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("asks the client to retry when the RPC is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(await verifyTransferProof(SIG, memo)).toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("refuses a malformed signature without calling the network", async () => {
    const fetchMock = mockTx(tx(memo));
    expect(await verifyTransferProof("not-a-signature", memo)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("findTransferProof", () => {
  /** getSignaturesForAddress then getTransaction for each, in order. */
  function mockChain(
    signatures: { signature: string; err?: unknown }[],
    txs: Record<string, unknown>,
  ) {
    const fn = vi
      .fn()
      .mockImplementation(async (_url: string, init: { body: string }) => {
        const method = JSON.parse(init.body).method;
        if (method === "getSignaturesForAddress") {
          return { ok: true, json: async () => ({ result: signatures }) };
        }
        const sig = JSON.parse(init.body).params[0];
        return { ok: true, json: async () => ({ result: txs[sig] ?? null }) };
      });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  const memo = transferMemo("nonce-1");

  it("finds the proof without the builder pasting anything", async () => {
    mockChain([{ signature: SIG }], { [SIG]: tx(memo) });
    await expect(findTransferProof(WALLET, memo)).resolves.toEqual({
      ok: true,
      wallet: WALLET,
    });
  });

  it("keeps looking past the builder's unrelated transactions", async () => {
    const OTHER = SIG.replace(/^5/, "4");
    mockChain([{ signature: OTHER }, { signature: SIG }], {
      [OTHER]: tx("some other memo"),
      [SIG]: tx(memo),
    });
    await expect(findTransferProof(WALLET, memo)).resolves.toMatchObject({
      ok: true,
    });
  });

  it("will not accept a proof signed by a different wallet", async () => {
    // Pointing us at someone else's address must never link it: the memo was
    // never issued to them, and the signer has to match what was asked for.
    mockChain([{ signature: SIG }], { [SIG]: tx(memo, OTHER_WALLET) });
    await expect(findTransferProof(WALLET, memo)).resolves.toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("reports 404 while nothing has arrived, so the client can keep polling", async () => {
    mockChain([], {});
    await expect(findTransferProof(WALLET, memo)).resolves.toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("skips failed transactions without fetching them", async () => {
    const fetchMock = mockChain(
      [{ signature: SIG, err: { InstructionError: [0, "x"] } }],
      {},
    );
    await findTransferProof(WALLET, memo);
    const methods = fetchMock.mock.calls.map(
      (c) => JSON.parse((c[1] as { body: string }).body).method,
    );
    expect(methods).toEqual(["getSignaturesForAddress"]);
  });

  it("rejects a malformed address without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      findTransferProof("not-an-address", memo),
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
