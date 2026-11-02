// Single place to change project identity. Everything on the site reads from here.
// To publish the real contract address, replace the value of CA below. The navbar copy pill, the footer, the token page
// and every explorer link derive from it. Anything that is not a 0x + 40 hex address is treated as "not launched yet".

const CA: string = "TBA";

/**
 * True once the domain points at this deployment. While false, the production *.vercel.app host is served as is
 * (kept out of search with noindex) instead of redirecting to a domain that does not serve the site.
 * 2 Nov 2026: zkswap.online is registered (RDAP) on Cloudflare name servers, no A record yet.
 */
export const DOMAIN_LIVE = true;

export const isAddress = (v: string): v is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(v);

const NAME = "zkSwap";
const SLUG = "zkswap";
/** Shown upper case everywhere; the owner wrote it as $zkswap. */
const TICKER = "ZKSWAP";
const DOMAIN = "zkswap.online";
/** The handle in the owner's order. It looks generic; confirm it is the project's. */
const X_HANDLE = "zkswaponline";

export const BRAND = {
  name: NAME,
  /** Lowercase id for package names and the like. Never used for stored keys (those are neutral). */
  slug: SLUG,
  ticker: TICKER,
  symbol: `$${TICKER}`,
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  slogan: "Compare. Verify. Swap.",
  tagline: "Exploring clearer swap routes, permission checks, and optional ZK-gated access.",
  category: "proof-aware swap interface",
  chainName: "Robinhood Chain",
  description: `${NAME} is a proof-aware swap interface for Robinhood Chain: compare quotes across venues, check the permission a swap asks for, read the decoded transaction and its simulation, then sign a direct venue transaction in your own wallet. An optional ZK access proof unlocks group screens; it does not make a swap anonymous.`,
  x: `https://x.com/${X_HANDLE}`,
  xHandle: `@${X_HANDLE}`,
  // Public source repository: none yet, so every GitHub link stays hidden.
  github: "https://github.com/zkswaponline/zkswap",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository, not the bare host. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+/.test(BRAND.github);

// Public endpoints are the default. An operator can point the site at a private RPC with ROBINHOOD_RPC_URL (server) /
// NEXT_PUBLIC_ROBINHOOD_RPC_URL (browser). Both are optional.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  decimals: 18,
  publicRpc: PUBLIC_RPC,
  rpc: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC,
  /** Second public endpoint, used for reads only when the first one fails. */
  fallbackRpc: "https://robinhood-rpc.publicnode.com",
  /** Third read endpoint for server code (some networks intercept the official host). */
  spareRpc: "https://robinhood.drpc.org",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return process.env.ROBINHOOD_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC;
}

export const TOKEN = {
  get isLive() {
    return isAddress(BRAND.ca);
  },
  get explorerUrl() {
    return isAddress(BRAND.ca) ? explorerToken(BRAND.ca) : null;
  },
};

export function explorerAddress(address: string) {
  return `${CHAIN.explorer}/address/${address}`;
}
export function explorerToken(address: string) {
  return `${CHAIN.explorer}/token/${address}`;
}
export function explorerTx(hash: string) {
  return `${CHAIN.explorer}/tx/${hash}`;
}
export function explorerBlock(n: number) {
  return `${CHAIN.explorer}/block/${n}`;
}
export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** USDG ("Global Dollar") on Robinhood Chain. Read on-chain: symbol USDG, 6 decimals. */
export const USDG = {
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  symbol: "USDG",
  name: "Global Dollar",
  decimals: 6,
} as const;

export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

/** Chainlink ETH / USD on Robinhood Chain (verified on-chain). */
export const ETH_USD_FEED = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9";

/** Pons V2 factory and the pieces of a graduated Pons pool. Checked on chain (see src/config/dex.ts). */
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
} as const;

/**
 * Chart links: DEXTools only (owner decision 23 Oct 2026). Robinhood Chain is listed on DEXTools under the chain slug
 * "robinhood"; its pair pages are /app/en/robinhood/pair-explorer/<pool or token address>.
 */
export const DEXTOOLS_CHAIN = "robinhood";
export function chartUrl(address: string): string | null {
  return /^0x([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(address) ? `https://www.dextools.io/app/en/${DEXTOOLS_CHAIN}/pair-explorer/${address.toLowerCase()}` : null;
}

/** Chart link for the token once it trades (DEXTools); null before launch. */
export function tokenChartUrl(): string | null {
  return isAddress(BRAND.ca) ? chartUrl(BRAND.ca) : null;
}

/** Launchpad for the token (Pons). One place to change it. Before the CA exists the buy buttons read "At launch". */
export const LAUNCHPAD = {
  name: "Pons",
  home: "https://ponsfamily.com/launchpad",
  tokenUrl: (address: string) => `https://ponsfamily.com/launchpad/${address.toLowerCase()}`,
} as const;

/** Buy link: the launchpad token page once the CA is real, else the launchpad home. */
export function buyUrl(): string {
  return isAddress(BRAND.ca) ? LAUNCHPAD.tokenUrl(BRAND.ca) : LAUNCHPAD.home;
}
