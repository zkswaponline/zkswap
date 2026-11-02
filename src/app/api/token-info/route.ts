import { cleanAddress, json, overBudget } from "@/lib/server/http";
import { tokenInfo } from "@/lib/swap/quote";

export const dynamic = "force-dynamic";

/* GET /api/token-info?address= : symbol and decimals of a pasted token, read from chain. */
export async function GET(request: Request) {
  const address = cleanAddress(new URL(request.url).searchParams.get("address"));
  if (!address) return json({ error: "That is not an address." }, 400);
  const refused = await overBudget(request, "token");
  if (refused) return refused;
  try {
    const [info] = await tokenInfo([address]);
    return info ? json(info) : json({ error: "That address does not answer as an ERC-20 token on Robinhood Chain." }, 400);
  } catch {
    return json({ error: "The chain could not be read right now." }, 503);
  }
}
