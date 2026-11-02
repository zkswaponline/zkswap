import { SPENDERS, UNISWAP } from "@/config/dex";
import { TOKENS } from "@/config/tokens";
import { allowanceCall, permit2Call, readWord } from "@/lib/server/allowance";
import { rawAll } from "@/lib/server/chainread";
import { cleanAddress, json, overBudget } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const MAX_EXTRA = 4;

/*
 * GET /api/permissions?owner=&tokens=a,b : the allowances `owner` has given to the venues this site can use, across the
 * listed tokens and up to four more the visitor names. Only what is above zero comes back. It cannot see approvals to other
 * contracts: it asks about these spenders, it does not search the owner's history.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const owner = cleanAddress(q.get("owner"));
  if (!owner) return json({ error: "owner must be an address." }, 400);
  const extra = (q.get("tokens") ?? "").split(",").map((a) => cleanAddress(a)).filter((a): a is string => Boolean(a)).slice(0, MAX_EXTRA);
  const refused = await overBudget(request, "wallet");
  if (refused) return refused;
  const tokens = [...new Set([...TOKENS.map((t) => t.address).filter((a) => !/^0x0{40}$/.test(a)), ...extra])];
  const pairs = tokens.flatMap((token) => SPENDERS.map((s) => ({ token, spender: s.address })));
  try {
    const raw = await rawAll(pairs.map((p) => allowanceCall(p.token, owner, p.spender)));
    const inner = await rawAll(tokens.map((t) => permit2Call(owner, t, UNISWAP.universalRouter)));
    const rows = pairs.flatMap((p, i) => {
      const v = readWord(raw[i], 0);
      return v && v > 0n ? [{ token: p.token, spender: p.spender, amount: v.toString() }] : [];
    });
    const permit2 = tokens.flatMap((token, i) => {
      const a = readWord(inner[i], 0);
      return a && a > 0n ? [{ token, spender: UNISWAP.universalRouter, amount: a.toString(), expiration: (readWord(inner[i], 1) ?? 0n).toString() }] : [];
    });
    return json({ owner, checkedTokens: tokens.length, checkedSpenders: SPENDERS.length, rows, permit2, failed: raw.filter((r) => r === null).length });
  } catch {
    return json({ error: "The chain could not be read right now." }, 503);
  }
}
