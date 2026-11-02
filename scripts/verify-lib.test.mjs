// verify-lib against a fake chain built from this build's artifacts: a true deployment matches, and a foreign runtime, a
// wrong chain, wrong library, wrong verifier or a creation tx for another address each fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyDeployment } from "./verify-lib.mjs";

const ART = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts;
const A = (n) => "0x" + n.toString(16).padStart(40, "0");
const TAPE = A(0xa1), REL = A(0xa2), GATE = A(0xa3), BOOK = A(0xa4);
const TX = "0x" + "01".repeat(32);
const LIBS = { ZkswapFiatTape: TAPE, ZkswapRelationSet: REL };

const put = (hex, ranges, f) => {
  let out = hex.slice(2);
  for (const r of ranges) out = out.slice(0, r.start * 2) + f(r) + out.slice((r.start + r.length) * 2);
  return "0x" + out;
};
const libCode = (name, at) => "0x73" + at.slice(2) + ART[name].runtime.slice(44);
const gateCode = () => {
  const a = ART.ZkswapGateCheck;
  const linked = put(a.runtime, a.runtimeLinks, (r) => LIBS[r.lib].slice(2));
  return put(linked, a.immutables, (r) => BigInt(a.expectedImmutables[r.name]).toString(16).padStart(r.length * 2, "0"));
};
const word = (a) => a.slice(2).padStart(64, "0");
const bookCode = (gate = GATE) => put(ART.ZkswapAccessBook.runtime, ART.ZkswapAccessBook.immutables, () => word(gate));
const creation = (gate = GATE) => ART.ZkswapAccessBook.creation + word(gate);

function chain(over = {}) {
  const codes = { [TAPE]: libCode("ZkswapFiatTape", TAPE), [REL]: libCode("ZkswapRelationSet", REL), [GATE]: gateCode(), [BOOK]: bookCode(), ...over.codes };
  return async (method, params) => {
    if (method === "eth_chainId") return over.chainId ?? "0x1237";
    if (method === "eth_getCode") return codes[params[0].toLowerCase()] ?? "0x";
    if (method === "eth_getTransactionByHash") return params[0] === TX ? { hash: TX, input: over.input ?? creation(), to: null } : null;
    if (method === "eth_getTransactionReceipt") return params[0] === TX ? { status: "0x1", contractAddress: over.created ?? BOOK } : null;
    if (method === "eth_call") {
      const sel = params[0].data.slice(0, 10);
      const vals = { "0x": 0 };
      void vals;
      const { sel: s } = await import("./verify-lib.mjs");
      const want = [["TREE_CAPACITY()", 65536], ["MAX_BATCH()", 256], ["ROOT_WINDOW()", 32], ["MIN_EPOCH_SECONDS()", 3600], ["MAX_EPOCH_SECONDS()", 31536000], ["groupCount()", 0], ["totalRecords()", 0]];
      for (const [sig, v] of want) if (s(sig) === sel) return "0x" + v.toString(16).padStart(64, "0");
    }
    throw new Error(`unexpected ${method}`);
  };
}

const run = (rpc, tx = TX, target = BOOK) => verifyDeployment({ target, kind: undefined, tx, rpc, ART });

test("a true deployment matches every check, verifier and libraries included", async () => {
  const r = await run(chain());
  assert.equal(r.ok, true, r.lines.join("\n"));
  assert.equal(r.kind, "ZkswapAccessBook");
  assert.ok(r.lines.some((l) => /ZkswapGateCheck/.test(l)));
  assert.ok(r.lines.some((l) => /ZkswapFiatTape/.test(l)));
});
test("the wrong chain fails", async () => {
  assert.equal((await run(chain({ chainId: "0x1" }))).ok, false);
});
test("foreign code fails", async () => {
  assert.equal((await run(chain({ codes: { [BOOK]: "0x6000" } }))).ok, false);
});
test("a book pointing at code that is not the verifier fails", async () => {
  const other = A(0xbb);
  assert.equal((await run(chain({ codes: { [BOOK]: bookCode(other), [other]: "0x6000" } }), undefined)).ok, false);
});
test("a verifier linked to a library that is not this build fails", async () => {
  assert.equal((await run(chain({ codes: { [TAPE]: "0x6000" } }))).ok, false);
});
test("a creation tx for another address, or with other arguments, fails", async () => {
  assert.equal((await run(chain({ created: A(0xcc) }))).ok, false);
  assert.equal((await run(chain({ input: creation(A(0xdd)) }))).ok, false);
});
