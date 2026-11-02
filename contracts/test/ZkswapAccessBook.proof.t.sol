// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ZkswapGateCheck} from "../src/ZkswapGateCheck.sol";
import {ZkswapAccessBook as Book} from "../src/ZkswapAccessBook.sol";

/// @dev The real generated verifier against real UltraHonk proofs from the site's own TypeScript prover (forge ffi).
contract ZkswapAccessBookProofTest is Test {
    ZkswapGateCheck gate;
    Book book;
    address admin = address(0xA1);
    address member = address(0xB1);
    address thief = address(0xBAD);

    uint256 constant SECRET = 0x1234567890abcdef;
    uint256 constant TRAPDOOR = 0xfedcba0987654321;
    uint256 constant OTHER = 0x2a;
    uint32 constant EPOCH_LEN = 1 days;

    function setUp() public {
        vm.warp(1_800_000_000);
        gate = new ZkswapGateCheck();
        book = new Book(gate);
    }

    function _hx(uint256 v) internal pure returns (string memory) {
        return Strings.toHexString(v);
    }

    function _hash(uint256 expiry) internal returns (uint256 commitment, uint256 leaf, uint256 root) {
        string memory j = string.concat('{"secret":"', _hx(SECRET), '","trapdoor":"', _hx(TRAPDOOR), '","expiry":"', Strings.toString(expiry), '","others":["', _hx(OTHER), '"]}');
        string[] memory cmd = new string[](4);
        cmd[0] = "npx";
        cmd[1] = "tsx";
        cmd[2] = "test/ffi/hash.mts";
        cmd[3] = j;
        return abi.decode(vm.ffi(cmd), (uint256, uint256, uint256));
    }

    function _prove(uint256 expiry, uint256 leaf, uint256 scope, uint32 epoch, address binder) internal returns (bytes memory proof, uint256 root, uint256 nullifier) {
        string memory j = string.concat(
            '{"secret":"', _hx(SECRET), '","trapdoor":"', _hx(TRAPDOOR), '","expiry":"', Strings.toString(expiry), '","leaves":["', _hx(OTHER), '","', _hx(leaf),
            '"],"scope":"', _hx(scope), '","epoch":"', Strings.toString(epoch), '","binder":"', _hx(uint256(uint160(binder))), '"}'
        );
        string[] memory cmd = new string[](4);
        cmd[0] = "npx";
        cmd[1] = "tsx";
        cmd[2] = "test/ffi/access.mts";
        cmd[3] = j;
        return abi.decode(vm.ffi(cmd), (bytes, uint256, uint256));
    }

    function test_verifierFitsTheChainSizeLimit() public view {
        assertLt(address(gate).code.length, 24_576);
    }

    function test_realProof_recordsOnce_thenRefusesEverythingElse() public {
        uint32 epoch = uint32(block.timestamp / EPOCH_LEN);
        uint256 expiry = uint256(epoch) + 30;
        (, uint256 leaf, uint256 root) = _hash(expiry);

        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = bytes32(OTHER);
        leaves[1] = bytes32(leaf);
        vm.startPrank(admin);
        uint256 id = book.createGroup("Real proof group", EPOCH_LEN);
        book.addMembers(id, leaves, bytes32(root));
        book.openGroup(id);
        vm.stopPrank();

        (bytes memory proof, uint256 r, uint256 nullifier) = _prove(expiry, leaf, book.scopeOf(id), epoch, member);
        assertEq(r, root, "the TypeScript tree and the published root agree");

        // The same proof from another wallet: the wallet is a public input, so it fails.
        vm.prank(thief);
        vm.expectRevert();
        book.recordAccess(id, proof, bytes32(r), epoch, bytes32(nullifier));

        // A wrong nullifier fails.
        vm.prank(member);
        vm.expectRevert();
        book.recordAccess(id, proof, bytes32(r), epoch, bytes32(nullifier + 1));

        // One flipped byte in the proof fails.
        bytes memory bad = bytes.concat(proof);
        bad[100] = bytes1(uint8(bad[100]) ^ 0x01);
        vm.prank(member);
        vm.expectRevert();
        book.recordAccess(id, bad, bytes32(r), epoch, bytes32(nullifier));

        // The real one lands, and access is on.
        uint256 gasBefore = gasleft();
        vm.prank(member);
        book.recordAccess(id, proof, bytes32(r), epoch, bytes32(nullifier));
        emit log_named_uint("recordAccess gas", gasBefore - gasleft());
        assertTrue(book.hasAccess(id, member));
        assertFalse(book.hasAccess(id, thief));

        // Twice in one epoch is refused.
        vm.prank(member);
        vm.expectRevert(abi.encodeWithSelector(Book.NullifierUsed.selector, id, bytes32(nullifier)));
        book.recordAccess(id, proof, bytes32(r), epoch, bytes32(nullifier));

        // Next epoch: access is off, and the old proof is stale.
        vm.warp(block.timestamp + EPOCH_LEN);
        assertFalse(book.hasAccess(id, member));
        vm.prank(member);
        vm.expectRevert(abi.encodeWithSelector(Book.StaleEpoch.selector, epoch + 1, epoch));
        book.recordAccess(id, proof, bytes32(r), epoch, bytes32(nullifier));
    }

    function test_realProof_ofAnotherGroupIsRefused() public {
        uint32 epoch = uint32(block.timestamp / EPOCH_LEN);
        uint256 expiry = uint256(epoch) + 30;
        (, uint256 leaf, uint256 root) = _hash(expiry);
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = bytes32(OTHER);
        leaves[1] = bytes32(leaf);
        vm.startPrank(admin);
        uint256 a = book.createGroup("A", EPOCH_LEN);
        book.addMembers(a, leaves, bytes32(root));
        book.openGroup(a);
        uint256 b = book.createGroup("B", EPOCH_LEN);
        book.addMembers(b, leaves, bytes32(root));
        book.openGroup(b);
        vm.stopPrank();
        (bytes memory proof, uint256 r, uint256 nullifier) = _prove(expiry, leaf, book.scopeOf(a), epoch, member);
        vm.prank(member);
        vm.expectRevert();
        book.recordAccess(b, proof, bytes32(r), epoch, bytes32(nullifier));
        vm.prank(member);
        book.recordAccess(a, proof, bytes32(r), epoch, bytes32(nullifier));
        assertTrue(book.hasAccess(a, member));
        assertFalse(book.hasAccess(b, member));
    }
}
