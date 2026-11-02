// Test helper called by forge (vm.ffi): proves access with the same TypeScript code the site uses, then prints
// abi.encode(bytes proof, uint256 root, uint256 nullifier).
//   node access.mts '{"secret":"0x..","trapdoor":"0x..","expiry":"500","leaves":["0x.."],"scope":"0x..","epoch":"400","binder":"0x.."}'
import { closeProver, proveAccess } from "../../../src/lib/zk/prover-node.ts";

// bb.js reports progress on stdout; keep stdout for the ABI result only.
console.log = (...a: unknown[]) => console.error(...a);

const w = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");
const j = JSON.parse(process.argv[2]);
const r = await proveAccess({
  identity: { secret: BigInt(j.secret), trapdoor: BigInt(j.trapdoor) },
  expiryEpoch: BigInt(j.expiry),
  leaves: (j.leaves as string[]).map(BigInt),
  scope: BigInt(j.scope),
  epoch: BigInt(j.epoch),
  binder: BigInt(j.binder),
});
const proof = r.proof.slice(2);
const tail = w(proof.length / 2) + proof.padEnd(Math.ceil(proof.length / 64) * 64, "0");
process.stdout.write("0x" + w(3 * 32) + w(r.inputs.root) + w(r.inputs.nullifier) + tail);
await closeProver();
