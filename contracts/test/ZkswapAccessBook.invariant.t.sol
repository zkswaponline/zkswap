// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IZkswapGateCheck} from "../src/ZkswapGateCheck.sol";
import {ZkswapAccessBook as Book} from "../src/ZkswapAccessBook.sol";

contract YesGate is IZkswapGateCheck {
    function verify(bytes calldata, bytes32[] calldata) external pure override returns (bool) {
        return true;
    }
}

/// @dev Drives the book with random actors and actions; calls the book refuses are caught, not counted as failures.
contract Handler is Test {
    Book public book;
    address[4] public actors = [address(0x1), address(0x2), address(0x3), address(0x4)];
    uint256 public successfulRecords;
    mapping(uint256 => uint8) public maxStateSeenRetired;
    mapping(uint256 => bool) public everRetired;
    mapping(uint256 => uint256) public leavesSeen;
    uint256 nonce = 1;

    constructor(Book b) {
        book = b;
    }

    function _actor(uint256 s) internal view returns (address) {
        return actors[s % 4];
    }

    function _gid(uint256 s) internal view returns (uint256) {
        uint256 n = book.groupCount();
        return n == 0 ? 1 : (s % n) + 1;
    }

    function create(uint256 a) external {
        vm.prank(_actor(a));
        book.createGroup("g", 1 days);
    }

    function add(uint256 a, uint256 g) external {
        uint256 id = _gid(g);
        bytes32[] memory l = new bytes32[](1);
        l[0] = bytes32(++nonce);
        vm.prank(_actor(a));
        try book.addMembers(id, l, bytes32(++nonce)) {
            ++leavesSeen[id];
        } catch {}
    }

    function open(uint256 a, uint256 g) external {
        vm.prank(_actor(a));
        try book.openGroup(_gid(g)) {} catch {}
    }

    function suspend(uint256 a, uint256 g) external {
        vm.prank(_actor(a));
        try book.suspendGroup(_gid(g)) {} catch {}
    }

    function retire(uint256 a, uint256 g) external {
        uint256 id = _gid(g);
        vm.prank(_actor(a));
        try book.retireGroup(id) {
            everRetired[id] = true;
        } catch {}
    }

    function record(uint256 a, uint256 g, uint256 n) external {
        uint256 id = _gid(g);
        try book.groupOf(id) returns (Book.Group memory info) {
            vm.prank(_actor(a));
            try book.recordAccess(id, hex"01", info.root, uint32(block.timestamp / info.epochSeconds), bytes32((n % 50) + 1)) {
                ++successfulRecords;
            } catch {}
        } catch {}
    }

    function pass(uint32 secs) external {
        vm.warp(block.timestamp + (secs % 3 days));
    }
}

contract ZkswapAccessBookInvariantTest is Test {
    Book book;
    Handler handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        book = new Book(new YesGate());
        handler = new Handler(book);
        targetContract(address(handler));
    }

    function invariant_holdsNoFunds() public view {
        assertEq(address(book).balance, 0);
    }

    function invariant_recordsAddUp() public view {
        assertEq(book.totalRecords(), handler.successfulRecords());
        uint256 sum;
        for (uint256 id = 1; id <= book.groupCount(); ++id) sum += book.groupOf(id).recordCount;
        assertEq(sum, book.totalRecords());
    }

    function invariant_retiredIsFinal() public view {
        for (uint256 id = 1; id <= book.groupCount(); ++id) {
            if (handler.everRetired(id)) assertEq(uint8(book.groupOf(id).state), uint8(Book.GroupState.Retired));
        }
    }

    function invariant_openMeansARoot() public view {
        for (uint256 id = 1; id <= book.groupCount(); ++id) {
            Book.Group memory g = book.groupOf(id);
            if (g.state == Book.GroupState.Open || g.state == Book.GroupState.Suspended) assertGt(g.rootSeq, 0);
            assertLe(g.minRootSeq, g.rootSeq);
        }
    }

    function invariant_leafCountMatches() public view {
        for (uint256 id = 1; id <= book.groupCount(); ++id) assertEq(book.leafCountOf(id), handler.leavesSeen(id));
    }
}
