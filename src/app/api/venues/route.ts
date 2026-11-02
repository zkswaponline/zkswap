import { VENUES } from "@/config/venues";
import { rpcBatch } from "@/lib/feeds/rpc";
import { json, overBudget } from "@/lib/server/http";
import { memo } from "@/lib/server/memo";

export const dynamic = "force-dynamic";

/* GET /api/venues : whether each venue contract has code right now, cached for a minute. */
export async function GET(request: Request) {
  const refused = await overBudget(request, "market");
  if (refused) return refused;
  const all = [...new Set(VENUES.flatMap((v) => v.contracts.map((c) => c.address.toLowerCase())))];
  try {
    const { value, at } = await memo("venues", 60_000, async () => {
      const raw = await rpcBatch<string>(all.map((a) => ({ method: "eth_getCode", params: [a, "latest"] })));
      return Object.fromEntries(all.map((a, i) => [a, typeof raw[i] === "string" ? (raw[i]!.length - 2) / 2 : null]));
    });
    return json({ sizes: value, at });
  } catch {
    return json({ error: "The chain could not be read right now." }, 503);
  }
}
