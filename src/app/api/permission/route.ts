import { UNISWAP } from "@/config/dex";
import { balanceCall, allowanceCall, permit2Call, readWord, spenderFacts } from "@/lib/server/allowance";
import { rawAll } from "@/lib/server/chainread";
import { cleanAddress, json, overBudget } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/*
 * GET /api/permission?owner=&token=&spender=&via=erc20|permit2 : the allowance a swap would rely on, read now.
 * erc20  token.allowance(owner, spender)
 * permit2 token.allowance(owner, Permit2) + Permit2.allowance(owner, token, spender), with its expiry.
 * Also says who the spender is and the owner's balance. Read-only.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const owner = cleanAddress(q.get("owner"));
  const token = cleanAddress(q.get("token"));
  const spender = cleanAddress(q.get("spender"));
  const via = q.get("via") === "permit2" ? "permit2" : "erc20";
  if (!owner || !token || !spender) return json({ error: "owner, token and spender must be addresses." }, 400);
  const refused = await overBudget(request, "wallet");
  if (refused) return refused;
  try {
    const firstSpender = via === "permit2" ? UNISWAP.permit2 : spender;
    const raw = await rawAll([allowanceCall(token, owner, firstSpender), balanceCall(token, owner), permit2Call(owner, token, spender)]);
    const facts = await spenderFacts(spender);
    const p2Amount = readWord(raw[2], 0);
    const p2Exp = readWord(raw[2], 1);
    return json({
      allowance: readWord(raw[0], 0)?.toString() ?? null,
      balance: readWord(raw[1], 0)?.toString() ?? null,
      firstSpender,
      permit2: via === "permit2" ? { amount: (p2Amount ?? 0n).toString(), expiration: (p2Exp ?? 0n).toString() } : null,
      spender: facts,
    });
  } catch {
    return json({ error: "The chain could not be read right now." }, 503);
  }
}
