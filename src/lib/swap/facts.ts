import { UNISWAP, spenderInfo } from "../../config/dex.ts";
import type { Approval } from "./build.ts";
import type { Exec, Route } from "./types.ts";

/* Plain facts about a route, shared by the route table and the review panel. Pure and tested. */

/** Pool fee in percent. Uniswap fee units are hundredths of a basis point. Null: there is no fixed number to show. */
export function feePct(exec: Exec): number | null {
  if (exec.kind === "v2") return 0.3 * (exec.path.length - 1);
  if (exec.kind === "v3") return exec.fees.reduce((a, f) => a + f / 10_000, 0);
  if (exec.kind === "v4") return exec.key.fee & 0x800000 ? null : exec.key.fee / 10_000;
  return null;
}

/** "0.3%", or a sentence for venues whose fee is not one fixed number. */
export function feeText(exec: Exec): string {
  const p = feePct(exec);
  if (p !== null) return `${Number(p.toFixed(4))}%`;
  if (exec.kind === "v4") return "Dynamic (set by the hook)";
  return "Inside the curve";
}

/** Whether a v4 pool has a hook, which can change the outcome in ways a fee number cannot show. */
export const hasHook = (exec: Exec) => exec.kind === "v4" && !/^0x0{40}$/i.test(exec.key.hooks);

/** The contract the wallet calls for this route. */
export function venueContract(exec: Exec): { address: string; label: string } {
  if (exec.kind === "v2") return { address: UNISWAP.v2Router, label: "Uniswap v2 Router02" };
  if (exec.kind === "v3") return { address: UNISWAP.swapRouter02, label: "Uniswap SwapRouter02" };
  if (exec.kind === "v4") return { address: UNISWAP.universalRouter, label: "Uniswap Universal Router" };
  return { address: exec.curve, label: "Pons bonding curve" };
}

/** Who ends up allowed to move the token, in plain words. */
export function spenderLabel(a: Approval): string {
  if (a.via === "permit2") return "Permit2, then the Universal Router inside Permit2";
  return spenderInfo(a.spender)?.label ?? "Pons bonding curve of this token";
}

/** Largest uint256: the value wallets call an "unlimited" approval. */
export const MAX_UINT = 2n ** 256n - 1n;
/** Anything at or above half of the range is treated as unlimited when read back from chain. */
export const isUnlimited = (allowance: bigint) => allowance >= 2n ** 255n;
/** Permit2 stores amounts in 160 bits. */
export const MAX_UINT160 = 2n ** 160n - 1n;

export type ApprovalStep = { kind: "erc20" | "permit2"; have: bigint; need: bigint; ok: boolean; note: string };

/**
 * What must be true before the swap can run, given what chain says now. An ERC-20 route has one layer, a Permit2 route has
 * two, and the second layer also has an expiry. Comparing is exact: a smaller allowance is not enough, a larger one is noted.
 */
export function approvalSteps(a: Approval, amount: bigint, erc20: bigint, permit2?: { amount: bigint; expiration: bigint }, now = BigInt(Math.floor(Date.now() / 1000))): ApprovalStep[] {
  const first: ApprovalStep = {
    kind: "erc20",
    have: erc20,
    need: amount,
    ok: erc20 >= amount,
    note: erc20 < amount ? "Needs an approval." : isUnlimited(erc20) ? "Already unlimited. The swap does not need that much; you can lower it on the permissions page." : erc20 > amount ? "Already above this swap's amount." : "Exactly this swap's amount.",
  };
  if (a.via !== "permit2") return [first];
  const p = permit2 ?? { amount: 0n, expiration: 0n };
  const live = p.expiration > now;
  return [
    first,
    {
      kind: "permit2",
      have: live ? p.amount : 0n,
      need: amount,
      ok: live && p.amount >= amount,
      note: !live ? (p.expiration === 0n ? "No allowance inside Permit2 yet." : "The allowance inside Permit2 has expired.") : p.amount < amount ? "Below this swap's amount." : "Enough for this swap until it expires.",
    },
  ];
}

export const routeKey = (r: Pick<Route, "label">) => r.label;
