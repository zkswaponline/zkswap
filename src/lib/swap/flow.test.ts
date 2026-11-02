import { test } from "node:test";
import assert from "node:assert/strict";
import { behindBest, costText, parseAmount, showAmount, slippageBps, topThree } from "./flow.ts";
import type { Route } from "./types.ts";

const r = (amountOut: string, midOut: string | null = null, label = "x"): Route => ({ label, venue: "Uniswap v2", amountOut, midOut, estimate: false, exec: { kind: "v2", path: [] } });

test("amount parsing refuses what the token cannot hold", () => {
  assert.equal(parseAmount("1.5", 6), 1_500_000n);
  assert.equal(parseAmount("1.", 6), 1_000_000n);
  assert.equal(parseAmount("0", 6), null);
  assert.equal(parseAmount("1.1234567", 6), null);
  assert.equal(parseAmount("abc", 6), null);
  assert.equal(parseAmount("", 6), null);
  assert.equal(parseAmount("-1", 6), null);
});

test("small amounts keep their first digits instead of showing zero", () => {
  assert.equal(showAmount("1500000", 6), "1.5");
  assert.equal(showAmount("1234567890000000000000", 18), "1,234.56");
  assert.equal(showAmount("12345", 18), "0.00000000000001234");
  assert.equal(showAmount("0", 18), "0");
  assert.equal(showAmount(1000000n, 6), "1");
});

test("slippage text", () => {
  assert.equal(slippageBps("0.5"), 50);
  assert.equal(slippageBps("50"), 5000);
  assert.equal(slippageBps("51"), null);
  assert.equal(slippageBps("-1"), null);
  assert.equal(slippageBps("x"), null);
});

test("cost and ranking", () => {
  assert.equal(costText(r("990", "1000")), "1.00%");
  assert.equal(costText(r("990", null)), "—");
  const t = topThree([r("3"), r("2"), r("1")]);
  assert.equal(t.mid?.amountOut, "3");
  assert.equal(t.left?.amountOut, "2");
  assert.equal(t.right?.amountOut, "1");
  assert.equal(topThree([]).mid, null);
  assert.equal(behindBest(r("100"), r("100")), null);
  assert.equal(behindBest(r("99"), r("100")), "1.000% less");
});
