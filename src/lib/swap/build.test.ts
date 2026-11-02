import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeAbiParameters, decodeFunctionData, parseAbi } from "viem";
import { NATIVE, ROUTER_THIS, UNISWAP, USDG, WETH } from "../../config/dex.ts";
import { buildSwap, permit2ApproveTx } from "./build.ts";
import { impactBps, minOut } from "./types.ts";

const ME = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const CURVE = "0x3333333333333333333333333333333333333333";
const base = { amountIn: 10n ** 15n, minOut: 5n, recipient: ME, deadline: 1_900_000_000n };
const low = (a: string) => a.toLowerCase();

test("v2: ETH in pays value to Router02 and needs no approval", () => {
  const tx = buildSwap({ ...base, exec: { kind: "v2", path: [WETH, USDG] }, tokenIn: NATIVE, tokenOut: USDG });
  assert.equal(tx.to, UNISWAP.v2Router);
  assert.equal(tx.value, base.amountIn);
  assert.equal(tx.approval, null);
  const d = decodeFunctionData({ abi: parseAbi(["function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)"]), data: tx.data });
  assert.equal(d.args[0], 5n);
  assert.equal(low(d.args[2]), ME);
});

test("v2: token to ETH approves the router for exactly the amount", () => {
  const tx = buildSwap({ ...base, exec: { kind: "v2", path: [USDG, WETH] }, tokenIn: USDG, tokenOut: NATIVE });
  assert.equal(tx.value, 0n);
  assert.deepEqual(tx.approval, { token: USDG, spender: UNISWAP.v2Router, via: "erc20" });
});

test("v3: ETH out swaps to the router itself, then unwraps to the wallet with the same minimum", () => {
  const tx = buildSwap({ ...base, exec: { kind: "v3", tokens: [USDG, WETH], fees: [500] }, tokenIn: USDG, tokenOut: NATIVE });
  assert.equal(tx.to, UNISWAP.swapRouter02);
  const outer = decodeFunctionData({ abi: parseAbi(["function multicall(uint256 deadline, bytes[] data)"]), data: tx.data });
  assert.equal(outer.args[0], base.deadline);
  assert.equal(outer.args[1].length, 2);
  const inner = decodeFunctionData({ abi: parseAbi(["function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum))", "function unwrapWETH9(uint256,address)"]), data: outer.args[1][0] });
  const p = inner.args[0] as { path: string; recipient: string; amountIn: bigint; amountOutMinimum: bigint };
  assert.equal(low(p.recipient), ROUTER_THIS);
  assert.equal(p.path.length, 2 + 2 * (20 + 3 + 20));
  const unwrap = decodeFunctionData({ abi: parseAbi(["function unwrapWETH9(uint256,address)"]), data: outer.args[1][1] });
  assert.equal(unwrap.args[0], 5n);
  assert.equal(low(unwrap.args[1]), ME);
});

test("v4: Universal Router V4_SWAP with the minHopPriceX36 field and exact settle/take amounts", () => {
  const key = { currency0: NATIVE, currency1: TOKEN, fee: 0, tickSpacing: 200, hooks: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" };
  const tx = buildSwap({ ...base, exec: { kind: "v4", key, zeroForOne: true }, tokenIn: NATIVE, tokenOut: TOKEN });
  assert.equal(tx.to, UNISWAP.universalRouter);
  assert.equal(tx.value, base.amountIn);
  const d = decodeFunctionData({ abi: parseAbi(["function execute(bytes,bytes[],uint256)"]), data: tx.data });
  assert.equal(d.args[0], "0x10");
  const [actions, params] = decodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], d.args[1][0]);
  assert.equal(actions, "0x060c0f");
  const [swap] = decodeAbiParameters(
    [{ type: "tuple", components: [{ name: "k", type: "tuple", components: [{ type: "address", name: "a" }, { type: "address", name: "b" }, { type: "uint24", name: "f" }, { type: "int24", name: "t" }, { type: "address", name: "h" }] }, { name: "z", type: "bool" }, { name: "i", type: "uint128" }, { name: "o", type: "uint128" }, { name: "m", type: "uint256" }, { name: "d", type: "bytes" }] }],
    params[0],
  );
  assert.equal(swap.i, base.amountIn);
  assert.equal(swap.o, 5n);
  assert.equal(swap.m, 0n);
  const take = decodeAbiParameters([{ type: "address" }, { type: "uint256" }], params[2]);
  assert.equal(low(take[0]), TOKEN);
  assert.equal(take[1], 5n);
});

test("v4: token in goes through Permit2", () => {
  const key = { currency0: NATIVE, currency1: TOKEN, fee: 0, tickSpacing: 200, hooks: NATIVE };
  const tx = buildSwap({ ...base, exec: { kind: "v4", key, zeroForOne: false }, tokenIn: TOKEN, tokenOut: NATIVE });
  assert.equal(tx.value, 0n);
  assert.equal(tx.approval?.via, "permit2");
  assert.equal(tx.approval?.spender, UNISWAP.universalRouter);
});

test("curve: buy pays ETH, sell approves the curve", () => {
  const buy = buildSwap({ ...base, exec: { kind: "curve", curve: CURVE, side: "buy" }, tokenIn: NATIVE, tokenOut: TOKEN });
  assert.equal(buy.to, CURVE);
  assert.equal(buy.value, base.amountIn);
  assert.equal(buy.data.slice(0, 10), "0x59a87bc1");
  const sell = buildSwap({ ...base, exec: { kind: "curve", curve: CURVE, side: "sell" }, tokenIn: TOKEN, tokenOut: NATIVE });
  assert.equal(sell.data.slice(0, 10), "0xd04c6983");
  assert.equal(sell.approval?.spender, CURVE);
});

test("a route that does not match the chosen assets is refused", () => {
  assert.throws(() => buildSwap({ ...base, exec: { kind: "v2", path: [WETH, TOKEN] }, tokenIn: NATIVE, tokenOut: USDG }));
  assert.throws(() => buildSwap({ ...base, exec: { kind: "curve", curve: CURVE, side: "buy" }, tokenIn: USDG, tokenOut: TOKEN }));
  assert.throws(() => buildSwap({ ...base, minOut: 0n, exec: { kind: "v2", path: [WETH, USDG] }, tokenIn: NATIVE, tokenOut: USDG }), /minimum/);
});

test("slippage minimum, impact and Permit2 bounds", () => {
  assert.equal(minOut(10_000n, 100), 9_900n);
  assert.throws(() => minOut(1n, 6000));
  assert.equal(impactBps({ label: "x", venue: "Uniswap v2", amountOut: "97", midOut: "100", estimate: false, exec: { kind: "v2", path: [] } }), 300);
  assert.throws(() => permit2ApproveTx(TOKEN, ME, 2n ** 160n, 1n));
});
