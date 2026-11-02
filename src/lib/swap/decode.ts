import { decodeAbiParameters, decodeFunctionData, formatUnits, type Abi } from "viem";
import { UNISWAP } from "../../config/dex.ts";

/*
 * Reads a transaction back into plain lines. It is deliberately separate from build.ts: the review panel decodes the exact
 * bytes the wallet will be asked to sign, not the values the builder started from, so a mistake in the builder shows up
 * here instead of being hidden by it. Pure and tested.
 */

export type DecodedLine = { name: string; value: string; kind?: "address" | "amount" | "text" };
export type Decoded = { contract: string; fn: string; lines: DecodedLine[]; inner?: Decoded[]; known: boolean };

const ABI = [
  { type: "function", name: "swapExactETHForTokensSupportingFeeOnTransferTokens", stateMutability: "payable", inputs: [{ type: "uint256", name: "amountOutMin" }, { type: "address[]", name: "path" }, { type: "address", name: "to" }, { type: "uint256", name: "deadline" }], outputs: [] },
  { type: "function", name: "swapExactTokensForETHSupportingFeeOnTransferTokens", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "amountIn" }, { type: "uint256", name: "amountOutMin" }, { type: "address[]", name: "path" }, { type: "address", name: "to" }, { type: "uint256", name: "deadline" }], outputs: [] },
  { type: "function", name: "swapExactTokensForTokensSupportingFeeOnTransferTokens", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "amountIn" }, { type: "uint256", name: "amountOutMin" }, { type: "address[]", name: "path" }, { type: "address", name: "to" }, { type: "uint256", name: "deadline" }], outputs: [] },
  { type: "function", name: "multicall", stateMutability: "payable", inputs: [{ type: "uint256", name: "deadline" }, { type: "bytes[]", name: "data" }], outputs: [] },
  { type: "function", name: "exactInput", stateMutability: "payable", inputs: [{ type: "tuple", name: "params", components: [{ name: "path", type: "bytes" }, { name: "recipient", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" }] }], outputs: [] },
  { type: "function", name: "unwrapWETH9", stateMutability: "payable", inputs: [{ type: "uint256", name: "amountMinimum" }, { type: "address", name: "recipient" }], outputs: [] },
  { type: "function", name: "execute", stateMutability: "payable", inputs: [{ type: "bytes", name: "commands" }, { type: "bytes[]", name: "inputs" }, { type: "uint256", name: "deadline" }], outputs: [] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ type: "uint256", name: "quoteIn" }, { type: "uint256", name: "minTokensOut" }, { type: "address", name: "recipient" }], outputs: [] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "tokensIn" }, { type: "uint256", name: "minQuoteOut" }, { type: "address", name: "recipient" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address", name: "spender" }, { type: "uint256", name: "amount" }], outputs: [] },
  { type: "function", name: "recordAccess", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "groupId" }, { type: "bytes", name: "proof" }, { type: "bytes32", name: "root" }, { type: "uint32", name: "epoch" }, { type: "bytes32", name: "nullifier" }], outputs: [] },
] as const satisfies Abi;

const PERMIT2_APPROVE = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address", name: "token" }, { type: "address", name: "spender" }, { type: "uint160", name: "amount" }, { type: "uint48", name: "expiration" }], outputs: [] }] as const satisfies Abi;

const V4_PARAMS = [
  {
    type: "tuple",
    components: [
      { name: "poolKey", type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] },
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint128" },
      { name: "amountOutMinimum", type: "uint128" },
      { name: "minHopPriceX36", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
  },
] as const;

export type TokenNames = Record<string, { symbol: string; decimals: number }>;
const NAMES: Record<string, string> = {
  [UNISWAP.v2Router]: "Uniswap v2 Router02",
  [UNISWAP.swapRouter02]: "Uniswap SwapRouter02",
  [UNISWAP.universalRouter]: "Uniswap Universal Router",
  [UNISWAP.permit2]: "Permit2",
};

const amount = (v: bigint, token: string | null, names: TokenNames) => {
  const t = token ? names[token.toLowerCase()] : null;
  return t ? `${formatUnits(v, t.decimals)} ${t.symbol} (${v} raw)` : `${v} raw`;
};
const when = (v: bigint) => (v < 4_000_000_000n ? `${new Date(Number(v) * 1000).toISOString().replace(".000Z", "Z")} (unix ${v})` : String(v));
const line = (name: string, value: string, kind?: DecodedLine["kind"]): DecodedLine => ({ name, value, kind });

/** Splits a v3 packed path into tokens and fee tiers. */
export function readV3Path(path: string): { tokens: string[]; fees: number[] } {
  const hex = path.replace(/^0x/, "");
  const tokens: string[] = [];
  const fees: number[] = [];
  let i = 0;
  while (i + 40 <= hex.length) {
    tokens.push(`0x${hex.slice(i, i + 40)}`);
    i += 40;
    if (i + 6 <= hex.length) {
      fees.push(parseInt(hex.slice(i, i + 6), 16));
      i += 6;
    }
  }
  return { tokens, fees };
}

export type DecodeInput = { to: string; data: `0x${string}`; value?: bigint };

export function decodeTx(tx: DecodeInput, names: TokenNames = {}): Decoded {
  const to = tx.to.toLowerCase();
  const contract = NAMES[to] ?? names[to]?.symbol ?? to;
  const eth = names["0x0000000000000000000000000000000000000000"] ?? { symbol: "ETH", decimals: 18 };
  const valueLine = tx.value && tx.value > 0n ? [line("ETH sent with the call", `${formatUnits(tx.value, 18)} ${eth.symbol}`, "amount")] : [];
  try {
    if (to === UNISWAP.permit2) {
      const d = decodeFunctionData({ abi: PERMIT2_APPROVE, data: tx.data });
      const [token, spender, amt, exp] = d.args;
      return { contract, fn: "approve", known: true, lines: [line("Token", token, "address"), line("Spender inside Permit2", spender, "address"), line("Amount", amount(amt, token, names), "amount"), line("Expires", when(BigInt(exp)))] };
    }
    const d = decodeFunctionData({ abi: ABI, data: tx.data });
    switch (d.functionName) {
      case "swapExactETHForTokensSupportingFeeOnTransferTokens": {
        const [min, path, rec, dl] = d.args;
        return { contract, fn: d.functionName, known: true, lines: [...valueLine, line("Path", path.join(" → "), "address"), line("Minimum received", amount(min, path[path.length - 1], names), "amount"), line("Recipient", rec, "address"), line("Deadline", when(dl))] };
      }
      case "swapExactTokensForETHSupportingFeeOnTransferTokens":
      case "swapExactTokensForTokensSupportingFeeOnTransferTokens": {
        const [inn, min, path, rec, dl] = d.args;
        return { contract, fn: d.functionName, known: true, lines: [line("Amount in", amount(inn, path[0], names), "amount"), line("Path", path.join(" → "), "address"), line("Minimum received", amount(min, path[path.length - 1], names), "amount"), line("Recipient", rec, "address"), line("Deadline", when(dl))] };
      }
      case "multicall": {
        const [dl, calls] = d.args;
        return { contract, fn: "multicall", known: true, lines: [...valueLine, line("Deadline", when(dl)), line("Calls inside", String(calls.length))], inner: calls.map((c) => decodeTx({ to, data: c }, names)) };
      }
      case "exactInput": {
        const [p] = d.args;
        const { tokens, fees } = readV3Path(p.path);
        return { contract, fn: "exactInput", known: true, lines: [line("Path", tokens.join(" → "), "address"), line("Fee tiers", fees.map((f) => `${f / 10_000}%`).join(" + ")), line("Amount in", amount(p.amountIn, tokens[0], names), "amount"), line("Minimum received", amount(p.amountOutMinimum, tokens[tokens.length - 1], names), "amount"), line("Recipient", p.recipient, "address")] };
      }
      case "unwrapWETH9": {
        const [min, rec] = d.args;
        return { contract, fn: "unwrapWETH9", known: true, lines: [line("Minimum ETH", `${formatUnits(min, 18)} ETH`, "amount"), line("Recipient", rec, "address")] };
      }
      case "execute": {
        const [commands, inputs, dl] = d.args;
        const lines = [...valueLine, line("Commands", commands), line("Deadline", when(dl))];
        if (commands === "0x10" && inputs.length === 1) {
          const [actions, params] = decodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], inputs[0]);
          const [s] = decodeAbiParameters(V4_PARAMS, params[0]);
          const k = s.poolKey;
          const cin = s.zeroForOne ? k.currency0 : k.currency1;
          const cout = s.zeroForOne ? k.currency1 : k.currency0;
          lines.push(line("v4 actions", actions), line("Pool key", `${k.currency0} / ${k.currency1}, fee ${k.fee}, spacing ${k.tickSpacing}`, "address"), line("Hook", k.hooks, "address"), line("Amount in", amount(s.amountIn, cin, names), "amount"), line("Minimum received", amount(s.amountOutMinimum, cout, names), "amount"), line("Recipient", "The wallet that signs (TAKE_ALL pays the caller)"));
        }
        return { contract, fn: "execute", known: true, lines };
      }
      case "buy": {
        const [q, min, rec] = d.args;
        return { contract, fn: "buy", known: true, lines: [...valueLine, line("ETH in", `${formatUnits(q, 18)} ETH`, "amount"), line("Minimum tokens", `${min} raw`, "amount"), line("Recipient", rec, "address")] };
      }
      case "sell": {
        const [t, min, rec] = d.args;
        return { contract, fn: "sell", known: true, lines: [line("Tokens in", `${t} raw`, "amount"), line("Minimum ETH", `${formatUnits(min, 18)} ETH`, "amount"), line("Recipient", rec, "address")] };
      }
      case "approve": {
        const [sp, amt] = d.args;
        return { contract, fn: "approve", known: true, lines: [line("Spender", sp, "address"), line("Amount", amt === 2n ** 256n - 1n ? "UNLIMITED (the largest number the token can store)" : amount(amt, to, names), "amount")] };
      }
      case "recordAccess": {
        const [g, proof, root, epoch, nul] = d.args;
        return { contract, fn: "recordAccess", known: true, lines: [line("Group", String(g)), line("Proof", `${(proof.length - 2) / 2} bytes`), line("Root", root), line("Epoch", String(epoch)), line("Nullifier", nul)] };
      }
    }
  } catch {
    // Falls through to the plain answer: unknown bytes are shown as unknown, never guessed.
  }
  return { contract, fn: tx.data.slice(0, 10), known: false, lines: [line("Raw data", `${(tx.data.length - 2) / 2} bytes`)] };
}
