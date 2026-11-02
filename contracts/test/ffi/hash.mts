// Test helper called by forge (vm.ffi): prints abi.encode(uint256 commitment, uint256 leaf, uint256 root) for an identity
// and the other leaves of a tree, with the same TypeScript the site uses.
//   node hash.mts '{"secret":"0x..","trapdoor":"0x..","expiry":"500","others":["0x.."]}'
import { commitmentOf, leafOf, rootOf } from "../../../src/lib/zk/core.ts";
const w = (n: bigint) => n.toString(16).padStart(64, "0");
const j = JSON.parse(process.argv[2]);
const c = commitmentOf({ secret: BigInt(j.secret), trapdoor: BigInt(j.trapdoor) });
const l = leafOf(c, BigInt(j.expiry));
const r = rootOf([...(j.others as string[]).map(BigInt), l]);
process.stdout.write("0x" + w(c) + w(l) + w(r));
