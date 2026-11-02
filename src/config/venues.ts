import { PONS } from "@/config/brand";
import { UNISWAP } from "@/config/dex";

/*
 * The venues a route can come from. Every address was read on chain (see src/config/dex.ts). "how" is what happens when you
 * sign; "limits" is what the numbers on this site do not cover.
 */
export type Venue = {
  slug: string;
  tag: string;
  name: string;
  short: string;
  quote: string;
  how: string;
  approval: string;
  limits: string[];
  contracts: { label: string; address: string }[];
};

export const VENUES: Venue[] = [
  {
    slug: "uniswap-v2",
    tag: "//V2",
    name: "Uniswap v2 pairs",
    short: "Constant-product pairs with a flat 0.3% fee. The simplest route to read, and often the thinnest.",
    quote: "getAmountsOut on Router02 for the direct pair, read at one block. The current price comes from the pair's reserves.",
    how: "Your wallet calls Router02 with the fee-on-transfer-safe exact-in function, your minimum and a 20-minute deadline.",
    approval: "ETH in needs none. A token in needs an approval to Router02.",
    limits: ["A token that takes a tax on transfer can pay out less than the quote; your minimum is what protects you.", "Only the direct pair is quoted; routes through a third token come from v3."],
    contracts: [
      { label: "Router02", address: UNISWAP.v2Router },
      { label: "Factory", address: UNISWAP.v2Factory },
    ],
  },
  {
    slug: "uniswap-v3",
    tag: "//V3",
    name: "Uniswap v3 pools",
    short: "Concentrated liquidity across four fee tiers, and two-hop paths through WETH or USDG.",
    quote: "QuoterV2 simulates the swap for each fee tier with a pool, plus paths through a hub token. Slot0 gives the current price.",
    how: "Your wallet calls SwapRouter02 multicall: exactInput, then an unwrap when ETH comes out.",
    approval: "ETH in needs none. A token in needs an approval to SwapRouter02.",
    limits: ["A quote holds for the block it was read at. The next swap in the pool moves it.", "Two-hop paths pay both pool fees; the table adds them up."],
    contracts: [
      { label: "SwapRouter02", address: UNISWAP.swapRouter02 },
      { label: "QuoterV2", address: UNISWAP.v3QuoterV2 },
      { label: "Factory", address: UNISWAP.v3Factory },
    ],
  },
  {
    slug: "uniswap-v4",
    tag: "//V4",
    name: "Uniswap v4 pools",
    short: "Singleton pools that may carry a hook. The pool key is read on chain before any quote is shown.",
    quote: "The v4 Quoter for pools found through the Pons factory and GeckoTerminal's public list. StateView gives the current price.",
    how: "Your wallet calls the Universal Router with V4_SWAP: swap exact in, settle all, take all. The output goes to the wallet that signs.",
    approval: "ETH in needs none. A token in needs two layers: the token to Permit2, then Permit2 to the Universal Router with an expiry.",
    limits: ["A hook can run code during your swap. The review names the hook; it cannot tell you what the hook will do next week.", "A dynamic-fee pool has no fixed fee to show. The gap to the current price shows what it took on this quote."],
    contracts: [
      { label: "Universal Router", address: UNISWAP.universalRouter },
      { label: "v4 Quoter", address: UNISWAP.v4Quoter },
      { label: "PoolManager", address: UNISWAP.v4PoolManager },
      { label: "Permit2", address: UNISWAP.permit2 },
    ],
  },
  {
    slug: "pons-curve",
    tag: "//PONS",
    name: "Pons bonding curves",
    short: "Launches still on their curve. Buys are simulated through the curve itself; sells are marked as estimates.",
    quote: "A buy is an eth_call of the curve's own buy(), from a throwaway address given ETH for that one call. A sell uses the reserve formula minus the curve's fee and creator tax, and is labelled an estimate.",
    how: "Your wallet calls the curve's buy or sell directly. A graduated launch trades in its Uniswap v4 pool instead and shows up there.",
    approval: "A buy pays in ETH and needs none. A sell needs an approval to that token's curve.",
    limits: ["Early buys can carry a snipe tax set by the launch; a buy simulation includes it, a sell estimate does not know about it.", "Sell estimates are arithmetic, not a simulation, until the allowance exists. The simulation step then runs the real call."],
    contracts: [
      { label: "Pons factory", address: PONS.factory },
      { label: "Meme hook", address: PONS.memeHook },
    ],
  },
];

export const venueBySlug = (slug: string) => VENUES.find((v) => v.slug === slug) ?? null;
