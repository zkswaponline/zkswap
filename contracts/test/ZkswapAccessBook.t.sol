// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IZkswapGateCheck} from "../src/ZkswapGateCheck.sol";
import {ZkswapAccessBook as Book} from "../src/ZkswapAccessBook.sol";

/// @dev Stands in for the generated verifier, so the book's own rules are tested on their own. The real verifier and real
///      proofs are in ZkswapAccessBook.proof.t.sol. The mock records what it was asked, so public inputs are checked too.
contract MockGate is IZkswapGateCheck {
    bool public answer = true;
    bool public revertInstead;
    bytes32[] public lastInputs;

    function set(bool a, bool r) external {
        answer = a;
        revertInstead = r;
    }

    function verify(bytes calldata, bytes32[] calldata inputs) external view override returns (bool) {
        if (revertInstead) revert("malformed");
        inputs;
        return answer;
    }
}

contract SpyGate is IZkswapGateCheck {
    bytes32 public immutable expectHash;

    constructor(bytes32 h) {
        expectHash = h;
    }

    function verify(bytes calldata, bytes32[] calldata inputs) external view override returns (bool) {
        return keccak256(abi.encode(inputs)) == expectHash;
    }
}

contract ZkswapAccessBookTest is Test {
    MockGate gate;
    Book book;

    address admin = address(0xA1);
    address curator = address(0xC1);
    address member = address(0xB1);
    address stranger = address(0xEE);

    bytes32 constant ROOT1 = bytes32(uint256(101));
    bytes32 constant ROOT2 = bytes32(uint256(102));
    bytes32 constant LEAF1 = bytes32(uint256(11));
    bytes32 constant LEAF2 = bytes32(uint256(12));
    bytes32 constant NULL1 = bytes32(uint256(77));
    bytes32 constant NULL2 = bytes32(uint256(78));
    uint256 constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint32 constant EPOCH_LEN = 1 days;

    event GroupCreated(uint256 indexed groupId, address indexed admin, string name, uint32 epochSeconds);
    event GroupStateChanged(uint256 indexed groupId, Book.GroupState from, Book.GroupState to);
    event AccessRecorded(uint256 indexed groupId, uint32 indexed epoch, address indexed account, bytes32 nullifier, uint32 rootSeq);
    event RootPublished(uint256 indexed groupId, uint32 indexed seq, bytes32 root, uint256 leafCount, address indexed by);
    event LeavesAdded(uint256 indexed groupId, uint256 firstIndex, uint256 count, address indexed by);
    event LeafReplaced(uint256 indexed groupId, uint256 indexed index, bytes32 oldLeaf, bytes32 newLeaf, address indexed by);
    event CuratorSet(uint256 indexed groupId, address indexed curator, bool active);
    event AdminOffered(uint256 indexed groupId, address indexed from, address indexed to);
    event AdminAccepted(uint256 indexed groupId, address indexed from, address indexed to);
    event RootsCutOff(uint256 indexed groupId, uint32 minRootSeq, address indexed by);
    event DeskPairSet(uint256 indexed groupId, uint256 indexed slot, address tokenIn, address tokenOut, string label);

    function setUp() public {
        vm.warp(1_800_000_000);
        gate = new MockGate();
        book = new Book(gate);
    }

    /* ---------------------------------------------------------------- helpers */

    function _one(bytes32 a) internal pure returns (bytes32[] memory out) {
        out = new bytes32[](1);
        out[0] = a;
    }

    function _forming() internal returns (uint256 id) {
        vm.prank(admin);
        id = book.createGroup("Early testers", EPOCH_LEN);
    }

    function _open() internal returns (uint256 id) {
        id = _forming();
        vm.startPrank(admin);
        book.addMembers(id, _one(LEAF1), ROOT1);
        book.openGroup(id);
        vm.stopPrank();
    }

    function _epoch() internal view returns (uint32) {
        return uint32(block.timestamp / EPOCH_LEN);
    }

    function _state(uint256 id) internal view returns (Book.GroupState) {
        return book.groupOf(id).state;
    }

    /* ---------------------------------------------------------------- construction */

    function test_constructor_refusesZeroVerifier() public {
        vm.expectRevert(Book.ZeroAddress.selector);
        new Book(IZkswapGateCheck(address(0)));
    }

    function test_constructor_keepsVerifier() public view {
        assertEq(address(book.gateCheck()), address(gate));
    }

    function test_holdsNoFunds_plainTransferRefused() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok, ) = address(book).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(book).balance, 0);
    }

    function test_holdsNoFunds_valueOnFunctionRefused() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok, ) = address(book).call{value: 1}(abi.encodeCall(Book.createGroup, ("x", EPOCH_LEN)));
        assertFalse(ok);
    }

    /* ---------------------------------------------------------------- createGroup */

    function test_create_startsForming() public {
        vm.expectEmit(true, true, false, true);
        emit GroupCreated(1, admin, "Early testers", EPOCH_LEN);
        uint256 id = _forming();
        assertEq(id, 1);
        assertEq(book.groupCount(), 1);
        Book.Group memory g = book.groupOf(id);
        assertEq(g.admin, admin);
        assertEq(uint8(g.state), uint8(Book.GroupState.Forming));
        assertEq(g.epochSeconds, EPOCH_LEN);
        assertEq(g.name, "Early testers");
        assertEq(g.rootSeq, 0);
    }

    function test_create_refusesBadNames() public {
        vm.expectRevert(Book.BadName.selector);
        book.createGroup("", EPOCH_LEN);
        vm.expectRevert(Book.BadName.selector);
        book.createGroup("line\nbreak", EPOCH_LEN);
        vm.expectRevert(Book.BadName.selector);
        book.createGroup(unicode"café", EPOCH_LEN);
        vm.expectRevert(Book.BadName.selector);
        book.createGroup("0123456789012345678901234567890123456789012345678", EPOCH_LEN); // 49 bytes
    }

    function test_create_acceptsLongestName() public {
        uint256 id = book.createGroup("012345678901234567890123456789012345678901234567", EPOCH_LEN); // 48 bytes
        assertEq(id, 1);
    }

    function test_create_refusesBadEpochLengths() public {
        vm.expectRevert(abi.encodeWithSelector(Book.BadEpochLength.selector, uint32(3599)));
        book.createGroup("x", 3599);
        vm.expectRevert(abi.encodeWithSelector(Book.BadEpochLength.selector, uint32(365 days + 1)));
        book.createGroup("x", 365 days + 1);
    }

    function testFuzz_create_epochBounds(uint32 len) public {
        if (len < 1 hours || len > 365 days) {
            vm.expectRevert(abi.encodeWithSelector(Book.BadEpochLength.selector, len));
            book.createGroup("x", len);
        } else {
            uint256 id = book.createGroup("x", len);
            assertEq(book.groupOf(id).epochSeconds, len);
        }
    }

    function test_unknownGroup_everywhere() public {
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownGroup.selector, 9));
        book.groupOf(9);
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownGroup.selector, 9));
        book.currentEpoch(9);
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownGroup.selector, 9));
        book.openGroup(9);
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownGroup.selector, 9));
        book.addMembers(9, _one(LEAF1), ROOT1);
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownGroup.selector, 9));
        book.recordAccess(9, "", ROOT1, 1, NULL1);
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownGroup.selector, 9));
        book.hasAccess(9, member);
    }

    /* ---------------------------------------------------------------- state machine */

    function test_open_needsRoot() public {
        uint256 id = _forming();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.NoRootYet.selector, id));
        book.openGroup(id);
    }

    function test_states_fullCycle() public {
        uint256 id = _open();
        assertEq(uint8(_state(id)), uint8(Book.GroupState.Open));
        vm.startPrank(admin);
        vm.expectEmit(true, false, false, true);
        emit GroupStateChanged(id, Book.GroupState.Open, Book.GroupState.Suspended);
        book.suspendGroup(id);
        assertEq(uint8(_state(id)), uint8(Book.GroupState.Suspended));
        book.openGroup(id);
        assertEq(uint8(_state(id)), uint8(Book.GroupState.Open));
        book.retireGroup(id);
        assertEq(uint8(_state(id)), uint8(Book.GroupState.Retired));
        vm.stopPrank();
    }

    function test_states_refusedTransitions() public {
        uint256 id = _open();
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Open));
        book.openGroup(id);
        book.suspendGroup(id);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Suspended));
        book.suspendGroup(id);
        book.retireGroup(id);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Retired));
        book.retireGroup(id);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Retired));
        book.openGroup(id);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Retired));
        book.suspendGroup(id);
        vm.stopPrank();
    }

    function test_suspend_refusedWhileForming() public {
        uint256 id = _forming();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Forming));
        book.suspendGroup(id);
    }

    function test_retire_fromForming() public {
        uint256 id = _forming();
        vm.prank(admin);
        book.retireGroup(id);
        assertEq(uint8(_state(id)), uint8(Book.GroupState.Retired));
    }

    function test_retired_isFrozen() public {
        uint256 id = _open();
        vm.prank(admin);
        book.setCurator(id, curator, true);
        vm.prank(admin);
        book.retireGroup(id);
        bytes memory wrong = abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Retired);
        vm.startPrank(admin);
        vm.expectRevert(wrong);
        book.addMembers(id, _one(LEAF2), ROOT2);
        vm.expectRevert(wrong);
        book.replaceMember(id, 0, LEAF2, ROOT2);
        vm.expectRevert(wrong);
        book.setDeskPair(id, 0, address(1), address(2), "a");
        vm.expectRevert(wrong);
        book.setCurator(id, curator, false);
        vm.expectRevert(wrong);
        book.offerAdmin(id, stranger);
        vm.expectRevert(wrong);
        book.cutOffRoots(id, 1);
        vm.stopPrank();
        vm.prank(curator);
        vm.expectRevert(wrong);
        book.addMembers(id, _one(LEAF2), ROOT2);
        vm.prank(member);
        vm.expectRevert(wrong);
        book.recordAccess(id, "", ROOT1, _epoch(), NULL1);
    }

    /* ---------------------------------------------------------------- permission matrix */

    function test_adminOnly_refuseEveryoneElse() public {
        uint256 id = _open();
        vm.prank(admin);
        book.setCurator(id, curator, true);
        address[2] memory others = [curator, stranger];
        for (uint256 i; i < 2; ++i) {
            bytes memory e = abi.encodeWithSelector(Book.NotAdmin.selector, id, others[i]);
            vm.startPrank(others[i]);
            vm.expectRevert(e);
            book.openGroup(id);
            vm.expectRevert(e);
            book.suspendGroup(id);
            vm.expectRevert(e);
            book.retireGroup(id);
            vm.expectRevert(e);
            book.offerAdmin(id, others[i]);
            vm.expectRevert(e);
            book.setCurator(id, others[i], true);
            vm.expectRevert(e);
            book.cutOffRoots(id, 1);
            vm.stopPrank();
        }
    }

    function test_curatorOnly_refuseStranger() public {
        uint256 id = _open();
        bytes memory e = abi.encodeWithSelector(Book.NotCurator.selector, id, stranger);
        vm.startPrank(stranger);
        vm.expectRevert(e);
        book.addMembers(id, _one(LEAF2), ROOT2);
        vm.expectRevert(e);
        book.replaceMember(id, 0, LEAF2, ROOT2);
        vm.expectRevert(e);
        book.setDeskPair(id, 0, address(1), address(2), "a");
        vm.stopPrank();
    }

    function test_curator_canEditMembersAndDesk() public {
        uint256 id = _open();
        vm.prank(admin);
        vm.expectEmit(true, true, false, true);
        emit CuratorSet(id, curator, true);
        book.setCurator(id, curator, true);
        assertTrue(book.isCurator(id, curator));
        assertEq(book.groupOf(id).curatorCount, 1);
        vm.startPrank(curator);
        book.addMembers(id, _one(LEAF2), ROOT2);
        book.setDeskPair(id, 0, address(0), address(2), "ETH to token");
        vm.stopPrank();
        assertEq(book.leafCountOf(id), 2);
        vm.prank(admin);
        book.setCurator(id, curator, false);
        assertFalse(book.isCurator(id, curator));
        assertEq(book.groupOf(id).curatorCount, 0);
        vm.prank(curator);
        vm.expectRevert(abi.encodeWithSelector(Book.NotCurator.selector, id, curator));
        book.addMembers(id, _one(bytes32(uint256(13))), bytes32(uint256(103)));
    }

    function test_setCurator_isIdempotentAndRefusesZero() public {
        uint256 id = _forming();
        vm.startPrank(admin);
        book.setCurator(id, curator, true);
        book.setCurator(id, curator, true);
        assertEq(book.groupOf(id).curatorCount, 1);
        book.setCurator(id, stranger, false);
        assertEq(book.groupOf(id).curatorCount, 1);
        vm.expectRevert(Book.ZeroAddress.selector);
        book.setCurator(id, address(0), true);
        vm.stopPrank();
    }

    function test_rolesAreNamespaced() public {
        uint256 a = _open();
        vm.prank(stranger);
        uint256 b = book.createGroup("Other", EPOCH_LEN);
        vm.prank(admin);
        book.setCurator(a, curator, true);
        vm.prank(curator);
        vm.expectRevert(abi.encodeWithSelector(Book.NotCurator.selector, b, curator));
        book.addMembers(b, _one(LEAF2), ROOT2);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.NotAdmin.selector, b, admin));
        book.retireGroup(b);
    }

    /* ---------------------------------------------------------------- admin handover */

    function test_handover_twoSteps() public {
        uint256 id = _forming();
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit AdminOffered(id, admin, stranger);
        book.offerAdmin(id, stranger);
        assertEq(book.groupOf(id).admin, admin);
        assertEq(book.groupOf(id).pendingAdmin, stranger);
        vm.prank(stranger);
        vm.expectEmit(true, true, true, true);
        emit AdminAccepted(id, admin, stranger);
        book.acceptAdmin(id);
        assertEq(book.groupOf(id).admin, stranger);
        assertEq(book.groupOf(id).pendingAdmin, address(0));
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.NotAdmin.selector, id, admin));
        book.retireGroup(id);
    }

    function test_handover_refusesOthersAndCancel() public {
        uint256 id = _forming();
        vm.prank(member);
        vm.expectRevert(abi.encodeWithSelector(Book.NotPendingAdmin.selector, id, member));
        book.acceptAdmin(id);
        vm.prank(admin);
        book.offerAdmin(id, stranger);
        vm.prank(member);
        vm.expectRevert(abi.encodeWithSelector(Book.NotPendingAdmin.selector, id, member));
        book.acceptAdmin(id);
        vm.prank(admin);
        book.offerAdmin(id, address(0));
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Book.NotPendingAdmin.selector, id, stranger));
        book.acceptAdmin(id);
    }

    function test_handover_refusedAfterRetire() public {
        uint256 id = _forming();
        vm.startPrank(admin);
        book.offerAdmin(id, stranger);
        book.retireGroup(id);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Book.NotPendingAdmin.selector, id, stranger));
        book.acceptAdmin(id);
    }

    /* ---------------------------------------------------------------- members and roots */

    function test_addMembers_appendsAndPublishes() public {
        uint256 id = _forming();
        bytes32[] memory two = new bytes32[](2);
        two[0] = LEAF1;
        two[1] = LEAF2;
        vm.expectEmit(true, false, true, true);
        emit LeavesAdded(id, 0, 2, admin);
        vm.expectEmit(true, true, true, true);
        emit RootPublished(id, 1, ROOT1, 2, admin);
        vm.prank(admin);
        book.addMembers(id, two, ROOT1);
        assertEq(book.leafCountOf(id), 2);
        bytes32[] memory page = book.leavesOf(id, 0, 10);
        assertEq(page.length, 2);
        assertEq(page[1], LEAF2);
        assertEq(book.leavesOf(id, 1, 10).length, 1);
        assertEq(book.leavesOf(id, 5, 10).length, 0);
        assertEq(book.groupOf(id).root, ROOT1);
        assertEq(book.groupOf(id).rootSeq, 1);
        assertTrue(book.isKnownRoot(id, ROOT1));
    }

    function test_addMembers_refusesBadBatches() public {
        uint256 id = _forming();
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.BadBatch.selector, 0));
        book.addMembers(id, new bytes32[](0), ROOT1);
        vm.expectRevert(abi.encodeWithSelector(Book.BadBatch.selector, 257));
        book.addMembers(id, new bytes32[](257), ROOT1);
        vm.expectRevert(abi.encodeWithSelector(Book.BadLeaf.selector, 0));
        book.addMembers(id, _one(bytes32(0)), ROOT1);
        vm.expectRevert(abi.encodeWithSelector(Book.BadLeaf.selector, 0));
        book.addMembers(id, _one(bytes32(FIELD)), ROOT1);
        vm.expectRevert(Book.BadRoot.selector);
        book.addMembers(id, _one(LEAF1), bytes32(0));
        vm.expectRevert(Book.BadRoot.selector);
        book.addMembers(id, _one(LEAF1), bytes32(FIELD));
        vm.stopPrank();
        assertEq(book.leafCountOf(id), 0);
        assertEq(book.groupOf(id).rootSeq, 0);
    }

    function test_addMembers_treeFull() public {
        uint256 id = _forming();
        // Fill the array length directly: _leaves is the 4th-from-storage mapping found by a real write first.
        vm.prank(admin);
        book.addMembers(id, _one(LEAF1), ROOT1);
        vm.record();
        book.leafCountOf(id);
        (bytes32[] memory reads, ) = vm.accesses(address(book));
        bytes32 lengthSlot = reads[0];
        vm.store(address(book), lengthSlot, bytes32(uint256(1 << 16)));
        assertEq(book.leafCountOf(id), 1 << 16);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.TreeFull.selector, id));
        book.addMembers(id, _one(LEAF2), ROOT2);
    }

    function test_replaceMember_swapsAndEmpties() public {
        uint256 id = _open();
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit LeafReplaced(id, 0, LEAF1, LEAF2, admin);
        book.replaceMember(id, 0, LEAF2, ROOT2);
        assertEq(book.leavesOf(id, 0, 1)[0], LEAF2);
        assertEq(book.groupOf(id).root, ROOT2);
        vm.prank(admin);
        book.replaceMember(id, 0, bytes32(0), bytes32(uint256(103)));
        assertEq(book.leavesOf(id, 0, 1)[0], bytes32(0));
        assertEq(book.leafCountOf(id), 1);
    }

    function test_replaceMember_refusals() public {
        uint256 id = _open();
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.NoSuchLeaf.selector, id, 1));
        book.replaceMember(id, 1, LEAF2, ROOT2);
        vm.expectRevert(abi.encodeWithSelector(Book.BadLeaf.selector, 0));
        book.replaceMember(id, 0, bytes32(FIELD), ROOT2);
        vm.expectRevert(Book.BadRoot.selector);
        book.replaceMember(id, 0, LEAF2, bytes32(0));
        vm.stopPrank();
    }

    function test_rootWindow_oldRootFallsOut() public {
        uint256 id = _open();
        vm.startPrank(admin);
        for (uint256 i = 0; i < 31; ++i) book.replaceMember(id, 0, LEAF2, bytes32(uint256(1000 + i)));
        assertTrue(book.isKnownRoot(id, ROOT1)); // seq 1 of 32: still inside the window
        book.replaceMember(id, 0, LEAF2, bytes32(uint256(2000)));
        assertFalse(book.isKnownRoot(id, ROOT1)); // seq 1 of 33: out
        vm.stopPrank();
        assertFalse(book.isKnownRoot(id, bytes32(uint256(424242))));
    }

    function test_rootPublishedAgain_keepsNewerSeq() public {
        uint256 id = _open();
        vm.startPrank(admin);
        book.replaceMember(id, 0, LEAF2, ROOT2);
        book.replaceMember(id, 0, LEAF1, ROOT1);
        vm.stopPrank();
        assertEq(book.groupOf(id).rootSeq, 3);
        vm.prank(admin);
        book.cutOffRoots(id, 3);
        assertTrue(book.isKnownRoot(id, ROOT1));
        assertFalse(book.isKnownRoot(id, ROOT2));
    }

    function test_cutOff_rules() public {
        uint256 id = _open();
        vm.startPrank(admin);
        book.replaceMember(id, 0, LEAF2, ROOT2);
        vm.expectRevert(abi.encodeWithSelector(Book.BadCutOff.selector, uint32(0)));
        book.cutOffRoots(id, 0);
        vm.expectRevert(abi.encodeWithSelector(Book.BadCutOff.selector, uint32(3)));
        book.cutOffRoots(id, 3);
        vm.expectEmit(true, false, true, true);
        emit RootsCutOff(id, 2, admin);
        book.cutOffRoots(id, 2);
        assertFalse(book.isKnownRoot(id, ROOT1));
        assertTrue(book.isKnownRoot(id, ROOT2));
        vm.expectRevert(abi.encodeWithSelector(Book.BadCutOff.selector, uint32(2)));
        book.cutOffRoots(id, 2);
        vm.expectRevert(abi.encodeWithSelector(Book.BadCutOff.selector, uint32(1)));
        book.cutOffRoots(id, 1);
        vm.stopPrank();
    }

    /* ---------------------------------------------------------------- desk */

    function test_desk_appendReplaceClear() public {
        uint256 id = _forming();
        vm.startPrank(admin);
        vm.expectEmit(true, true, false, true);
        emit DeskPairSet(id, 0, address(0), address(2), "ETH to USDG");
        book.setDeskPair(id, 0, address(0), address(2), "ETH to USDG");
        book.setDeskPair(id, 1, address(2), address(3), "USDG to X");
        book.setDeskPair(id, 0, address(4), address(5), "Other");
        book.setDeskPair(id, 1, address(0), address(0), "");
        vm.stopPrank();
        Book.DeskPair[] memory desk = book.deskOf(id);
        assertEq(desk.length, 2);
        assertEq(desk[0].tokenIn, address(4));
        assertEq(desk[0].label, "Other");
        assertEq(desk[1].tokenOut, address(0));
    }

    function test_desk_refusals() public {
        uint256 id = _forming();
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(Book.SlotOutOfRange.selector, 1));
        book.setDeskPair(id, 1, address(1), address(2), "x");
        vm.expectRevert(Book.BadPair.selector);
        book.setDeskPair(id, 0, address(1), address(1), "x");
        vm.expectRevert(Book.BadPair.selector);
        book.setDeskPair(id, 0, address(1), address(2), "");
        vm.expectRevert(Book.BadPair.selector);
        book.setDeskPair(id, 0, address(0), address(0), "label on an empty slot");
        vm.expectRevert(Book.BadName.selector);
        book.setDeskPair(id, 0, address(1), address(2), "012345678901234567890123456789012"); // 33 bytes
        vm.expectRevert(Book.BadName.selector);
        book.setDeskPair(id, 0, address(1), address(2), "tab\there");
        for (uint256 i; i < 12; ++i) book.setDeskPair(id, i, address(1), address(2), "x");
        vm.expectRevert(abi.encodeWithSelector(Book.SlotOutOfRange.selector, 12));
        book.setDeskPair(id, 12, address(1), address(2), "x");
        vm.stopPrank();
    }

    /* ---------------------------------------------------------------- recordAccess */

    function test_record_happyPath() public {
        uint256 id = _open();
        uint32 e = _epoch();
        assertFalse(book.hasAccess(id, member));
        vm.prank(member);
        vm.expectEmit(true, true, true, true);
        emit AccessRecorded(id, e, member, NULL1, 1);
        book.recordAccess(id, hex"01", ROOT1, e, NULL1);
        assertTrue(book.hasAccess(id, member));
        assertFalse(book.hasAccess(id, stranger));
        assertTrue(book.isNullifierUsed(id, NULL1));
        assertEq(book.recordsInEpoch(id, e), 1);
        assertEq(book.totalRecords(), 1);
        assertEq(book.groupOf(id).recordCount, 1);
        Book.AccessRecord[] memory rec = book.recordsOf(id, 0, 5);
        assertEq(rec.length, 1);
        assertEq(rec[0].account, member);
        assertEq(rec[0].epoch, e);
        assertEq(rec[0].rootSeq, 1);
        assertEq(rec[0].nullifier, NULL1);
        (uint32 last, bool ever) = book.lastEpochOf(id, member);
        assertEq(last, e);
        assertTrue(ever);
    }

    function test_record_passesExactPublicInputs() public {
        // Build a book whose gate only says yes to the exact public inputs we compute by hand.
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        uint256 scope = uint256(keccak256(abi.encode(block.chainid, predicted, uint256(1)))) >> 8;
        uint32 e = _epoch();
        bytes32[] memory inputs = new bytes32[](5);
        inputs[0] = ROOT1;
        inputs[1] = bytes32(scope);
        inputs[2] = bytes32(uint256(e));
        inputs[3] = NULL1;
        inputs[4] = bytes32(uint256(uint160(member)));
        SpyGate spy = new SpyGate(keccak256(abi.encode(inputs)));
        Book b = new Book(spy);
        assertEq(address(b), predicted);
        assertEq(b.scopeOf(1), scope);
        vm.startPrank(admin);
        uint256 id = b.createGroup("x", EPOCH_LEN);
        b.addMembers(id, _one(LEAF1), ROOT1);
        b.openGroup(id);
        vm.stopPrank();
        // Any other wallet, root or nullifier changes the inputs and the gate says no.
        vm.prank(stranger);
        vm.expectRevert(Book.InvalidProof.selector);
        b.recordAccess(id, hex"01", ROOT1, e, NULL1);
        vm.prank(member);
        vm.expectRevert(Book.InvalidProof.selector);
        b.recordAccess(id, hex"01", ROOT1, e, NULL2);
        vm.prank(member);
        b.recordAccess(id, hex"01", ROOT1, e, NULL1);
        assertTrue(b.hasAccess(id, member));
    }

    function test_scope_differsPerGroupAndChain() public {
        uint256 a = book.scopeOf(1);
        assertTrue(a != book.scopeOf(2));
        assertLt(a, 1 << 248);
        vm.chainId(4663);
        assertTrue(a != book.scopeOf(1));
    }

    function test_record_refusedUnlessOpen() public {
        uint256 id = _forming();
        vm.prank(admin);
        book.addMembers(id, _one(LEAF1), ROOT1);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Forming));
        book.recordAccess(id, hex"01", ROOT1, _epoch(), NULL1);
        vm.prank(admin);
        book.openGroup(id);
        vm.prank(admin);
        book.suspendGroup(id);
        vm.expectRevert(abi.encodeWithSelector(Book.WrongState.selector, id, Book.GroupState.Suspended));
        book.recordAccess(id, hex"01", ROOT1, _epoch(), NULL1);
    }

    function test_record_refusesStaleAndFutureEpochs() public {
        uint256 id = _open();
        uint32 e = _epoch();
        vm.expectRevert(abi.encodeWithSelector(Book.StaleEpoch.selector, e, e - 1));
        book.recordAccess(id, hex"01", ROOT1, e - 1, NULL1);
        vm.expectRevert(abi.encodeWithSelector(Book.StaleEpoch.selector, e, e + 1));
        book.recordAccess(id, hex"01", ROOT1, e + 1, NULL1);
    }

    function test_record_refusesUnknownOrCutRoot() public {
        uint256 id = _open();
        uint32 e = _epoch();
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownRoot.selector, id, ROOT2));
        book.recordAccess(id, hex"01", ROOT2, e, NULL1);
        vm.startPrank(admin);
        book.replaceMember(id, 0, LEAF2, ROOT2);
        book.cutOffRoots(id, 2);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(Book.UnknownRoot.selector, id, ROOT1));
        book.recordAccess(id, hex"01", ROOT1, e, NULL1);
        book.recordAccess(id, hex"01", ROOT2, e, NULL1);
    }

    function test_record_refusesBadNullifier() public {
        uint256 id = _open();
        uint32 e = _epoch();
        vm.expectRevert(Book.BadNullifier.selector);
        book.recordAccess(id, hex"01", ROOT1, e, bytes32(0));
        vm.expectRevert(Book.BadNullifier.selector);
        book.recordAccess(id, hex"01", ROOT1, e, bytes32(FIELD));
    }

    function test_record_oneUsePerNullifier_acrossWallets() public {
        uint256 id = _open();
        uint32 e = _epoch();
        vm.prank(member);
        book.recordAccess(id, hex"01", ROOT1, e, NULL1);
        vm.prank(member);
        vm.expectRevert(abi.encodeWithSelector(Book.NullifierUsed.selector, id, NULL1));
        book.recordAccess(id, hex"01", ROOT1, e, NULL1);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Book.NullifierUsed.selector, id, NULL1));
        book.recordAccess(id, hex"01", ROOT1, e, NULL1);
    }

    function test_record_nullifiersAreNamespaced() public {
        uint256 a = _open();
        uint256 b = _open();
        uint32 e = _epoch();
        vm.prank(member);
        book.recordAccess(a, hex"01", ROOT1, e, NULL1);
        vm.prank(member);
        book.recordAccess(b, hex"01", ROOT1, e, NULL1);
        assertEq(book.groupOf(a).recordCount, 1);
        assertEq(book.groupOf(b).recordCount, 1);
        assertEq(book.totalRecords(), 2);
    }

    function test_record_invalidProofChangesNothing() public {
        uint256 id = _open();
        gate.set(false, false);
        vm.expectRevert(Book.InvalidProof.selector);
        book.recordAccess(id, hex"01", ROOT1, _epoch(), NULL1);
        gate.set(false, true);
        vm.expectRevert(bytes("malformed"));
        book.recordAccess(id, hex"01", ROOT1, _epoch(), NULL1);
        assertFalse(book.isNullifierUsed(id, NULL1));
        assertEq(book.totalRecords(), 0);
    }

    function test_access_endsWithTheEpochAndWithTheState() public {
        uint256 id = _open();
        vm.prank(member);
        book.recordAccess(id, hex"01", ROOT1, _epoch(), NULL1);
        assertTrue(book.hasAccess(id, member));
        vm.prank(admin);
        book.suspendGroup(id);
        assertFalse(book.hasAccess(id, member));
        vm.prank(admin);
        book.openGroup(id);
        assertTrue(book.hasAccess(id, member));
        vm.warp(block.timestamp + EPOCH_LEN);
        assertFalse(book.hasAccess(id, member));
        (uint32 last, bool ever) = book.lastEpochOf(id, member);
        assertEq(last, _epoch() - 1);
        assertTrue(ever);
        vm.prank(member);
        book.recordAccess(id, hex"01", ROOT1, _epoch(), NULL2);
        assertTrue(book.hasAccess(id, member));
        assertEq(book.recordsInEpoch(id, _epoch()), 1);
    }

    function test_epochEndsIn_countsDown() public {
        uint256 id = _forming();
        uint256 left = book.epochEndsIn(id);
        assertGt(left, 0);
        assertLe(left, EPOCH_LEN);
        vm.warp(block.timestamp + 10);
        uint256 next = book.epochEndsIn(id);
        assertTrue(next == left - 10 || left <= 10);
    }

    /* ---------------------------------------------------------------- paging */

    function test_paging_groupsAndRecords() public {
        for (uint256 i; i < 3; ++i) book.createGroup("g", EPOCH_LEN);
        assertEq(book.groupsFrom(0, 10).length, 3);
        assertEq(book.groupsFrom(2, 10).length, 2);
        assertEq(book.groupsFrom(2, 1).length, 1);
        assertEq(book.groupsFrom(9, 10).length, 0);
        assertEq(book.groupsFrom(1, 0).length, 0);
        assertEq(book.recordsOf(1, 0, 10).length, 0);
    }

    function test_chainBlock_fallsBackWithoutPrecompile() public {
        vm.roll(777);
        assertEq(book.chainBlock(), 777);
    }

    function test_chainBlock_readsPrecompile() public {
        vm.mockCall(address(100), abi.encodeWithSignature("arbBlockNumber()"), abi.encode(uint256(123456)));
        assertEq(book.chainBlock(), 123456);
        assertEq(book.groupOf(book.createGroup("x", EPOCH_LEN)).createdAtBlock, 123456);
    }

    /* ---------------------------------------------------------------- fuzz */

    function testFuzz_leaves_inFieldOnly(uint256 raw) public {
        uint256 id = _forming();
        bytes32 leaf = bytes32(raw);
        vm.prank(admin);
        if (raw == 0 || raw >= FIELD) {
            vm.expectRevert(abi.encodeWithSelector(Book.BadLeaf.selector, 0));
            book.addMembers(id, _one(leaf), ROOT1);
        } else {
            book.addMembers(id, _one(leaf), ROOT1);
            assertEq(book.leavesOf(id, 0, 1)[0], leaf);
        }
    }

    function testFuzz_record_onlyCurrentEpoch(uint32 given, uint32 jump) public {
        uint256 id = _open();
        vm.warp(block.timestamp + uint256(jump));
        uint32 current = _epoch();
        if (given == current) {
            book.recordAccess(id, hex"01", ROOT1, given, NULL1);
            assertEq(book.totalRecords(), 1);
        } else {
            vm.expectRevert(abi.encodeWithSelector(Book.StaleEpoch.selector, current, given));
            book.recordAccess(id, hex"01", ROOT1, given, NULL1);
        }
    }

    function testFuzz_rootWindow(uint8 updates) public {
        uint256 id = _open();
        vm.startPrank(admin);
        for (uint256 i; i < updates; ++i) book.replaceMember(id, 0, LEAF2, bytes32(uint256(5000 + i)));
        vm.stopPrank();
        assertEq(book.isKnownRoot(id, ROOT1), uint256(updates) < 32);
        assertEq(book.groupOf(id).rootSeq, uint32(updates) + 1);
    }
}
