import { UNISWAP } from "@/config/dex";
import { readBody, tooLarge, badBody } from "@/lib/guard";
import { RpcError, rpc } from "@/lib/feeds/rpc";
import { isPonsCurve } from "@/lib/server/allowance";
import { cleanAddress, json, overBudget } from "@/lib/server/http";
import { decodeTx } from "@/lib/swap/decode";
import { revertWords } from "@/lib/swap/revert";

export const dynamic = "force-dynamic";

const MAX = 8_192;
const GAS = "0x2dc6c0"; // 3,000,000
/** Used when no wallet is connected: an empty address given ETH for this one call. */
const SIM_FROM = "0x00000000000000000000000000000000000f1140";
const VENUES = new Set<string>([UNISWAP.v2Router, UNISWAP.swapRouter02, UNISWAP.universalRouter, UNISWAP.permit2]);
const APPROVE = "0x095ea7b3";

type Body = { from?: unknown; to?: unknown; data?: unknown; value?: unknown };

/*
 * POST /api/simulate {from?, to, data, value?}: an eth_call of the exact transaction the wallet would be asked to sign, plus
 * a gas estimate. Only what this site itself builds is simulated: a venue swap or a token approve; anything else is refused.
 * It never signs or sends. A clean simulation is a statement about this block, not a promise about the next one.
 */
export async function POST(request: Request) {
  const read = await readBody<Body>(request, MAX);
  if (!read.ok) return read.tooLarge ? tooLarge() : badBody();
  const b = read.value ?? {};
  const to = cleanAddress(typeof b.to === "string" ? b.to : null);
  const from = b.from === undefined || b.from === null ? null : cleanAddress(String(b.from));
  const data = typeof b.data === "string" && /^0x[0-9a-fA-F]{8,}$/.test(b.data) && b.data.length % 2 === 0 ? (b.data as `0x${string}`) : null;
  const valueText = typeof b.value === "string" && /^\d{1,40}$/.test(b.value) ? b.value : "0";
  if (!to || !data || (b.from !== undefined && b.from !== null && !from)) return json({ error: "to, data and from must be well formed." }, 400);
  const refused = await overBudget(request, "quote");
  if (refused) return refused;
  const value = BigInt(valueText);

  const isApprove = data.slice(0, 10).toLowerCase() === APPROVE && data.length === 138;
  let allowed = VENUES.has(to) || isApprove;
  if (!allowed) allowed = (await isPonsCurve(to).catch(() => ({ yes: false }))).yes;
  const decoded = decodeTx({ to, data, value });
  if (!allowed || !decoded.known) return json({ error: "Only transactions this site builds can be simulated." }, 400);

  const tx = { from: from ?? SIM_FROM, to, data, gas: GAS, ...(value > 0n ? { value: `0x${value.toString(16)}` } : {}) };
  const override = from ? [] : [{ [SIM_FROM]: { balance: `0x${(value + 10n ** 19n).toString(16)}` } }];
  try {
    const block = await rpc<string>("eth_blockNumber", []);
    await rpc<string>("eth_call", [tx, block, ...override]);
    let gas: string | null = null;
    if (from) {
      try {
        gas = BigInt(await rpc<string>("eth_estimateGas", [tx])).toString();
      } catch {
        gas = null;
      }
    }
    return json({ ok: true, block: Number(BigInt(block)), gas, simulatedFrom: from ?? "a throwaway address given ETH for this one call" });
  } catch (e) {
    if (e instanceof RpcError && e.revert) return json({ ok: false, revert: revertWords(e.data, e.message), simulatedFrom: from ?? "a throwaway address given ETH for this one call" });
    return json({ error: "The chain could not be read right now. Try again shortly." }, 503);
  }
}
