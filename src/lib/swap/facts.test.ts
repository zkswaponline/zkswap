import { test } from "node:test";
import assert from "node:assert/strict";
import { UNISWAP, USDG, WETH, NATIVE } from "../../config/dex.ts";
import { approvalSteps, feePct, feeText, hasHook, isUnlimited, spenderLabel, venueContract } from "./facts.ts";
import { approveTx, buildSwap, permit2ApproveTx } from "./build.ts";
import { decodeTx, readV3Path } from "./decode.ts";

const ME = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const base = { amountIn: 10n ** 15n, minOut: 5n, recipient: ME, deadline: 1_900_000_000n };
const key = { currency0: NATIVE, currency1: TOKEN, fee: 3000, tickSpacing: 60, hooks: "0x0000000000000000000000000000000000000000" };

test("fees: v2 per hop, v3 summed, v4 fixed or dynamic, curve has no single number", () => {
  assert.equal(feePct({ kind: "v2", path: [WETH, USDG] }), 0.3);
  assert.equal(feePct({ kind: "v3", tokens: [WETH, USDG, TOKEN], fees: [500, 3000] }), 0.35);
  assert.equal(feePct({ kind: "v4", key, zeroForOne: true }), 0.3);
  assert.equal(feePct({ kind: "v4", key: { ...key, fee: 0x800000 }, zeroForOne: true }), null);
  assert.equal(feeText({ kind: "v4", key: { ...key, fee: 0x800000 }, zeroForOne: true }), "Dynamic (set by the hook)");
  assert.equal(feeText({ kind: "curve", curve: TOKEN, side: "buy" }), "Inside the curve");
});

test("hooks are noticed", () => {
  assert.equal(hasHook({ kind: "v4", key, zeroForOne: true }), false);
  assert.equal(hasHook({ kind: "v4", key: { ...key, hooks: TOKEN }, zeroForOne: true }), true);
  assert.equal(hasHook({ kind: "v2", path: [] }), false);
});

test("the wallet is always pointed at the venue's own contract", () => {
  assert.equal(venueContract({ kind: "v2", path: [] }).address, UNISWAP.v2Router);
  assert.equal(venueContract({ kind: "v3", tokens: [], fees: [] }).address, UNISWAP.swapRouter02);
  assert.equal(venueContract({ kind: "v4", key, zeroForOne: true }).address, UNISWAP.universalRouter);
  assert.equal(venueContract({ kind: "curve", curve: TOKEN, side: "sell" }).address, TOKEN);
});

test("approval steps: exact comparison on one layer", () => {
  const a = { token: USDG, spender: UNISWAP.v2Router, via: "erc20" as const };
  assert.equal(spenderLabel(a), "Uniswap v2 Router02");
  assert.equal(approvalSteps(a, 100n, 99n)[0].ok, false);
  assert.equal(approvalSteps(a, 100n, 100n)[0].ok, true);
  assert.match(approvalSteps(a, 100n, 100n)[0].note, /Exactly/);
  assert.match(approvalSteps(a, 100n, 101n)[0].note, /above/);
  assert.match(approvalSteps(a, 100n, 2n ** 256n - 1n)[0].note, /unlimited/);
  assert.equal(isUnlimited(2n ** 255n), true);
  assert.equal(isUnlimited(2n ** 254n), false);
});

test("approval steps: Permit2 has two layers and an expiry", () => {
  const a = { token: USDG, spender: UNISWAP.universalRouter, via: "permit2" as const };
  const now = 1000n;
  const none = approvalSteps(a, 100n, 100n, undefined, now);
  assert.equal(none.length, 2);
  assert.equal(none[1].ok, false);
  assert.match(none[1].note, /No allowance/);
  const expired = approvalSteps(a, 100n, 100n, { amount: 500n, expiration: 999n }, now);
  assert.equal(expired[1].ok, false);
  assert.equal(expired[1].have, 0n);
  assert.match(expired[1].note, /expired/);
  const low = approvalSteps(a, 100n, 100n, { amount: 99n, expiration: 2000n }, now);
  assert.equal(low[1].ok, false);
  const good = approvalSteps(a, 100n, 100n, { amount: 100n, expiration: 2000n }, now);
  assert.equal(good[1].ok, true);
});

const names = { [USDG]: { symbol: "USDG", decimals: 6 }, [WETH]: { symbol: "WETH", decimals: 18 } };

test("decode: v2 reads back from the signed bytes", () => {
  const tx = buildSwap({ ...base, exec: { kind: "v2", path: [WETH, USDG] }, tokenIn: NATIVE, tokenOut: USDG });
  const d = decodeTx(tx, names);
  assert.equal(d.known, true);
  assert.equal(d.contract, "Uniswap v2 Router02");
  assert.ok(d.lines.some((l) => l.name === "Minimum received" && l.value.startsWith("0.000005 USDG")));
  assert.ok(d.lines.some((l) => l.name === "Recipient" && l.value.toLowerCase() === ME));
  assert.ok(d.lines.some((l) => l.name === "ETH sent with the call" && l.value === "0.001 ETH"));
});

test("decode: v3 opens the multicall and the packed path", () => {
  const tx = buildSwap({ ...base, exec: { kind: "v3", tokens: [USDG, WETH], fees: [500] }, tokenIn: USDG, tokenOut: NATIVE });
  const d = decodeTx(tx, names);
  assert.equal(d.fn, "multicall");
  assert.equal(d.inner?.length, 2);
  assert.equal(d.inner?.[0].fn, "exactInput");
  assert.equal(d.inner?.[1].fn, "unwrapWETH9");
  assert.ok(d.inner?.[0].lines.some((l) => l.name === "Fee tiers" && l.value === "0.05%"));
});

test("decode: v3 path helper round trips", () => {
  const hex = `0x${USDG.slice(2)}0001f4${WETH.slice(2)}000bb8${TOKEN.slice(2)}`;
  const p = readV3Path(hex);
  assert.deepEqual(p.fees, [500, 3000]);
  assert.equal(p.tokens.length, 3);
  assert.equal(p.tokens[2], TOKEN);
});

test("decode: v4 opens the Universal Router command", () => {
  const tx = buildSwap({ ...base, exec: { kind: "v4", key, zeroForOne: true }, tokenIn: NATIVE, tokenOut: TOKEN });
  const d = decodeTx(tx, names);
  assert.equal(d.contract, "Uniswap Universal Router");
  assert.ok(d.lines.some((l) => l.name === "v4 actions" && l.value === "0x060c0f"));
  assert.ok(d.lines.some((l) => l.name === "Hook"));
  assert.ok(d.lines.some((l) => l.name === "Recipient" && /signs/.test(l.value)));
});

test("decode: curve buy and sell", () => {
  const buy = buildSwap({ ...base, exec: { kind: "curve", curve: TOKEN, side: "buy" }, tokenIn: NATIVE, tokenOut: USDG });
  assert.equal(decodeTx(buy, names).fn, "buy");
  const sell = buildSwap({ ...base, exec: { kind: "curve", curve: TOKEN, side: "sell" }, tokenIn: USDG, tokenOut: NATIVE });
  assert.equal(decodeTx(sell, names).fn, "sell");
});

test("decode: approvals name an unlimited amount loudly and an exact amount in units", () => {
  const exact = approveTx(USDG, UNISWAP.v2Router, 1_500_000n);
  assert.ok(decodeTx(exact, names).lines.some((l) => l.value.startsWith("1.5 USDG")));
  const unlimited = approveTx(USDG, UNISWAP.v2Router, 2n ** 256n - 1n);
  assert.ok(decodeTx(unlimited, names).lines.some((l) => /UNLIMITED/.test(l.value)));
  const p2 = permit2ApproveTx(USDG, UNISWAP.universalRouter, 7n, 1_900_000_000n);
  const d = decodeTx(p2, names);
  assert.equal(d.contract, "Permit2");
  assert.ok(d.lines.some((l) => l.name === "Expires" && /2030/.test(l.value)));
});

test("decode: unknown bytes stay unknown", () => {
  const d = decodeTx({ to: TOKEN, data: "0xdeadbeef00" });
  assert.equal(d.known, false);
  assert.equal(d.fn, "0xdeadbeef");
});
