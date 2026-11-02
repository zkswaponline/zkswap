/*
 * Swap venues on Robinhood Chain (id 4663). Each address below was read on chain on 30 Oct 2026 through
 * robinhood-rpc.publicnode.com: code present, and the cross-checks noted on each line answered as shown.
 * Nothing here is a zkSwap contract; the site only sends the visitor's own swaps to them.
 */

export const NATIVE = "0x0000000000000000000000000000000000000000";
/** Wrapped ether on Robinhood Chain (v2 router WETH() and SwapRouter02 WETH9() both return it). */
export const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
/** Global Dollar (USDG), 6 decimals. Many lookalikes use the same symbol; only this address is listed. */
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

export const UNISWAP = {
  v2Factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",
  /** Uniswap v2 Router02: factory() = v2Factory, WETH() = WETH. */
  v2Router: "0x89e5db8b5aa49aa85ac63f691524311aeb649eba",
  v3Factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  /** QuoterV2: factory() = v3Factory, WETH9() = WETH. */
  v3QuoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
  /** SwapRouter02: factory() = v3Factory, factoryV2() = v2Factory, WETH9() = WETH. exactInput has no deadline field. */
  swapRouter02: "0xcaf681a66d020601342297493863e78c959e5cb2",
  v4PoolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  v4StateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  v4Quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
  v4Positions: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
  /**
   * Universal Router: poolManager() = v4PoolManager. Its v4 SWAP_EXACT_IN_SINGLE params carry an extra
   * minHopPriceX36 field before hookData (a huge value there makes the swap revert, checked by simulation).
   */
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
} as const;

/** Uniswap v3 fee tiers (hundredths of a basis point). */
export const V3_FEES = [100, 500, 3000, 10000] as const;

/** Addresses SwapRouter02 reads as "the caller" and "this router" when given as a recipient. */
export const ROUTER_MSG_SENDER = "0x0000000000000000000000000000000000000001";
export const ROUTER_THIS = "0x0000000000000000000000000000000000000002";

/** GeckoTerminal network id, used only to find which Uniswap v4 pools a token trades in. */
export const GT_NETWORK = "robinhood";

export type SpenderInfo = { address: string; label: string; what: string };

/** Contracts a swap on this site can ask you to approve. Anything else is shown as unknown. */
export const SPENDERS: SpenderInfo[] = [
  { address: UNISWAP.v2Router, label: "Uniswap v2 Router02", what: "Moves the approved token into the pair for a v2 swap." },
  { address: UNISWAP.swapRouter02, label: "Uniswap SwapRouter02", what: "Moves the approved token into the pool for a v3 swap." },
  { address: UNISWAP.permit2, label: "Permit2", what: "Holds a second allowance layer. It can pass tokens only to spenders you approved inside Permit2, up to the amount and until the expiry you set there." },
];

export const spenderInfo = (a: string) => SPENDERS.find((s) => s.address === a.toLowerCase()) ?? null;
