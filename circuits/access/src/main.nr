// zkSwap access circuit: proves that the prover holds a membership in a group's tree that has not
// expired at the given epoch, without saying which leaf it is or when it expires.
//
//   commitment = Poseidon2(secret, trapdoor)              (handed to the group's curator)
//   leaf       = Poseidon2(commitment, expiry_epoch)      (written to the book by the curator)
//   nullifier  = Poseidon2(Poseidon2(secret, scope), epoch)   (recorded once per epoch by the book)
//
// Public inputs: root, scope, epoch, nullifier, binder.
//   scope  = keccak256(chain id, book address, group id) >> 8: a proof is good for one group of one book.
//   binder = the wallet that records the proof, so a proof seen in the mempool cannot be taken by another wallet.
//
// What it does NOT hide: the wallet that records the proof, and everything that wallet does on chain.
// Poseidon is the circomlib-compatible BN254 instance, shared with poseidon-lite (vector pinned below).

use poseidon::poseidon::bn254::hash_2;

pub global DEPTH: u32 = 16;

fn member_leaf(secret: Field, trapdoor: Field, expiry_epoch: Field) -> Field {
    hash_2([hash_2([secret, trapdoor]), expiry_epoch])
}

fn epoch_nullifier(secret: Field, scope: Field, epoch: Field) -> Field {
    hash_2([hash_2([secret, scope]), epoch])
}

fn root_of(leaf: Field, siblings: [Field; DEPTH], index_bits: [Field; DEPTH]) -> Field {
    let mut node = leaf;
    for i in 0..DEPTH {
        let bit = index_bits[i];
        assert(bit * (1 - bit) == 0, "path index is not a bit");
        let sibling = siblings[i];
        // bit = 0: node is the left child; bit = 1: node is the right child.
        let left = node + bit * (sibling - node);
        let right = sibling + bit * (node - sibling);
        node = hash_2([left, right]);
    }
    node
}

fn main(
    root: pub Field,
    scope: pub Field,
    epoch: pub Field,
    nullifier: pub Field,
    binder: pub Field,
    secret: Field,
    trapdoor: Field,
    expiry_epoch: Field,
    siblings: [Field; DEPTH],
    index_bits: [Field; DEPTH],
) {
    // Both sides of the comparison are range-limited first, so the integer cast below is exact.
    epoch.assert_max_bit_size::<32>();
    expiry_epoch.assert_max_bit_size::<32>();
    assert(epoch as u32 <= expiry_epoch as u32, "membership has expired");
    // A wallet address and a scope are real inputs of the statement, not free fields.
    binder.assert_max_bit_size::<160>();
    scope.assert_max_bit_size::<248>();
    assert(nullifier == epoch_nullifier(secret, scope, epoch), "nullifier mismatch");
    let leaf = member_leaf(secret, trapdoor, expiry_epoch);
    assert(root_of(leaf, siblings, index_bits) == root, "membership is not in the tree");
}

#[test]
fn poseidon_vector() {
    // circomlib reference value, shared with the TypeScript tests.
    assert(hash_2([1, 2]) == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
}

fn empty_path() -> [Field; DEPTH] {
    let mut path = [0; DEPTH];
    let mut z = 0;
    for l in 0..DEPTH {
        path[l] = z;
        z = hash_2([z, z]);
    }
    path
}

#[test]
fn first_and_second_member_can_prove() {
    let path = empty_path();
    let a = member_leaf(11, 22, 500);
    let b = member_leaf(33, 44, 900);
    let root = root_of(a, path, [0; DEPTH]);
    main(root, 77, 400, epoch_nullifier(11, 77, 400), 1234, 11, 22, 500, path, [0; DEPTH]);

    // Two leaves: prove the right child at level 0.
    let mut siblings = path;
    siblings[0] = a;
    let mut bits = [0; DEPTH];
    bits[0] = 1;
    let both = root_of(b, siblings, bits);
    main(both, 77, 900, epoch_nullifier(33, 77, 900), 1234, 33, 44, 900, siblings, bits);
}

#[test(should_fail_with = "membership has expired")]
fn expired_member_is_refused() {
    let path = empty_path();
    let root = root_of(member_leaf(11, 22, 500), path, [0; DEPTH]);
    main(root, 77, 501, epoch_nullifier(11, 77, 501), 1234, 11, 22, 500, path, [0; DEPTH]);
}

#[test(should_fail_with = "membership is not in the tree")]
fn wrong_trapdoor_is_refused() {
    let path = empty_path();
    let root = root_of(member_leaf(11, 22, 500), path, [0; DEPTH]);
    main(root, 77, 400, epoch_nullifier(11, 77, 400), 1234, 11, 23, 500, path, [0; DEPTH]);
}

#[test(should_fail_with = "nullifier mismatch")]
fn nullifier_of_another_epoch_is_refused() {
    let path = empty_path();
    let root = root_of(member_leaf(11, 22, 500), path, [0; DEPTH]);
    main(root, 77, 400, epoch_nullifier(11, 77, 399), 1234, 11, 22, 500, path, [0; DEPTH]);
}

#[test(should_fail_with = "nullifier mismatch")]
fn nullifier_of_another_scope_is_refused() {
    let path = empty_path();
    let root = root_of(member_leaf(11, 22, 500), path, [0; DEPTH]);
    main(root, 77, 400, epoch_nullifier(11, 78, 400), 1234, 11, 22, 500, path, [0; DEPTH]);
}

#[test(should_fail)]
fn oversized_binder_is_refused() {
    let path = empty_path();
    let root = root_of(member_leaf(11, 22, 500), path, [0; DEPTH]);
    let too_big: Field = 0x1000000000000000000000000000000000000000000;
    main(root, 77, 400, epoch_nullifier(11, 77, 400), too_big, 11, 22, 500, path, [0; DEPTH]);
}
