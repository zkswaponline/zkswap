/*
 * Shapes shared by the quote API (server) and the swap card (browser). Amounts travel as decimal strings.
 * ETH is the zero address on both sides; v2 and v3 routes wrap it through WETH, v4 and Pons curves take it native.
 */

export type PoolKey = { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string };

/** How a route is executed. Every variant names exactly the contract the wallet will call. */
export type Exec =
  | { kind: "v2"; path: string[] }
  | { kind: "v3"; tokens: string[]; fees: number[] }
  | { kind: "v4"; key: PoolKey; zeroForOne: boolean }
  | { kind: "curve"; curve: string; side: "buy" | "sell" };

export type Route = {
  /** "Uniswap v3 · 0.3%", "Pons curve" … */
  label: string;
  venue: "Uniswap v2" | "Uniswap v3" | "Uniswap v4" | "Pons curve";
  amountOut: string;
  /** Output at the pools' current prices before fees and price movement, when it could be read. */
  midOut: string | null;
  /** True when the number is computed from reserves instead of a simulation of the swap itself. */
  estimate: boolean;
  exec: Exec;
};

export type TokenInfo = { address: string; symbol: string; decimals: number };

export type QuoteAnswer = {
  block: number;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  routes: Route[];
};

/** Price impact plus fees, in basis points, from the mid output and the quoted output. */
export function impactBps(route: Route): number | null {
  if (!route.midOut) return null;
  const mid = BigInt(route.midOut);
  const out = BigInt(route.amountOut);
  if (mid <= 0n) return null;
  if (out >= mid) return 0;
  return Number(((mid - out) * 10_000n) / mid);
}

/** Minimum output after `slippageBps`, rounded down. */
export function minOut(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 5000) throw new Error("Slippage must be between 0% and 50%.");
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}
