import { test } from "node:test";
import assert from "node:assert/strict";
import { accessWitness, commitmentOf, parseMembers, decodeIdentity, emptyRoot, encodeIdentity, leafOf, newIdentity, nullifierOf, pathOf, publicInputsOf, rootOf, scopeOf, toHex32, FIELD } from "./core.ts";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { closeProver, proveAccess, verifyAccess } from "./prover-node.ts";

const id = { secret: 11n, trapdoor: 22n };
const leaf = leafOf(commitmentOf(id), 500n);

test("the hash is the circomlib vector the circuit pins", () => {
  assert.equal(poseidon2([1n, 2n]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an);
});

test("tree: root and path agree, and walking a path reaches the root", () => {
  const leaves = [5n, leaf, 7n];
  for (let i = 0; i < leaves.length; i++) {
    const { siblings, bits, root } = pathOf(leaves, i);
    let node = leaves[i];
    siblings.forEach((s, d) => (node = bits[d] ? poseidon2([s, node]) : poseidon2([node, s])));
    assert.equal(node, root);
    assert.equal(root, rootOf(leaves));
  }
  assert.equal(rootOf([]), emptyRoot());
  assert.notEqual(rootOf([1n]), rootOf([2n]));
  assert.throws(() => pathOf(leaves, 3));
});

test("an emptied slot equals never having been filled at the end of the tree", () => {
  assert.equal(rootOf([1n, 0n]), rootOf([1n]));
  assert.notEqual(rootOf([0n, 1n]), rootOf([1n]));
});

test("scope mirrors the contract's formula and stays under 248 bits", () => {
  const s = scopeOf(4663, "0x00000000000000000000000000000000000000aa", 3n);
  assert.ok(s < 2n ** 248n);
  assert.notEqual(s, scopeOf(4663, "0x00000000000000000000000000000000000000aa", 4n));
  assert.notEqual(s, scopeOf(1, "0x00000000000000000000000000000000000000aa", 3n));
});

test("nullifiers change with the epoch and the scope, and stay constant otherwise", () => {
  assert.equal(nullifierOf(1n, 2n, 3n), nullifierOf(1n, 2n, 3n));
  assert.notEqual(nullifierOf(1n, 2n, 3n), nullifierOf(1n, 2n, 4n));
  assert.notEqual(nullifierOf(1n, 2n, 3n), nullifierOf(1n, 9n, 3n));
});

test("the witness refuses with plain words before any heavy work", () => {
  const ok = { identity: id, expiryEpoch: 500n, leaves: [leaf], scope: 9n, epoch: 400n, binder: 1234n };
  assert.equal(accessWitness(ok).index, 0);
  assert.throws(() => accessWitness({ ...ok, epoch: 501n }), /expired/);
  assert.throws(() => accessWitness({ ...ok, leaves: [1n] }), /not in the group/);
  assert.throws(() => accessWitness({ ...ok, expiryEpoch: 499n }), /not in the group/);
  assert.throws(() => accessWitness({ ...ok, binder: 0n }), /wallet/);
  assert.throws(() => accessWitness({ ...ok, binder: 2n ** 160n }), /wallet/);
  assert.throws(() => accessWitness({ ...ok, epoch: 2n ** 32n, expiryEpoch: 2n ** 32n }), /32 bits/);
  assert.throws(() => accessWitness({ ...ok, identity: { secret: FIELD, trapdoor: 1n } }), /not valid/);
});

test("identity file: round trip and refusals", () => {
  const fresh = newIdentity();
  assert.notEqual(fresh.secret, fresh.trapdoor);
  assert.deepEqual(decodeIdentity(encodeIdentity(fresh)), fresh);
  assert.throws(() => decodeIdentity("not json"));
  assert.throws(() => decodeIdentity(JSON.stringify({ kind: "other", secret: "0x1", trapdoor: "0x2" })));
  assert.throws(() => decodeIdentity(JSON.stringify({ kind: "zkswap-access-identity", secret: "0x1", trapdoor: "0x2" })));
  assert.throws(() => decodeIdentity(JSON.stringify({ kind: "zkswap-access-identity", secret: toHex32(0n), trapdoor: toHex32(1n) })));
});

test("a curator's list is parsed line by line", () => {
  const ok = parseMembers("0x2a, 500\n\n  0x2b 600  ");
  assert.equal(ok.error, null);
  assert.deepEqual(ok.leaves, [leafOf(42n, 500n), leafOf(43n, 600n)]);
  assert.match(parseMembers("0x2a, 500\nnope").error ?? "", /Line 2/);
  assert.match(parseMembers("0x0, 500").error ?? "", /out of range/);
  assert.match(parseMembers(`0x${"f".repeat(64)}, 500`).error ?? "", /out of range/);
  assert.match(parseMembers("0x2a, 4294967296").error ?? "", /expiry/);
  assert.deepEqual(parseMembers(""), { leaves: [], error: null });
});

test("a real proof verifies, and a changed public input does not", { timeout: 240_000 }, async () => {
  const leaves = [5n, leaf];
  const request = { identity: id, expiryEpoch: 500n, leaves, scope: 9n, epoch: 400n, binder: 1234n };
  const p = await proveAccess(request);
  assert.deepEqual(p.publicInputs, publicInputsOf(p.inputs));
  assert.equal(p.index, 1);
  assert.equal(p.inputs.root, rootOf(leaves));
  assert.equal(await verifyAccess(p.proof, p.inputs), true);
  assert.equal(await verifyAccess(p.proof, { ...p.inputs, binder: 1235n }).catch(() => false), false);
  assert.equal(await verifyAccess(p.proof, { ...p.inputs, epoch: 401n }).catch(() => false), false);
  await closeProver();
});

test("the circuit refuses an expired membership even with a forged witness", { timeout: 120_000 }, async () => {
  const { Noir } = await import("@noir-lang/noir_js");
  const { readFileSync } = await import("node:fs");
  const circuit = JSON.parse(readFileSync(new URL("../../../public/zk/access.json", import.meta.url), "utf8"));
  const { witness } = accessWitness({ identity: id, expiryEpoch: 500n, leaves: [leaf], scope: 9n, epoch: 400n, binder: 1n });
  const forged = { ...witness, epoch: toHex32(501n), nullifier: toHex32(nullifierOf(id.secret, 9n, 501n)) };
  await assert.rejects(() => new Noir(circuit).execute(forged));
});
