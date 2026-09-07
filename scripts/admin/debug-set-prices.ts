/**
 * Debug why setPrices() is reverting. Probes the contract via eth_call
 * (no gas spent, no tx) with a variety of inputs to narrow down what
 * validation is failing.
 */
import { createPublicClient, http, encodeFunctionData, parseAbi, decodeErrorResult, formatUnits } from "viem";
import { base } from "viem/chains";

const CONTRACT = "0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da" as const;
const OWNER = "0xc2599F1009669f4cdA7Ac2493De06D450Fc79EF9" as const;
const RPC = "https://mainnet.base.org";

const ABI = parseAbi([
  "function setPrices(uint256, uint256, uint256, uint256, uint256)",
  "function setPrices(uint256[5])",
  "function setPrices(uint256[])",
  "function getPrices() view returns (uint256, uint256, uint256, uint256, uint256)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function PAUSED() view returns (bool)",
]);

const pub = createPublicClient({ chain: base, transport: http(RPC) });

async function tryRead(name: "owner" | "paused" | "PAUSED" | "getPrices") {
  try {
    const r = await pub.readContract({ address: CONTRACT, abi: ABI, functionName: name });
    return r;
  } catch (e) {
    return `(no ${name}: ${(e as Error).message.split("\n")[0]})`;
  }
}

async function simulateSetPrices(label: string, args: bigint[] | [bigint[]] | [readonly [bigint, bigint, bigint, bigint, bigint]]) {
  // Use a generic encoder fallback so we can test multiple ABI shapes.
  let calldata: `0x${string}`;
  try {
    if (Array.isArray(args[0])) {
      // setPrices(uint256[5]) or setPrices(uint256[])
      calldata = encodeFunctionData({
        abi: ABI,
        functionName: "setPrices",
        args: args as [readonly [bigint, bigint, bigint, bigint, bigint]],
      });
    } else {
      calldata = encodeFunctionData({
        abi: ABI,
        functionName: "setPrices",
        args: args as [bigint, bigint, bigint, bigint, bigint],
      });
    }
  } catch (e) {
    console.log(`  ${label.padEnd(40)} ENCODE-FAIL: ${(e as Error).message.split("\n")[0]}`);
    return;
  }
  try {
    await pub.call({ account: OWNER, to: CONTRACT, data: calldata });
    console.log(`  ${label.padEnd(40)} ✅ would succeed (selector ${calldata.slice(0, 10)})`);
  } catch (e) {
    const err = e as { cause?: { data?: string }; shortMessage?: string; message?: string };
    const data = err.cause?.data;
    let reason = err.shortMessage || err.message?.split("\n")[0] || "unknown";
    // Try to decode standard Error(string) revert
    if (data && data.length > 10) {
      try {
        const decoded = decodeErrorResult({
          abi: parseAbi(["error Error(string)"]),
          data: data as `0x${string}`,
        });
        reason = `Error: ${decoded.args[0]}`;
      } catch {
        // Not a standard string revert — keep raw data
        reason = `revert data: ${data.slice(0, 66)}`;
      }
    }
    console.log(`  ${label.padEnd(40)} ❌ ${reason}`);
  }
}

async function main() {
  const owner = await tryRead("owner");
  const paused = await tryRead("paused");
  const paused2 = await tryRead("PAUSED");
  const cur = await tryRead("getPrices");

  console.log("\n── Contract state ──");
  console.log(`  owner():     ${owner}`);
  console.log(`  paused():    ${paused}`);
  console.log(`  PAUSED():    ${paused2}`);
  if (Array.isArray(cur)) {
    console.log(`  getPrices(): [${cur.map((p) => "$" + formatUnits(p as bigint, 6)).join(", ")}]`);
  } else {
    console.log(`  getPrices(): ${cur}`);
  }

  console.log("\n── Probing setPrices(uint256,uint256,uint256,uint256,uint256) signatures ──");

  const cur5 = Array.isArray(cur) ? (cur as bigint[]) : null;

  // 1. Re-set the CURRENT prices (no-op) — should succeed if not paused / no other gating
  if (cur5) {
    await simulateSetPrices("set CURRENT prices (no-op)", cur5);
  }

  // 2. Slight bumps (small absolute increase)
  if (cur5) {
    const tinyBump = cur5.map((p) => p + BigInt(1)) as bigint[];
    await simulateSetPrices("CURRENT + 1 microUSDC each", tinyBump);
  }

  // 3. 2x current
  if (cur5) {
    const doubled = cur5.map((p) => p * BigInt(2)) as bigint[];
    await simulateSetPrices("CURRENT × 2", doubled);
  }

  // 4. Our target with monotonic gap (the prices we want)
  await simulateSetPrices("TARGET 2/5/10/29/199 USDC", [
    BigInt(2_000_000),
    BigInt(5_000_000),
    BigInt(10_000_000),
    BigInt(29_000_000),
    BigInt(199_000_000),
  ]);

  // 5. Same target but smaller jump (closer to current)
  await simulateSetPrices("TARGET ×3 of current", [
    BigInt(1_500_000), // $1.50
    BigInt(3_000_000), // $3
    BigInt(6_000_000), // $6
    BigInt(15_000_000), // $15
    BigInt(45_000_000), // $45
  ]);

  // 6. Even smaller bump
  await simulateSetPrices("TARGET +50% each", [
    BigInt(750_000),    // $0.75
    BigInt(1_500_000),  // $1.50
    BigInt(3_000_000),  // $3
    BigInt(7_500_000),  // $7.50
    BigInt(22_500_000), // $22.50
  ]);

  // 7. All zeros (often special-cased)
  await simulateSetPrices("all zeros", Array(5).fill(BigInt(0)));

  // 8. Try the array-shape ABI in case the contract expects a single array arg
  console.log("\n── Probing setPrices(uint256[5]) signature ──");
  await simulateSetPrices("array-arg target", [[
    BigInt(2_000_000),
    BigInt(5_000_000),
    BigInt(10_000_000),
    BigInt(29_000_000),
    BigInt(199_000_000),
  ]] as [readonly [bigint, bigint, bigint, bigint, bigint]]);
}

main().catch(console.error);
