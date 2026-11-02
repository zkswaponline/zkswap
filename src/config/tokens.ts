import { USDG, WETH } from "@/config/brand";
import { NATIVE } from "@/config/dex";

/*
 * Tokens offered in the pickers. Any other token can be pasted by address. Stock tokens are the official Robinhood ones
 * (beacon in the runtime code, name ending in "Robinhood Token"), found on chain on 27 Oct 2026; a ticker alone proves
 * nothing on this chain. Logos live in public/tokens and are never loaded from a third party at runtime.
 */
export type ListedToken = { address: string; symbol: string; name: string; decimals: number; logo: string | null };

const logo = (a: string) => `/tokens/${a.toLowerCase()}.webp`;
const t = (address: string, symbol: string, name: string, decimals = 18): ListedToken => ({ address: address.toLowerCase(), symbol, name, decimals, logo: logo(address) });

export const TOKENS: ListedToken[] = [
  t(NATIVE, "ETH", "Ether"),
  t(USDG.address, "USDG", "Global Dollar", 6),
  t(WETH, "WETH", "Wrapped Ether"),
  t("0xaf3d76f1834a1d425780943c99ea8a608f8a93f9", "AAPL", "Apple"),
  t("0x12f190a9f9d7d37a250758b26824b97ce941bf54", "AMZN", "Amazon"),
  t("0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3", "GOOGL", "Alphabet Class A"),
  t("0xc0d6457c16cc70d6790dd43521c899c87ce02f35", "META", "Meta Platforms"),
  t("0xe93237c50d904957cf27e7b1133b510c669c2e74", "MSFT", "Microsoft"),
  t("0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec", "NVDA", "NVIDIA"),
  t("0x117cc2133c37b721f49de2a7a74833232b3b4c0c", "SPY", "SPDR S&P 500 ETF Trust"),
  t("0x322f0929c4625ed5bad873c95208d54e1c003b2d", "TSLA", "Tesla"),
];

export const tokenByAddress = (a: string) => TOKENS.find((x) => x.address === a.toLowerCase()) ?? null;
