/*
 * Small pure helpers of the swap screen, kept apart so they can be tested: amount text, deadlines and how routes become the
 * three columns of the table.
 */
import { formatUnits, parseUnits } from "viem";
import { impactBps, type Route } from "./types.ts";

export const DEADLINE_SECONDS = 20 * 60;
/** Second-layer Permit2 allowance lasts this long: long enough to sign the swap, short enough to expire unused. */
export const PERMIT2_EXPIRY_SECONDS = 30 * 60;

export function parseAmount(text: string, decimals: number): bigint | null {
  const t = text.trim();
  if (!/^\d{1,30}(\.\d{0,36})?$/.test(t)) return null;
  const f = t.split(".")[1] ?? "";
  if (f.length > decimals) return null;
  try {
    const v = parseUnits(t.endsWith(".") ? t.slice(0, -1) : t, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

/** A raw amount as a short readable number: never rounds to a misleading zero. */
export function showAmount(raw: string | bigint, decimals: number, digits = 6): string {
  const s = formatUnits(BigInt(raw), decimals);
  const [w, f = ""] = s.split(".");
  if (!f) return Number(w).toLocaleString("en-US");
  if (w !== "0") return `${Number(w).toLocaleString("en-US")}.${f.slice(0, Math.max(2, digits - Math.min(w.length, digits - 2))).replace(/0+$/, "") || "0"}`.replace(/\.0$/, "");
  const firstNonZero = f.search(/[1-9]/);
  if (firstNonZero < 0) return "0";
  return `0.${f.slice(0, firstNonZero + 4).replace(/0+$/, "")}`;
}

export function slippageBps(percentText: string): number | null {
  const n = Number(percentText);
  if (!Number.isFinite(n) || n < 0 || n > 50) return null;
  return Math.round(n * 100);
}

export function costText(route: Route): string {
  const b = impactBps(route);
  return b === null ? "—" : `${(b / 100).toFixed(2)}%`;
}

/** The three columns of the table: best output in the middle (the dark one), then the next two. */
export function topThree(routes: Route[]): { left: Route | null; mid: Route | null; right: Route | null } {
  return { mid: routes[0] ?? null, left: routes[1] ?? null, right: routes[2] ?? null };
}

/** How much less a route pays than the best one, in percent; null for the best itself. */
export function behindBest(route: Route, best: Route): string | null {
  const a = BigInt(best.amountOut);
  const b = BigInt(route.amountOut);
  if (a === 0n || b >= a) return null;
  return `${(Number(((a - b) * 100_000n) / a) / 1000).toFixed(3)}% less`;
}
