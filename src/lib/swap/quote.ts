import "server-only";
import { decodeFunctionResult, encodeAbiParameters, encodeFunctionData, encodePacked, keccak256, type Abi } from "viem";
import { PONS } from "@/config/brand";
import { GT_NETWORK, NATIVE, UNISWAP, USDG, V3_FEES, WETH } from "@/config/dex";
import { rpc, rpcBatch } from "@/lib/feeds/rpc";
import type { PoolKey, QuoteAnswer, Route, TokenInfo } from "@/lib/swap/types";

/*
 * Read-only swap quotes on Robinhood Chain, all at one block. Nothing is signed or sent:
 *   Uniswap v2   Router02 getAmountsOut on the direct pair (ETH as WETH)
 *   Uniswap v3   QuoterV2 per fee tier with a pool, and two-hop paths through WETH or USDG
 *   Uniswap v4   the v4 Quoter for the token's Pons pool (from the Pons factory) and for v4 pools GeckoTerminal lists
 *   Pons curve   buys: eth_call of the curve's own buy() from a throwaway address given ETH for that one call
 *                (state override); sells: the curve's reserve formula minus its fee and creator tax (marked estimate)
 * Each route also carries the output at current pool prices, so the gap shows price impact plus fees.
 */

const low = (a: string) => a.toLowerCase();
const QUOTE_GAS = "0x2dc6c0"; // 3,000,000 per quoter simulation
const VIEW_GAS = "0x1d4c0"; // 120,000 per view read
const SIM_FROM = "0x00000000000000000000000000000000000f1140";
const ZERO = /^0x0{40}$/i;

const V2_ROUTER_ABI = [{ type: "function", name: "getAmountsOut", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address[]" }], outputs: [{ type: "uint256[]" }] }] as const satisfies Abi;
const V2_FACTORY_ABI = [{ type: "function", name: "getPair", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "address" }] }] as const satisfies Abi;
const V2_PAIR_ABI = [
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const satisfies Abi;
const V3_FACTORY_ABI = [{ type: "function", name: "getPool", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] }] as const satisfies Abi;
const V3_QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [{ type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }],
    outputs: [{ type: "uint256" }, { type: "uint160" }, { type: "uint32" }, { type: "uint256" }],
  },
  { type: "function", name: "quoteExactInput", stateMutability: "nonpayable", inputs: [{ type: "bytes" }, { type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint160[]" }, { type: "uint32[]" }, { type: "uint256" }] },
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
const V4_QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [{ type: "tuple", components: [{ name: "poolKey", ...KEY_TUPLE }, { name: "zeroForOne", type: "bool" }, { name: "exactAmount", type: "uint128" }, { name: "hookData", type: "bytes" }] }],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
] as const satisfies Abi;
const V4_POSITIONS_ABI = [
  { type: "function", name: "poolKeys", stateMutability: "view", inputs: [{ type: "bytes25" }], outputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }] },
] as const satisfies Abi;
const V4_STATE_ABI = [
  { type: "function", name: "getSlot0", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint24" }, { type: "uint24" }] },
] as const satisfies Abi;
const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const satisfies Abi;
const CURVE_ABI = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "creatorTaxBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "graduated", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const satisfies Abi;

const enc = (abi: Abi, fn: string, args: readonly unknown[] = []) => encodeFunctionData({ abi, functionName: fn, args } as never);
function dec<T>(abi: Abi, fn: string, raw: string | null | undefined): T | null {
  if (!raw || raw === "0x") return null;
  try {
    return decodeFunctionResult({ abi, functionName: fn, data: raw as `0x${string}` } as never) as T;
  } catch {
    return null;
  }
}
const word = (raw: string | null | undefined, i: number) => (raw && raw.length >= 2 + 64 * (i + 1) ? `0x${raw.slice(2 + 64 * i, 2 + 64 * (i + 1))}` : null);
const wordAddr = (raw: string | null | undefined, i: number) => {
  const w = word(raw, i);
  return w ? `0x${w.slice(26)}` : null;
};

type Call = { to: string; data: string; gas?: string; from?: string; value?: string };

/** eth_call in batches of 20 at one block. A failed call is null; nothing is retried on another endpoint mid-quote. */
async function callAll(calls: Call[], tag: string): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (let i = 0; i < calls.length; i += 20) {
    const chunk = calls.slice(i, i + 20);
    const raw = await rpcBatch<string>(chunk.map((c) => ({ method: "eth_call", params: [{ gas: VIEW_GAS, ...c }, tag] }))).catch(() => chunk.map(() => null));
    chunk.forEach((_, k) => out.push(typeof raw[k] === "string" && (raw[k] as string).length > 2 ? (raw[k] as string) : null));
  }
  return out;
}

/** Output per input of a pool at its current price, as a ratio of raw units. */
type Mid = { num: bigint; den: bigint };
const midFromSqrt = (sqrtP: bigint, zeroForOne: boolean): Mid | null => {
  if (sqrtP === 0n) return null;
  const p2 = sqrtP * sqrtP;
  const q192 = 2n ** 192n;
  return zeroForOne ? { num: p2, den: q192 } : { num: q192, den: p2 };
};
const applyMids = (amountIn: bigint, mids: Mid[]) => mids.reduce((a, m) => (a * m.num) / m.den, amountIn);

export const poolIdOf = (k: PoolKey) =>
  keccak256(encodeAbiParameters([KEY_TUPLE], [{ currency0: k.currency0 as `0x${string}`, currency1: k.currency1 as `0x${string}`, fee: k.fee, tickSpacing: k.tickSpacing, hooks: k.hooks as `0x${string}` }]));

/** Symbol and decimals of an ERC-20 (or ETH for the zero address). Null when the address does not answer as a token. */
export async function tokenInfo(addresses: string[]): Promise<(TokenInfo | null)[]> {
  const calls: Call[] = addresses.flatMap((a) => (low(a) === NATIVE ? [] : [{ to: a, data: enc(ERC20_ABI, "decimals") }, { to: a, data: enc(ERC20_ABI, "symbol") }]));
  const raw = calls.length ? await callAll(calls, "latest") : [];
  let i = 0;
  return addresses.map((a) => {
    if (low(a) === NATIVE) return { address: NATIVE, symbol: "ETH", decimals: 18 };
    const d = dec<number>(ERC20_ABI, "decimals", raw[i++]);
    const s = dec<string>(ERC20_ABI, "symbol", raw[i++]);
    if (d === null || d > 36) return null;
    return { address: low(a), symbol: (s ?? "TOKEN").replace(/[^\x20-\x7e]/g, "").slice(0, 16) || "TOKEN", decimals: Number(d) };
  });
}

/** Uniswap v4 pool ids GeckoTerminal lists for a token (best effort, 4 s, at most 6). */
async function geckoV4Pools(token: string): Promise<string[]> {
  if (low(token) === NATIVE || low(token) === low(WETH)) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/${GT_NETWORK}/tokens/${low(token)}/pools?page=1`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: { attributes?: { address?: string } }[] };
    return (body.data ?? [])
      .map((p) => p.attributes?.address ?? "")
      .filter((a) => /^0x[0-9a-fA-F]{64}$/.test(a))
      .slice(0, 6)
      .map(low);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

type Pons = { token: string; curve: string; phase: number; key: PoolKey | null };

/** The Pons V2 launch record of `token`, when it is an ETH-priced Pons launch. */
async function ponsLaunch(token: string, tag: string): Promise<Pons | null> {
  if (low(token) === NATIVE) return null;
  const [rec] = await callAll([{ to: PONS.factory, data: "0x3cf28b5a" + token.slice(2).toLowerCase().padStart(64, "0") }], tag);
  if (!rec || BigInt(word(rec, 14) ?? "0x0") !== 1n) return null;
  if (!ZERO.test(wordAddr(rec, 4) ?? "")) return null; // priced in something other than ETH
  const curve = wordAddr(rec, 1)!;
  const phase = Number(BigInt(word(rec, 10)!));
  const fee = Number(BigInt(word(rec, 6)!));
  const tickSpacing = Number(BigInt.asIntN(256, BigInt(word(rec, 7)!)));
  return { token: low(token), curve: low(curve), phase, key: phase === 2 ? { currency0: NATIVE, currency1: low(token), fee, tickSpacing, hooks: low(PONS.memeHook) } : null };
}

/**
 * Every route that answers for `amountIn` raw units of `tokenIn` → `tokenOut`, best output first. ETH is the zero
 * address. Routes that revert (no pool, no liquidity, graduated curve) are left out.
 */
export async function quoteAll(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Omit<QuoteAnswer, "tokenIn" | "tokenOut">> {
  const tin = low(tokenIn);
  const tout = low(tokenOut);
  const block = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const tag = `0x${block.toString(16)}`;
  // v2 and v3 trade WETH; ETH is wrapped by the router.
  const win = tin === NATIVE ? low(WETH) : tin;
  const wout = tout === NATIVE ? low(WETH) : tout;
  const wrapOnly = win === wout;

  const [ponsIn, ponsOut, geckoIn, geckoOut] = await Promise.all([ponsLaunch(tin, tag), ponsLaunch(tout, tag), geckoV4Pools(tin), geckoV4Pools(tout)]);

  // Phase 1: which pools exist.
  const hubs = [low(WETH), low(USDG)].filter((h) => h !== win && h !== wout);
  type Probe = { what: "v2" | "v3" | "hubIn" | "hubOut" | "v4key"; fee?: number; hub?: string; id?: string } & Call;
  const probes: Probe[] = [];
  if (!wrapOnly) {
    probes.push({ what: "v2", to: UNISWAP.v2Factory, data: enc(V2_FACTORY_ABI, "getPair", [win, wout]) });
    for (const fee of V3_FEES) probes.push({ what: "v3", fee, to: UNISWAP.v3Factory, data: enc(V3_FACTORY_ABI, "getPool", [win, wout, fee]) });
    for (const hub of hubs)
      for (const fee of V3_FEES) {
        probes.push({ what: "hubIn", fee, hub, to: UNISWAP.v3Factory, data: enc(V3_FACTORY_ABI, "getPool", [win, hub, fee]) });
        probes.push({ what: "hubOut", fee, hub, to: UNISWAP.v3Factory, data: enc(V3_FACTORY_ABI, "getPool", [hub, wout, fee]) });
      }
  }
  const ids = [...new Set([...geckoIn, ...geckoOut])];
  for (const id of ids) probes.push({ what: "v4key", id, to: UNISWAP.v4Positions, data: enc(V4_POSITIONS_ABI, "poolKeys", [id.slice(0, 52)]) });
  const probeRaw = await callAll(probes, tag);
  const addrOf = (raw: string | null) => {
    const a = wordAddr(raw, 0);
    return a && !ZERO.test(a) ? low(a) : null;
  };

  type Leg = { pool: string; kind: 2 | 3 | 4; tokenIn: string; tokenOut: string; zeroForOne?: boolean };
  type Cand = { route: Omit<Route, "amountOut" | "midOut">; legs: Leg[]; call: Call | null; decode: (raw: string | null) => bigint | null };
  const cands: Cand[] = [];

  const v2Pair = probes.length && probes[0].what === "v2" ? addrOf(probeRaw[0]) : null;
  if (v2Pair)
    cands.push({
      route: { label: "Uniswap v2", venue: "Uniswap v2", estimate: false, exec: { kind: "v2", path: [win, wout] } },
      legs: [{ pool: v2Pair, kind: 2, tokenIn: win, tokenOut: wout }],
      call: { to: UNISWAP.v2Router, data: enc(V2_ROUTER_ABI, "getAmountsOut", [amountIn, [win, wout]]) },
      decode: (raw) => dec<readonly bigint[]>(V2_ROUTER_ABI, "getAmountsOut", raw)?.[1] ?? null,
    });
  const hubPools = new Map<string, string>();
  probes.forEach((p, i) => {
    const a = p.what === "v4key" ? null : addrOf(probeRaw[i]);
    if (!a) return;
    if (p.what === "v3")
      cands.push({
        route: { label: `Uniswap v3 · ${p.fee! / 10_000}%`, venue: "Uniswap v3", estimate: false, exec: { kind: "v3", tokens: [win, wout], fees: [p.fee!] } },
        legs: [{ pool: a, kind: 3, tokenIn: win, tokenOut: wout }],
        call: { to: UNISWAP.v3QuoterV2, gas: QUOTE_GAS, data: enc(V3_QUOTER_ABI, "quoteExactInputSingle", [{ tokenIn: win, tokenOut: wout, amountIn, fee: p.fee!, sqrtPriceLimitX96: 0n }]) },
        decode: (raw) => dec<readonly bigint[]>(V3_QUOTER_ABI, "quoteExactInputSingle", raw)?.[0] ?? null,
      });
    if (p.what === "hubIn" || p.what === "hubOut") hubPools.set(`${p.what}:${p.hub}:${p.fee}`, a);
  });
  for (const hub of hubs) {
    const ins = V3_FEES.filter((f) => hubPools.has(`hubIn:${hub}:${f}`));
    const outs = V3_FEES.filter((f) => hubPools.has(`hubOut:${hub}:${f}`));
    const hubName = hub === low(WETH) ? "WETH" : "USDG";
    for (const [fa, fb] of ins.flatMap((a) => outs.map((b) => [a, b] as const)).slice(0, 4)) {
      const path = encodePacked(["address", "uint24", "address", "uint24", "address"], [win as `0x${string}`, fa, hub as `0x${string}`, fb, wout as `0x${string}`]);
      cands.push({
        route: { label: `Uniswap v3 · via ${hubName}`, venue: "Uniswap v3", estimate: false, exec: { kind: "v3", tokens: [win, hub, wout], fees: [fa, fb] } },
        legs: [
          { pool: hubPools.get(`hubIn:${hub}:${fa}`)!, kind: 3, tokenIn: win, tokenOut: hub },
          { pool: hubPools.get(`hubOut:${hub}:${fb}`)!, kind: 3, tokenIn: hub, tokenOut: wout },
        ],
        call: { to: UNISWAP.v3QuoterV2, gas: QUOTE_GAS, data: enc(V3_QUOTER_ABI, "quoteExactInput", [path, amountIn]) },
        decode: (raw) => dec<readonly bigint[]>(V3_QUOTER_ABI, "quoteExactInput", raw)?.[0] ?? null,
      });
    }
  }

  // v4: the Pons pool of either side plus listed pools whose two currencies are exactly the pair.
  const keys = new Map<string, PoolKey>();
  for (const p of [ponsIn, ponsOut]) if (p?.key) keys.set(poolIdOf(p.key), p.key);
  probes.forEach((p, i) => {
    if (p.what !== "v4key") return;
    const k = dec<readonly [string, string, number, number, string]>(V4_POSITIONS_ABI, "poolKeys", probeRaw[i]);
    if (!k || ZERO.test(k[1])) return;
    const key = { currency0: low(k[0]), currency1: low(k[1]), fee: Number(k[2]), tickSpacing: Number(k[3]), hooks: low(k[4]) };
    if (poolIdOf(key) === p.id) keys.set(p.id!, key);
  });
  if (amountIn < 2n ** 128n)
    for (const [id, key] of keys) {
      const pairMatch = (key.currency0 === tin && key.currency1 === tout) || (key.currency0 === tout && key.currency1 === tin);
      if (!pairMatch) continue;
      const zeroForOne = key.currency0 === tin;
      const feeText = key.fee & 0x800000 ? "dynamic fee" : `${key.fee / 10_000}%`;
      const isPons = key.hooks === low(PONS.memeHook);
      cands.push({
        route: { label: isPons ? "Uniswap v4 · Pons pool" : `Uniswap v4 · ${feeText}${ZERO.test(key.hooks) ? "" : " · hooked"}`, venue: "Uniswap v4", estimate: false, exec: { kind: "v4", key, zeroForOne } },
        legs: [{ pool: id, kind: 4, tokenIn: tin, tokenOut: tout, zeroForOne }],
        call: { to: UNISWAP.v4Quoter, gas: QUOTE_GAS, data: enc(V4_QUOTER_ABI, "quoteExactInputSingle", [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: "0x" }]) },
        decode: (raw) => dec<readonly bigint[]>(V4_QUOTER_ABI, "quoteExactInputSingle", raw)?.[0] ?? null,
      });
    }

  // Pons curves before graduation: buy with ETH, sell for ETH.
  const curveRoutes: Route[] = [];
  const curveSide = tin === NATIVE && ponsOut && ponsOut.phase === 0 ? { p: ponsOut, side: "buy" as const } : tout === NATIVE && ponsIn && ponsIn.phase === 0 ? { p: ponsIn, side: "sell" as const } : null;
  if (curveSide) {
    const c = curveSide.p.curve;
    const head = await callAll(
      [
        { to: c, data: enc(CURVE_ABI, "getReserves") },
        { to: c, data: enc(CURVE_ABI, "feeBps") },
        { to: c, data: enc(CURVE_ABI, "creatorTaxBps") },
        { to: c, data: enc(CURVE_ABI, "graduated") },
      ],
      tag,
    );
    const reserves = dec<readonly [bigint, bigint]>(CURVE_ABI, "getReserves", head[0]);
    const fee = dec<bigint>(CURVE_ABI, "feeBps", head[1]) ?? 0n;
    const tax = dec<bigint>(CURVE_ABI, "creatorTaxBps", head[2]) ?? 0n;
    const graduated = dec<boolean>(CURVE_ABI, "graduated", head[3]);
    if (reserves && graduated === false && reserves[0] > 0n && reserves[1] > 0n) {
      const [q, t] = reserves;
      if (curveSide.side === "buy") {
        let out: bigint | null = null;
        try {
          const raw = await rpc<string>("eth_call", [
            { from: SIM_FROM, to: c, gas: QUOTE_GAS, value: `0x${amountIn.toString(16)}`, data: enc(CURVE_ABI, "buy", [amountIn, 0n, SIM_FROM]) },
            tag,
            { [SIM_FROM]: { balance: `0x${(amountIn + 10n ** 18n).toString(16)}` } },
          ]);
          out = dec<bigint>(CURVE_ABI, "buy", raw);
        } catch {
          out = null;
        }
        if (out && out > 0n)
          curveRoutes.push({ label: "Pons curve", venue: "Pons curve", estimate: false, amountOut: out.toString(), midOut: ((amountIn * t) / q).toString(), exec: { kind: "curve", curve: c, side: "buy" } });
      } else {
        const gross = (amountIn * q) / (t + amountIn);
        const out = gross - (gross * fee) / 10_000n - (gross * tax) / 10_000n;
        if (out > 0n)
          curveRoutes.push({ label: "Pons curve", venue: "Pons curve", estimate: true, amountOut: out.toString(), midOut: ((amountIn * q) / t).toString(), exec: { kind: "curve", curve: c, side: "sell" } });
      }
    }
  }

  // Phase 2: quotes plus each leg's current price.
  const legs = [...new Map(cands.flatMap((c) => c.legs).map((l) => [`${l.pool}:${l.tokenIn}`, l])).values()];
  const legCalls: Call[] = legs.map((l) =>
    l.kind === 2 ? { to: l.pool, data: enc(V2_PAIR_ABI, "getReserves") } : l.kind === 3 ? { to: l.pool, data: "0x3850c7bd" } : { to: UNISWAP.v4StateView, data: enc(V4_STATE_ABI, "getSlot0", [l.pool]) },
  );
  const v2Legs = legs.filter((l) => l.kind === 2);
  const raw = await callAll([...cands.map((c) => c.call!), ...legCalls, ...v2Legs.map((l) => ({ to: l.pool, data: enc(V2_PAIR_ABI, "token0") }))], tag);
  const quoteRaw = raw.slice(0, cands.length);
  const legRaw = raw.slice(cands.length, cands.length + legs.length);
  const t0Raw = raw.slice(cands.length + legs.length);
  const mids = new Map<string, Mid | null>();
  let v2i = 0;
  legs.forEach((l, i) => {
    const r = legRaw[i];
    let mid: Mid | null = null;
    if (r && l.kind === 2) {
      const res = dec<readonly [bigint, bigint, number]>(V2_PAIR_ABI, "getReserves", r);
      const token0 = wordAddr(t0Raw[v2i++], 0);
      if (res && token0 && res[0] > 0n && res[1] > 0n) mid = low(token0) === l.tokenIn ? { num: res[1], den: res[0] } : { num: res[0], den: res[1] };
    } else if (r) {
      const sqrtP = BigInt(word(r, 0) ?? "0x0");
      mid = midFromSqrt(sqrtP, l.kind === 4 ? Boolean(l.zeroForOne) : BigInt(l.tokenIn) < BigInt(l.tokenOut));
    } else if (l.kind === 2) v2i++;
    mids.set(`${l.pool}:${l.tokenIn}`, mid);
  });

  const routes: Route[] = [...curveRoutes];
  cands.forEach((c, i) => {
    const out = c.decode(quoteRaw[i]);
    if (out === null || out <= 0n) return;
    const legMids = c.legs.map((l) => mids.get(`${l.pool}:${l.tokenIn}`) ?? null);
    routes.push({ ...c.route, amountOut: out.toString(), midOut: legMids.every(Boolean) ? applyMids(amountIn, legMids as Mid[]).toString() : null });
  });
  routes.sort((a, b) => (BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : BigInt(b.amountOut) < BigInt(a.amountOut) ? -1 : 0));
  return { block, amountIn: amountIn.toString(), routes };
}
