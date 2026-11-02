import { isAddress } from "@/config/brand";
import { NATIVE } from "@/config/dex";
import { json, overBudget } from "@/lib/server/http";
import { quoteAll, tokenInfo } from "@/lib/swap/quote";

export const dynamic = "force-dynamic";

/**
 * GET /api/quote?in=<address|ETH>&out=<address|ETH>&amount=<decimal text>
 * Read-only quotes across Uniswap v2/v3/v4 and Pons curves, all at one block. Nothing is signed or sent; the browser builds
 * the transaction from the chosen route and the visitor's wallet signs it, straight to the venue.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const side = (v: string | null) => (v === null ? null : v.toUpperCase() === "ETH" ? NATIVE : isAddress(v) ? v.toLowerCase() : null);
  const tin = side(q.get("in"));
  const tout = side(q.get("out"));
  const amountText = q.get("amount") ?? "";
  if (!tin || !tout) return json({ error: "Pick two assets (ETH or a 0x token address)." }, 400);
  if (tin === tout) return json({ error: "Pick two different assets." }, 400);
  if (!/^\d{1,30}(\.\d{1,36})?$/.test(amountText)) return json({ error: "Enter an amount." }, 400);
  const refused = await overBudget(request, "quote");
  if (refused) return refused;
  try {
    const [infoIn, infoOut] = await tokenInfo([tin, tout]);
    if (!infoIn || !infoOut) return json({ error: "That address does not answer as an ERC-20 token on Robinhood Chain." }, 400);
    const [w, f = ""] = amountText.split(".");
    if (f.length > infoIn.decimals) return json({ error: `${infoIn.symbol} has ${infoIn.decimals} decimals.` }, 400);
    const amountIn = BigInt(w) * 10n ** BigInt(infoIn.decimals) + BigInt(f.padEnd(infoIn.decimals, "0") || "0");
    if (amountIn <= 0n) return json({ error: "Enter an amount." }, 400);
    const answer = await quoteAll(tin, tout, amountIn);
    return json({ ...answer, tokenIn: infoIn, tokenOut: infoOut });
  } catch {
    return json({ error: "The chain could not be read right now. Try again shortly." }, 503);
  }
}
