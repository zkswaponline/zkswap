/*
 * Access-proof cryptography, shared by the browser, the prover worker, the Node prover and the contract tests.
 * No framework imports: this file runs as-is in Node and in a bundled worker. Poseidon is the circomlib-compatible
 * BN254 instance (poseidon-lite), the same one as circuits/access; both test suites pin the same vector.
 *
 *   commitment = Poseidon2(secret, trapdoor)              the member hands this to a curator, nothing else
 *   leaf       = Poseidon2(commitment, expiryEpoch)       the curator writes this to the book
 *   nullifier  = Poseidon2(Poseidon2(secret, scope), epoch)   one per member per group per epoch
 */
import { poseidon2 } from "poseidon-lite/poseidon2";
import { keccak_256 } from "@noble/hashes/sha3.js";

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const TREE_DEPTH = 16;
export const TREE_CAPACITY = 2 ** TREE_DEPTH;
const MAX_EPOCH = 2n ** 32n - 1n;

export const toHex32 = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;
export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const bytesToBig = (b: Uint8Array) => BigInt(`0x${bytesToHex(b) || "0"}`);
export const isField = (n: bigint) => n >= 0n && n < FIELD;

/** A uniformly random nonzero field element (31 random bytes are always below the field order). */
export function randomField(): bigint {
  for (;;) {
    const out = new Uint8Array(31);
    globalThis.crypto.getRandomValues(out);
    const n = bytesToBig(out);
    if (n !== 0n) return n;
  }
}

const hash2 = (a: bigint, b: bigint) => poseidon2([a, b]);

export type Identity = { secret: bigint; trapdoor: bigint };

export const newIdentity = (): Identity => ({ secret: randomField(), trapdoor: randomField() });
export const commitmentOf = (id: Identity) => hash2(id.secret, id.trapdoor);

function assertEpoch(n: bigint) {
  if (n < 0n || n > MAX_EPOCH) throw new Error("An epoch number must fit in 32 bits.");
}

export function leafOf(commitment: bigint, expiryEpoch: bigint) {
  assertEpoch(expiryEpoch);
  return hash2(commitment, expiryEpoch);
}

export const nullifierOf = (secret: bigint, scope: bigint, epoch: bigint) => hash2(hash2(secret, scope), epoch);

/** The book's scopeOf(groupId): keccak256(abi.encode(chainId, book, groupId)) >> 8, computed the same way here. */
export function scopeOf(chainId: number, book: string, groupId: bigint): bigint {
  const word = (n: bigint) => n.toString(16).padStart(64, "0");
  const hex = word(BigInt(chainId)) + word(BigInt(book)) + word(groupId);
  const bytes = Uint8Array.from(hex.match(/../g)!.map((x) => parseInt(x, 16)));
  return bytesToBig(keccak_256(bytes)) >> 8n;
}

/* ------------------------------------------------------------------ the tree */

const ZEROS: bigint[] = (() => {
  const out = [0n];
  for (let i = 0; i < TREE_DEPTH; i++) out.push(hash2(out[i], out[i]));
  return out;
})();

export const emptyRoot = () => ZEROS[TREE_DEPTH];

/** Every level of the tree over `leaves` (only the filled part of each level; the rest is the known empty value). */
function levelsOf(leaves: bigint[]): bigint[][] {
  if (leaves.length > TREE_CAPACITY) throw new Error("Too many leaves for the tree.");
  const levels: bigint[][] = [leaves.slice()];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const cur = levels[d];
    const next: bigint[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(hash2(cur[i], i + 1 < cur.length ? cur[i + 1] : ZEROS[d]));
    levels.push(next);
  }
  return levels;
}

export function rootOf(leaves: bigint[]): bigint {
  return leaves.length ? levelsOf(leaves)[TREE_DEPTH][0] : ZEROS[TREE_DEPTH];
}

export function pathOf(leaves: bigint[], index: number): { siblings: bigint[]; bits: number[]; root: bigint } {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) throw new Error("No such leaf.");
  const levels = levelsOf(leaves);
  const siblings: bigint[] = [];
  const bits: number[] = [];
  let i = index;
  for (let d = 0; d < TREE_DEPTH; d++) {
    const s = i ^ 1;
    siblings.push(s < levels[d].length ? levels[d][s] : ZEROS[d]);
    bits.push(i & 1);
    i >>= 1;
  }
  return { siblings, bits, root: levels[TREE_DEPTH][0] };
}

/* ------------------------------------------------------------------ the witness */

export type AccessRequest = {
  identity: Identity;
  expiryEpoch: bigint;
  /** All leaves of the group, in order, as the book returns them. */
  leaves: bigint[];
  scope: bigint;
  epoch: bigint;
  /** The wallet that will record the proof. */
  binder: bigint;
};

export type AccessInputs = { root: bigint; scope: bigint; epoch: bigint; nullifier: bigint; binder: bigint };

export const publicInputsOf = (i: AccessInputs) => [i.root, i.scope, i.epoch, i.nullifier, i.binder].map(toHex32);

/** Checks everything a proof would fail on, with a plain message, before any heavy work starts. */
export function accessWitness(r: AccessRequest) {
  assertEpoch(r.epoch);
  assertEpoch(r.expiryEpoch);
  if (r.epoch > r.expiryEpoch) throw new Error("This membership expired before the current epoch.");
  if (!isField(r.identity.secret) || !isField(r.identity.trapdoor)) throw new Error("The identity file is not valid.");
  if (r.binder <= 0n || r.binder >= 2n ** 160n) throw new Error("The wallet address is not valid.");
  const leaf = leafOf(commitmentOf(r.identity), r.expiryEpoch);
  const index = r.leaves.findIndex((x) => x === leaf);
  if (index < 0) throw new Error("This identity with this expiry epoch is not in the group's published leaves.");
  const { siblings, bits, root } = pathOf(r.leaves, index);
  const inputs: AccessInputs = { root, scope: r.scope, epoch: r.epoch, nullifier: nullifierOf(r.identity.secret, r.scope, r.epoch), binder: r.binder };
  const witness = {
    root: toHex32(root),
    scope: toHex32(r.scope),
    epoch: toHex32(r.epoch),
    nullifier: toHex32(inputs.nullifier),
    binder: toHex32(r.binder),
    secret: toHex32(r.identity.secret),
    trapdoor: toHex32(r.identity.trapdoor),
    expiry_epoch: toHex32(r.expiryEpoch),
    siblings: siblings.map(toHex32),
    index_bits: bits.map((b) => toHex32(BigInt(b))),
  };
  return { witness, inputs, index };
}

/* ------------------------------------------------------------------ the identity file */

export function encodeIdentity(id: Identity) {
  return JSON.stringify({ kind: "zkswap-access-identity", v: 1, secret: toHex32(id.secret), trapdoor: toHex32(id.trapdoor) }, null, 2);
}

export function decodeIdentity(text: string): Identity {
  let j: { kind?: unknown; secret?: unknown; trapdoor?: unknown };
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("That is not an identity file.");
  }
  if (j.kind !== "zkswap-access-identity" || typeof j.secret !== "string" || typeof j.trapdoor !== "string") throw new Error("That is not an identity file.");
  if (!/^0x[0-9a-f]{64}$/i.test(j.secret) || !/^0x[0-9a-f]{64}$/i.test(j.trapdoor)) throw new Error("That identity file is damaged.");
  const id = { secret: BigInt(j.secret), trapdoor: BigInt(j.trapdoor) };
  if (!isField(id.secret) || !isField(id.trapdoor) || id.secret === 0n || id.trapdoor === 0n) throw new Error("That identity file is damaged.");
  return id;
}

/* ------------------------------------------------------------------ a curator's list */

const MEMBER_LINE = /^\s*(0x[0-9a-fA-F]{1,64})\s*[, ]\s*(\d{1,10})\s*$/;

/** Parses "commitment, expiry epoch" lines into leaves. A bad line is refused by its number. */
export function parseMembers(text: string): { leaves: bigint[]; error: string | null } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const leaves: bigint[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = MEMBER_LINE.exec(lines[i]);
    if (!m) return { leaves: [], error: `Line ${i + 1} is not "commitment, expiry epoch".` };
    const commitment = BigInt(m[1]);
    if (!isField(commitment) || commitment === 0n) return { leaves: [], error: `Line ${i + 1} has a commitment out of range.` };
    try {
      leaves.push(leafOf(commitment, BigInt(m[2])));
    } catch {
      return { leaves: [], error: `Line ${i + 1} has an expiry out of range.` };
    }
  }
  return { leaves, error: null };
}
