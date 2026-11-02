import { encodeAbiParameters, encodeFunctionData, encodePacked, type Abi } from "viem";
import { NATIVE, ROUTER_THIS, UNISWAP, WETH } from "../../config/dex.ts";
import type { Exec } from "./types.ts";

/*
 * Turns a quoted route into the one transaction that performs it, plus the approval it needs (if any).
 * Pure: no network, so `npm test` checks the calldata. The wallet sends what this returns, unchanged.
 *
 *   v2     Uniswap v2 Router02, the fee-on-transfer-safe exact-in functions (ERC-20 in: approve the router)
 *   v3     SwapRouter02 multicall(deadline, [exactInput, unwrapWETH9 when ETH comes out]) (ERC-20 in: approve it)
 *   v4     Universal Router V4_SWAP: SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL (ERC-20 in: Permit2)
 *   curve  the Pons curve's own buy (ETH in) or sell (token in: approve the curve)
 */

const low = (a: string) => a.toLowerCase();
const isEth = (a: string) => low(a) === NATIVE;

export type Approval = { token: string; spender: string; via: "erc20" | "permit2" };
export type SwapTx = { to: string; data: `0x${string}`; value: bigint; approval: Approval | null };

const V2_ABI = [
  { type: "function", name: "swapExactETHForTokensSupportingFeeOnTransferTokens", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "swapExactTokensForETHSupportingFeeOnTransferTokens", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "swapExactTokensForTokensSupportingFeeOnTransferTokens", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }], outputs: [] },
] as const satisfies Abi;

const SR02_ABI = [
  { type: "function", name: "multicall", stateMutability: "payable", inputs: [{ type: "uint256", name: "deadline" }, { type: "bytes[]", name: "data" }], outputs: [{ type: "bytes[]" }] },
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [{ type: "tuple", components: [{ name: "path", type: "bytes" }, { name: "recipient", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" }] }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "unwrapWETH9", stateMutability: "payable", inputs: [{ type: "uint256", name: "amountMinimum" }, { type: "address", name: "recipient" }], outputs: [] },
] as const satisfies Abi;

const UR_ABI = [
  { type: "function", name: "execute", stateMutability: "payable", inputs: [{ type: "bytes" }, { type: "bytes[]" }, { type: "uint256" }], outputs: [] },
] as const satisfies Abi;

const CURVE_ABI = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

const KEY_TUPLE = {
  type: "tuple",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
  ],
} as const;

const V4_EXACT_IN_SINGLE = [
  {
    type: "tuple",
    components: [
      { name: "poolKey", ...KEY_TUPLE },
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint128" },
      { name: "amountOutMinimum", type: "uint128" },
      { name: "minHopPriceX36", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
  },
] as const;

/** Universal Router command and v4 action bytes. */
export const UR_V4_SWAP = "0x10";
export const V4_ACTIONS = "0x060c0f"; // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL

export type BuildArgs = {
  exec: Exec;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minOut: bigint;
  recipient: string;
  /** Unix seconds after which the swap must revert. */
  deadline: bigint;
};

export function buildSwap(a: BuildArgs): SwapTx {
  if (a.amountIn <= 0n) throw new Error("Enter an amount.");
  if (a.minOut <= 0n) throw new Error("The minimum output must be above zero.");
  const ethIn = isEth(a.tokenIn);
  const ethOut = isEth(a.tokenOut);
  if (ethIn && ethOut) throw new Error("Pick two different assets.");
  const recipient = a.recipient as `0x${string}`;
  const e = a.exec;

  if (e.kind === "v2") {
    const path = e.path as `0x${string}`[];
    if (path.length < 2 || low(path[0]) !== low(ethIn ? WETH : a.tokenIn) || low(path[path.length - 1]) !== low(ethOut ? WETH : a.tokenOut)) {
      throw new Error("Route does not match the assets.");
    }
    if (ethIn) {
      return { to: UNISWAP.v2Router, value: a.amountIn, approval: null, data: encodeFunctionData({ abi: V2_ABI, functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens", args: [a.minOut, path, recipient, a.deadline] }) };
    }
    const fn = ethOut ? "swapExactTokensForETHSupportingFeeOnTransferTokens" : "swapExactTokensForTokensSupportingFeeOnTransferTokens";
    return {
      to: UNISWAP.v2Router,
      value: 0n,
      approval: { token: a.tokenIn, spender: UNISWAP.v2Router, via: "erc20" },
      data: encodeFunctionData({ abi: V2_ABI, functionName: fn, args: [a.amountIn, a.minOut, path, recipient, a.deadline] }),
    };
  }

  if (e.kind === "v3") {
    if (e.tokens.length !== e.fees.length + 1 || e.fees.length < 1 || e.fees.length > 2) throw new Error("Unsupported v3 path.");
    if (low(e.tokens[0]) !== low(ethIn ? WETH : a.tokenIn) || low(e.tokens[e.tokens.length - 1]) !== low(ethOut ? WETH : a.tokenOut)) {
      throw new Error("Route does not match the assets.");
    }
    const types: ("address" | "uint24")[] = [];
    const values: (string | number)[] = [];
    e.tokens.forEach((t, i) => {
      types.push("address");
      values.push(t);
      if (i < e.fees.length) {
        types.push("uint24");
        values.push(e.fees[i]);
      }
    });
    const path = encodePacked(types, values as never);
    const swap = encodeFunctionData({
      abi: SR02_ABI,
      functionName: "exactInput",
      // ETH out: the router keeps the WETH, then unwraps it to the recipient with the same minimum.
      args: [{ path, recipient: ethOut ? ROUTER_THIS : recipient, amountIn: a.amountIn, amountOutMinimum: a.minOut }],
    });
    const calls: `0x${string}`[] = [swap];
    if (ethOut) calls.push(encodeFunctionData({ abi: SR02_ABI, functionName: "unwrapWETH9", args: [a.minOut, recipient] }));
    return {
      to: UNISWAP.swapRouter02,
      value: ethIn ? a.amountIn : 0n,
      approval: ethIn ? null : { token: a.tokenIn, spender: UNISWAP.swapRouter02, via: "erc20" },
      data: encodeFunctionData({ abi: SR02_ABI, functionName: "multicall", args: [a.deadline, calls] }),
    };
  }

  if (e.kind === "v4") {
    const k = e.key;
    const cin = e.zeroForOne ? k.currency0 : k.currency1;
    const cout = e.zeroForOne ? k.currency1 : k.currency0;
    if (low(cin) !== low(a.tokenIn) || low(cout) !== low(a.tokenOut)) throw new Error("Route does not match the assets.");
    if (a.amountIn >= 2n ** 128n || a.minOut >= 2n ** 128n) throw new Error("Amount too large.");
    const swap = encodeAbiParameters(V4_EXACT_IN_SINGLE, [
      {
        poolKey: { currency0: k.currency0 as `0x${string}`, currency1: k.currency1 as `0x${string}`, fee: k.fee, tickSpacing: k.tickSpacing, hooks: k.hooks as `0x${string}` },
        zeroForOne: e.zeroForOne,
        amountIn: a.amountIn,
        amountOutMinimum: a.minOut,
        minHopPriceX36: 0n,
        hookData: "0x",
      },
    ]);
    const settle = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [cin as `0x${string}`, a.amountIn]);
    const take = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [cout as `0x${string}`, a.minOut]);
    const input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [V4_ACTIONS, [swap, settle, take]]);
    // TAKE_ALL pays msg.sender: the swap always lands in the wallet that signs it.
    return {
      to: UNISWAP.universalRouter,
      value: ethIn ? a.amountIn : 0n,
      approval: ethIn ? null : { token: a.tokenIn, spender: UNISWAP.universalRouter, via: "permit2" },
      data: encodeFunctionData({ abi: UR_ABI, functionName: "execute", args: [UR_V4_SWAP, [input], a.deadline] }),
    };
  }

  // Pons curve: priced in ETH only.
  if (e.side === "buy") {
    if (!ethIn) throw new Error("A curve buy pays in ETH.");
    return { to: e.curve, value: a.amountIn, approval: null, data: encodeFunctionData({ abi: CURVE_ABI, functionName: "buy", args: [a.amountIn, a.minOut, recipient] }) };
  }
  if (!ethOut) throw new Error("A curve sell pays out ETH.");
  return {
    to: e.curve,
    value: 0n,
    approval: { token: a.tokenIn, spender: e.curve, via: "erc20" },
    data: encodeFunctionData({ abi: CURVE_ABI, functionName: "sell", args: [a.amountIn, a.minOut, recipient] }),
  };
}

const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

const PERMIT2_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "address" }], outputs: [{ type: "uint160" }, { type: "uint48" }, { type: "uint48" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }, { type: "uint160" }, { type: "uint48" }], outputs: [] },
] as const satisfies Abi;

export const encodeAllowance = (token: string, owner: string, spender: string) =>
  ({ to: token, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "allowance", args: [owner as `0x${string}`, spender as `0x${string}`] }) });
export const encodeBalanceOf = (token: string, owner: string) =>
  ({ to: token, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "balanceOf", args: [owner as `0x${string}`] }) });
export const encodePermit2Allowance = (owner: string, token: string, spender: string) =>
  ({ to: UNISWAP.permit2, data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "allowance", args: [owner as `0x${string}`, token as `0x${string}`, spender as `0x${string}`] }) });

/** An approval of exactly `amount` (never unlimited). */
export const approveTx = (token: string, spender: string, amount: bigint) => ({
  to: token,
  value: 0n,
  data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender as `0x${string}`, amount] }),
});

/** Permit2 allowance of exactly `amount` for `spender`, valid until `expiration` (unix seconds). */
export const permit2ApproveTx = (token: string, spender: string, amount: bigint, expiration: bigint) => {
  if (amount >= 2n ** 160n) throw new Error("Amount too large.");
  return {
    to: UNISWAP.permit2,
    value: 0n,
    data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [token as `0x${string}`, spender as `0x${string}`, amount, Number(expiration)] }),
  };
};

/** Reads one 32-byte word of an eth_call answer as an unsigned integer (0 when missing). */
export function wordAt(raw: string | null | undefined, i: number): bigint {
  if (!raw || raw.length < 2 + 64 * (i + 1)) return 0n;
  return BigInt(`0x${raw.slice(2 + 64 * i, 2 + 64 * (i + 1))}`);
}
