/**
 * Push new featured-promotion prices to the on-chain contract on Base.
 *
 * Two ways to use this:
 *
 *   1) DRY RUN (default) — just prints the encoded calldata so you can
 *      paste it into MetaMask / Rabby / Frame / Safe as a custom contract call.
 *      Run:  npx tsx scripts/admin/set-featured-prices.ts
 *
 *   2) BROADCAST — set ADMIN_PRIVATE_KEY in your env (do NOT commit it) and
 *      this script signs + sends the tx itself. Owner wallet only.
 *      Run:  ADMIN_PRIVATE_KEY=0x... npx tsx scripts/admin/set-featured-prices.ts --broadcast
 *
 * Contract: 0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da (Base mainnet)
 * Owner:    0xc2599F1009669f4cdA7Ac2493De06D450Fc79EF9 (must sign)
 *
 * After this lands, both the homepage Featured Projects card and /pricing
 * automatically pick up the new numbers — no FE redeploy needed.
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const CONTRACT_ADDR = "0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da" as const;
const EXPECTED_OWNER = "0xc2599F1009669f4cdA7Ac2493De06D450Fc79EF9" as const;
const RPC = "https://mainnet.base.org";

// USDC has 6 decimals on Base.
// Index = contract package ID. Index 1 (3-day) is hidden in the UI but kept
// for array shape. Annual maps to package 4 which the contract treats as
// Lifetime — slot persists indefinitely. The on-chain function is
// updatePrices(), not setPrices() — earlier versions of this script had the
// wrong selector and every broadcast fell through the dispatcher and reverted.
const NEW_PRICES_USD = [
  { idx: 0, label: "Day",            usd: 2 },
  { idx: 1, label: "3-day (hidden)", usd: 5 },
  { idx: 2, label: "Week",           usd: 10 },
  { idx: 3, label: "Month",          usd: 29 },
  { idx: 4, label: "Annual",         usd: 199 },
] as const;

const SET_PRICES_ABI = parseAbi([
  "function updatePrices(uint256, uint256, uint256, uint256, uint256)",
  "function owner() view returns (address)",
  "function getPrices() view returns (uint256, uint256, uint256, uint256, uint256)",
]);

function toUsdc6(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

async function main() {
  const args = process.argv.slice(2);
  const broadcast = args.includes("--broadcast");

  const prices = NEW_PRICES_USD.map((p) => toUsdc6(p.usd)) as [bigint, bigint, bigint, bigint, bigint];

  const calldata = encodeFunctionData({
    abi: SET_PRICES_ABI,
    functionName: "updatePrices",
    args: prices,
  });

  // Read current state to show a diff
  const pub = createPublicClient({ chain: base, transport: http(RPC) });
  let owner: string | null = null;
  let currentPrices: readonly [bigint, bigint, bigint, bigint, bigint] | null = null;
  try {
    owner = (await pub.readContract({ address: CONTRACT_ADDR, abi: SET_PRICES_ABI, functionName: "owner" })) as string;
  } catch {
    console.warn("⚠  Could not read owner() — contract may use a non-standard ownership pattern.");
  }
  try {
    currentPrices = (await pub.readContract({
      address: CONTRACT_ADDR,
      abi: SET_PRICES_ABI,
      functionName: "getPrices",
    })) as readonly [bigint, bigint, bigint, bigint, bigint];
  } catch (e) {
    console.error("Could not read current prices:", e);
  }

  console.log("\n──────────────────────────────────────────────────────");
  console.log("  updatePrices() — Featured Promotions Contract (Base)");
  console.log("──────────────────────────────────────────────────────");
  console.log(`  Contract:       ${CONTRACT_ADDR}`);
  console.log(`  Owner on-chain: ${owner ?? "(unknown)"}`);
  console.log(`  Expected owner: ${EXPECTED_OWNER}`);
  if (owner && owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    console.warn("  ⚠  On-chain owner differs from the one we expected.");
  }
  console.log("\n  Diff (USDC):");
  console.log("  " + "tier".padEnd(18) + "current".padEnd(12) + "new".padEnd(12));
  for (const p of NEW_PRICES_USD) {
    const cur = currentPrices ? `$${formatUnits(currentPrices[p.idx], 6)}` : "?";
    const next = `$${p.usd.toFixed(2)}`;
    const arrow = cur === next ? "=" : "→";
    console.log(`  ${p.label.padEnd(18)}${cur.padEnd(12)}${arrow}  ${next}`);
  }
  console.log(`\n  To:        ${CONTRACT_ADDR}`);
  console.log(`  Value:     0 ETH`);
  console.log(`  Calldata:  ${calldata}`);
  console.log("──────────────────────────────────────────────────────\n");

  if (!broadcast) {
    console.log("DRY RUN. To broadcast:");
    console.log("  Option A — paste the To/Calldata above into MetaMask/Rabby/Frame as a custom contract call");
    console.log("  Option B — re-run with: ADMIN_PRIVATE_KEY=0x... npx tsx scripts/admin/set-featured-prices.ts --broadcast\n");
    return;
  }

  const pk = process.env.ADMIN_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x")) {
    console.error("✗ ADMIN_PRIVATE_KEY env var missing or malformed (must start with 0x).");
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  if (owner && account.address.toLowerCase() !== owner.toLowerCase()) {
    console.error(`✗ Connected account ${account.address} is not the contract owner (${owner}).`);
    process.exit(1);
  }

  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });
  console.log(`Broadcasting from ${account.address}…`);
  const hash = await wallet.sendTransaction({
    to: CONTRACT_ADDR,
    data: calldata,
    value: 0n,
  });
  console.log(`✓ Sent: https://basescan.org/tx/${hash}`);
  console.log("Waiting for confirmation…");
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status === "success") {
    console.log(`✓ Confirmed in block ${receipt.blockNumber}.`);
  } else {
    console.error("✗ Transaction reverted.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
