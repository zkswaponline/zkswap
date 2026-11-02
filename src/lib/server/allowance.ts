import "server-only";
import { encodeFunctionData, type Abi } from "viem";
import { PONS } from "@/config/brand";
import { UNISWAP, spenderInfo } from "@/config/dex";
import { VIEW_GAS, hexBlock, latestBlock, rawAll } from "@/lib/server/chainread";
import { rpc } from "@/lib/feeds/rpc";

/* Allowance reads for the permission check, each capped in gas because the token is the visitor's choice. */

const ERC20 = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;
const P2 = [{ type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "address" }], outputs: [{ type: "uint160" }, { type: "uint48" }, { type: "uint48" }] }] as const satisfies Abi;

const word = (raw: string | null, i: number) => (raw && raw.length >= 2 + 64 * (i + 1) ? BigInt(`0x${raw.slice(2 + 64 * i, 2 + 64 * (i + 1))}`) : null);

export const allowanceCall = (token: string, owner: string, spender: string) => ({ to: token, data: encodeFunctionData({ abi: ERC20, functionName: "allowance", args: [owner as `0x${string}`, spender as `0x${string}`] }), gas: VIEW_GAS });
export const permit2Call = (owner: string, token: string, spender: string) => ({ to: UNISWAP.permit2, data: encodeFunctionData({ abi: P2, functionName: "allowance", args: [owner as `0x${string}`, token as `0x${string}`, spender as `0x${string}`] }), gas: VIEW_GAS });
export const balanceCall = (token: string, owner: string) => ({ to: token, data: encodeFunctionData({ abi: ERC20, functionName: "balanceOf", args: [owner as `0x${string}`] }), gas: VIEW_GAS });
export const readWord = word;

/** True when `curve` is the Pons curve the factory lists for the token the curve itself names. */
export async function isPonsCurve(curve: string): Promise<{ yes: boolean; token: string | null }> {
  const [tokenRaw] = await rawAll([{ to: curve, data: "0xfc0c546a" }]); // token()
  const t = tokenRaw ? `0x${tokenRaw.slice(26, 66)}` : null;
  if (!t || !/^0x[0-9a-f]{40}$/.test(t)) return { yes: false, token: null };
  const [rec] = await rawAll([{ to: PONS.factory, data: "0x3cf28b5a" + t.slice(2).padStart(64, "0") }]);
  const listed = word(rec, 1);
  return { yes: listed !== null && listed === BigInt(curve), token: t };
}

export type SpenderFacts = { label: string; what: string; known: boolean; hasCode: boolean };

export async function spenderFacts(spender: string): Promise<SpenderFacts> {
  const code = await rpc<string>("eth_getCode", [spender, "latest"]).catch(() => "0x");
  const hasCode = typeof code === "string" && code.length > 2;
  const info = spenderInfo(spender);
  if (info) return { label: info.label, what: info.what, known: true, hasCode };
  if (spender.toLowerCase() === UNISWAP.universalRouter) return { label: "Uniswap Universal Router", what: "Runs the swap. It pulls tokens through Permit2 only up to what you allowed there.", known: true, hasCode };
  const curve = hasCode ? await isPonsCurve(spender).catch(() => ({ yes: false, token: null })) : { yes: false, token: null };
  if (curve.yes) return { label: "Pons bonding curve", what: `The curve the Pons factory lists for token ${curve.token}. It pulls the token when you sell into the curve.`, known: true, hasCode };
  return { label: "Unknown contract", what: hasCode ? "Not one of the venues this site knows. Check it on the explorer before approving anything." : "No contract code at this address.", known: false, hasCode };
}

export { hexBlock, latestBlock };
