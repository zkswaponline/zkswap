import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import { revertWords } from "./revert.ts";

test("a reason string is shown as written", () => {
  const data = `0x08c379a0${encodeAbiParameters([{ type: "string" }], ["TRANSFER_FROM_FAILED"]).slice(2)}`;
  assert.equal(revertWords(data), "TRANSFER_FROM_FAILED");
});
test("a panic is named", () => {
  const data = `0x4e487b71${encodeAbiParameters([{ type: "uint256" }], [0x11n]).slice(2)}`;
  assert.match(revertWords(data), /overflow/);
});
test("known and unknown custom errors", () => {
  assert.match(revertWords("0xd81b2f2e00"), /expired/);
  assert.match(revertWords("0xabcdef0100"), /custom error 0xabcdef01/);
});
test("no data falls back to the node's message, cleaned", () => {
  assert.equal(revertWords(null, "execution reverted: STF"), "STF");
  assert.match(revertWords(null, ""), /without giving a reason/);
  assert.match(revertWords("0x"), /without giving/);
});
