import { decodeAbiParameters } from "viem";

/* Turns revert data from a simulated call into words. Pure and tested. */

const PANIC: Record<number, string> = { 0x01: "an internal check failed", 0x11: "an arithmetic overflow", 0x12: "a division by zero", 0x32: "an out-of-range index" };
const KNOWN: Record<string, string> = {
  // Uniswap v2 / v3 / Permit2 / Universal Router errors people actually meet.
  "0xd81b2f2e": "Permit2 allowance has expired (AllowanceExpired).",
  "0xf96fb071": "Permit2 allowance is too low (InsufficientAllowance).",
  "0x39d35496": "The output would be below your minimum (V3TooLittleReceived).",
  "0x5bf6f916": "The transaction deadline has passed.",
  "0x8b063d73": "The output would be below your minimum (V4TooLittleReceived).",
};

export function revertWords(data: string | null | undefined, message?: string): string {
  if (data && data.length >= 10) {
    const sel = data.slice(0, 10).toLowerCase();
    try {
      if (sel === "0x08c379a0") return decodeAbiParameters([{ type: "string" }], `0x${data.slice(10)}`)[0].slice(0, 200);
      if (sel === "0x4e487b71") {
        const code = Number(decodeAbiParameters([{ type: "uint256" }], `0x${data.slice(10)}`)[0]);
        return `The contract hit ${PANIC[code] ?? `panic code ${code}`}.`;
      }
    } catch {
      // Malformed revert data: fall through to the selector.
    }
    if (KNOWN[sel]) return KNOWN[sel];
    return `The contract refused with custom error ${sel}.`;
  }
  const clean = (message ?? "").replace(/^execution reverted:?\s*/i, "").trim();
  return clean ? clean.slice(0, 200) : "The contract refused without giving a reason.";
}
