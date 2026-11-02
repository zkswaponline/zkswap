// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZkswapGateCheck} from "./ZkswapGateCheck.sol";

/// @title ZkswapAccessBook
/// @notice A public book of access groups. A group's admin and curators publish a membership tree; a member proves
///         "I hold a live membership of this group this epoch" with a zero-knowledge proof and records that proof
///         with the wallet of their choice. The site unlocks group-gated screens for a wallet with a record.
/// @dev What this contract is not:
///      - It does not gate any swap. Swaps go straight from the wallet to a venue; this book is never in the path.
///      - It does not hide anything about the recording wallet. The wallet, the transaction and every swap that wallet
///        makes remain public. The proof only keeps private which leaf of the tree belongs to the wallet.
///      - It holds no funds or tokens, charges no fee, and has no global owner, no pause and no upgrade path.
///      - It cannot check that a published root matches the published leaves (no Poseidon on chain). Every reader can
///        recompute it; the site does so and shows the result. The curator of a group can always add a member.
contract ZkswapAccessBook {
    /* ------------------------------------------------------------------ types */

    /// @dev Forming -> Open <-> Suspended; Forming, Open or Suspended -> Retired, which is final.
    enum GroupState {
        None,
        Forming,
        Open,
        Suspended,
        Retired
    }

    struct Group {
        address admin;
        address pendingAdmin;
        GroupState state;
        /// @dev Length of one epoch in seconds. An epoch number is block.timestamp / epochSeconds. Fixed at creation.
        uint32 epochSeconds;
        uint32 curatorCount;
        /// @dev Sequence number of the newest root (0 = none yet).
        uint32 rootSeq;
        /// @dev Roots with a lower sequence number are no longer accepted, whatever the window says.
        uint32 minRootSeq;
        uint64 createdAt;
        uint64 createdAtBlock;
        uint64 recordCount;
        bytes32 root;
        string name;
    }

    struct DeskPair {
        address tokenIn;
        address tokenOut;
        string label;
    }

    struct AccessRecord {
        address account;
        uint32 epoch;
        uint32 rootSeq;
        uint64 at;
        bytes32 nullifier;
    }

    /* ------------------------------------------------------------------ errors */

    error UnknownGroup(uint256 groupId);
    error NotAdmin(uint256 groupId, address caller);
    error NotCurator(uint256 groupId, address caller);
    error NotPendingAdmin(uint256 groupId, address caller);
    error WrongState(uint256 groupId, GroupState state);
    error BadName();
    error BadEpochLength(uint32 epochSeconds);
    error BadLeaf(uint256 index);
    error BadRoot();
    error BadBatch(uint256 size);
    error TreeFull(uint256 groupId);
    error NoSuchLeaf(uint256 groupId, uint256 index);
    error NoRootYet(uint256 groupId);
    error BadCutOff(uint32 seq);
    error UnknownRoot(uint256 groupId, bytes32 root);
    error StaleEpoch(uint32 current, uint32 given);
    error NullifierUsed(uint256 groupId, bytes32 nullifier);
    error BadNullifier();
    error InvalidProof();
    error BadPair();
    error SlotOutOfRange(uint256 slot);
    error ZeroAddress();

    /* ------------------------------------------------------------------ events */

    event GroupCreated(uint256 indexed groupId, address indexed admin, string name, uint32 epochSeconds);
    event GroupStateChanged(uint256 indexed groupId, GroupState from, GroupState to);
    event AdminOffered(uint256 indexed groupId, address indexed from, address indexed to);
    event AdminAccepted(uint256 indexed groupId, address indexed from, address indexed to);
    event CuratorSet(uint256 indexed groupId, address indexed curator, bool active);
    event LeavesAdded(uint256 indexed groupId, uint256 firstIndex, uint256 count, address indexed by);
    event LeafReplaced(uint256 indexed groupId, uint256 indexed index, bytes32 oldLeaf, bytes32 newLeaf, address indexed by);
    event RootPublished(uint256 indexed groupId, uint32 indexed seq, bytes32 root, uint256 leafCount, address indexed by);
    event RootsCutOff(uint256 indexed groupId, uint32 minRootSeq, address indexed by);
    event DeskPairSet(uint256 indexed groupId, uint256 indexed slot, address tokenIn, address tokenOut, string label);
    event AccessRecorded(uint256 indexed groupId, uint32 indexed epoch, address indexed account, bytes32 nullifier, uint32 rootSeq);

    /* ------------------------------------------------------------------ constants */

    /// @dev The BN254 scalar field: every public input of the circuit must be below it.
    uint256 internal constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    /// @dev Depth of the circuit's tree.
    uint256 public constant TREE_CAPACITY = 1 << 16;
    uint256 public constant MAX_BATCH = 256;
    /// @dev How many newest roots a proof may refer to, so a proof made just before an update still lands.
    uint32 public constant ROOT_WINDOW = 32;
    uint32 public constant MIN_EPOCH_SECONDS = 1 hours;
    uint32 public constant MAX_EPOCH_SECONDS = 365 days;
    uint256 public constant MAX_NAME_BYTES = 48;
    uint256 public constant MAX_LABEL_BYTES = 32;
    uint256 public constant MAX_DESK_PAIRS = 12;
    uint256 public constant MAX_PAGE = 200;

    /// @notice The generated proof verifier. Fixed for the life of this book.
    IZkswapGateCheck public immutable gateCheck;

    uint256 public groupCount;
    uint256 public totalRecords;

    mapping(uint256 groupId => Group) private _groups;
    mapping(uint256 groupId => mapping(address account => bool)) private _curators;
    mapping(uint256 groupId => bytes32[]) private _leaves;
    /// @dev Sequence number a root was published under (a root published twice keeps the newer number).
    mapping(uint256 groupId => mapping(bytes32 root => uint32)) private _rootSeqOf;
    mapping(uint256 groupId => mapping(bytes32 nullifier => bool)) private _nullifierUsed;
    mapping(uint256 groupId => mapping(address account => uint32)) private _lastEpoch;
    mapping(uint256 groupId => mapping(address account => bool)) private _everRecorded;
    mapping(uint256 groupId => mapping(uint32 epoch => uint64)) private _recordsInEpoch;
    mapping(uint256 groupId => AccessRecord[]) private _records;
    mapping(uint256 groupId => DeskPair[]) private _desk;

    constructor(IZkswapGateCheck gateCheck_) {
        if (address(gateCheck_) == address(0)) revert ZeroAddress();
        gateCheck = gateCheck_;
    }

    /* ------------------------------------------------------------------ guards */

    function _group(uint256 groupId) private view returns (Group storage g) {
        g = _groups[groupId];
        if (g.state == GroupState.None) revert UnknownGroup(groupId);
    }

    function _adminGroup(uint256 groupId) private view returns (Group storage g) {
        g = _group(groupId);
        if (msg.sender != g.admin) revert NotAdmin(groupId, msg.sender);
    }

    /// @dev Admins and curators both edit a group's members; a retired group is frozen.
    function _curatedGroup(uint256 groupId) private view returns (Group storage g) {
        g = _group(groupId);
        if (msg.sender != g.admin && !_curators[groupId][msg.sender]) revert NotCurator(groupId, msg.sender);
        if (g.state == GroupState.Retired) revert WrongState(groupId, g.state);
    }

    function _isPrintable(bytes memory s) private pure returns (bool) {
        for (uint256 i; i < s.length; ++i) {
            if (s[i] < 0x20 || s[i] > 0x7e) return false;
        }
        return true;
    }

    /* ------------------------------------------------------------------ group lifecycle */

    /// @notice Starts a group in the Forming state with the caller as its admin.
    function createGroup(string calldata name, uint32 epochSeconds) external returns (uint256 groupId) {
        bytes memory raw = bytes(name);
        if (raw.length == 0 || raw.length > MAX_NAME_BYTES || !_isPrintable(raw)) revert BadName();
        if (epochSeconds < MIN_EPOCH_SECONDS || epochSeconds > MAX_EPOCH_SECONDS) revert BadEpochLength(epochSeconds);
        groupId = ++groupCount;
        Group storage g = _groups[groupId];
        g.admin = msg.sender;
        g.state = GroupState.Forming;
        g.epochSeconds = epochSeconds;
        g.createdAt = uint64(block.timestamp);
        g.createdAtBlock = uint64(_chainBlock());
        g.name = name;
        emit GroupCreated(groupId, msg.sender, name, epochSeconds);
    }

    /// @notice Forming or Suspended -> Open. Needs a published root.
    function openGroup(uint256 groupId) external {
        Group storage g = _adminGroup(groupId);
        if (g.state != GroupState.Forming && g.state != GroupState.Suspended) revert WrongState(groupId, g.state);
        if (g.rootSeq == 0) revert NoRootYet(groupId);
        _setState(groupId, g, GroupState.Open);
    }

    /// @notice Open -> Suspended: new records are refused until the group opens again.
    function suspendGroup(uint256 groupId) external {
        Group storage g = _adminGroup(groupId);
        if (g.state != GroupState.Open) revert WrongState(groupId, g.state);
        _setState(groupId, g, GroupState.Suspended);
    }

    /// @notice Any live state -> Retired. There is no way back; the history stays readable.
    function retireGroup(uint256 groupId) external {
        Group storage g = _adminGroup(groupId);
        if (g.state == GroupState.Retired) revert WrongState(groupId, g.state);
        g.pendingAdmin = address(0);
        _setState(groupId, g, GroupState.Retired);
    }

    function _setState(uint256 groupId, Group storage g, GroupState next) private {
        emit GroupStateChanged(groupId, g.state, next);
        g.state = next;
    }

    /* ------------------------------------------------------------------ roles (per group, nothing global) */

    /// @notice First step of an admin handover. address(0) cancels an open offer.
    function offerAdmin(uint256 groupId, address to) external {
        Group storage g = _adminGroup(groupId);
        if (g.state == GroupState.Retired) revert WrongState(groupId, g.state);
        g.pendingAdmin = to;
        emit AdminOffered(groupId, msg.sender, to);
    }

    /// @notice Second step of an admin handover, by the new admin.
    function acceptAdmin(uint256 groupId) external {
        Group storage g = _group(groupId);
        if (msg.sender != g.pendingAdmin) revert NotPendingAdmin(groupId, msg.sender);
        if (g.state == GroupState.Retired) revert WrongState(groupId, g.state);
        emit AdminAccepted(groupId, g.admin, msg.sender);
        g.admin = msg.sender;
        g.pendingAdmin = address(0);
    }

    function setCurator(uint256 groupId, address curator, bool active) external {
        Group storage g = _adminGroup(groupId);
        if (g.state == GroupState.Retired) revert WrongState(groupId, g.state);
        if (curator == address(0)) revert ZeroAddress();
        if (_curators[groupId][curator] == active) return;
        _curators[groupId][curator] = active;
        if (active) ++g.curatorCount;
        else --g.curatorCount;
        emit CuratorSet(groupId, curator, active);
    }

    /* ------------------------------------------------------------------ membership tree */

    /// @notice Appends leaves and publishes the root computed over all leaves, in one step.
    /// @dev The contract cannot recompute the root. Anyone can, from leavesOf(); see the note on the contract.
    function addMembers(uint256 groupId, bytes32[] calldata leaves, bytes32 newRoot) external {
        Group storage g = _curatedGroup(groupId);
        uint256 size = leaves.length;
        if (size == 0 || size > MAX_BATCH) revert BadBatch(size);
        bytes32[] storage list = _leaves[groupId];
        uint256 first = list.length;
        if (first + size > TREE_CAPACITY) revert TreeFull(groupId);
        for (uint256 i; i < size; ++i) {
            bytes32 leaf = leaves[i];
            if (leaf == bytes32(0) || uint256(leaf) >= FIELD) revert BadLeaf(i);
            list.push(leaf);
        }
        emit LeavesAdded(groupId, first, size, msg.sender);
        _publish(groupId, g, newRoot, first + size);
    }

    /// @notice Replaces one leaf (bytes32(0) empties the slot: the member is out of every later root).
    /// @dev Older roots still contain the old leaf until the window moves on, or cutOffRoots() is called.
    function replaceMember(uint256 groupId, uint256 index, bytes32 newLeaf, bytes32 newRoot) external {
        Group storage g = _curatedGroup(groupId);
        bytes32[] storage list = _leaves[groupId];
        if (index >= list.length) revert NoSuchLeaf(groupId, index);
        if (uint256(newLeaf) >= FIELD) revert BadLeaf(index);
        emit LeafReplaced(groupId, index, list[index], newLeaf, msg.sender);
        list[index] = newLeaf;
        _publish(groupId, g, newRoot, list.length);
    }

    function _publish(uint256 groupId, Group storage g, bytes32 root, uint256 leafCount) private {
        if (root == bytes32(0) || uint256(root) >= FIELD) revert BadRoot();
        uint32 seq = ++g.rootSeq;
        g.root = root;
        _rootSeqOf[groupId][root] = seq;
        emit RootPublished(groupId, seq, root, leafCount, msg.sender);
    }

    /// @notice Refuses every root older than `minRootSeq` at once, for an urgent member removal. It cannot be lowered.
    function cutOffRoots(uint256 groupId, uint32 minRootSeq) external {
        Group storage g = _adminGroup(groupId);
        if (g.state == GroupState.Retired) revert WrongState(groupId, g.state);
        if (minRootSeq <= g.minRootSeq || minRootSeq > g.rootSeq) revert BadCutOff(minRootSeq);
        g.minRootSeq = minRootSeq;
        emit RootsCutOff(groupId, minRootSeq, msg.sender);
    }

    /* ------------------------------------------------------------------ the member desk (public presets) */

    /// @notice Sets slot `slot` of the group's desk: swap pairs the site shows to members. A public record, not a secret.
    /// @dev slot == length appends; an empty pair in a lower slot clears it without shifting the others.
    function setDeskPair(uint256 groupId, uint256 slot, address tokenIn, address tokenOut, string calldata label) external {
        _curatedGroup(groupId);
        DeskPair[] storage desk = _desk[groupId];
        if (slot > desk.length || slot >= MAX_DESK_PAIRS) revert SlotOutOfRange(slot);
        bytes memory raw = bytes(label);
        if (raw.length > MAX_LABEL_BYTES || !_isPrintable(raw)) revert BadName();
        bool clearing = tokenIn == address(0) && tokenOut == address(0);
        // address(0) on one side stands for native ETH, so only "the same on both sides" is meaningless (unless clearing).
        if (!clearing && (tokenIn == tokenOut || raw.length == 0)) revert BadPair();
        if (clearing && raw.length != 0) revert BadPair();
        if (slot == desk.length) desk.push(DeskPair(tokenIn, tokenOut, label));
        else desk[slot] = DeskPair(tokenIn, tokenOut, label);
        emit DeskPairSet(groupId, slot, tokenIn, tokenOut, label);
    }

    /* ------------------------------------------------------------------ recording a proof */

    /// @notice Verifies an access proof for this epoch and records it against the caller's wallet.
    /// @dev The wallet is a public input of the proof, so nobody else can take a proof seen in the mempool. The record
    ///      publicly links the caller's wallet to "a member of this group"; which member stays inside the proof.
    function recordAccess(uint256 groupId, bytes calldata proof, bytes32 root, uint32 epoch, bytes32 nullifier) external {
        Group storage g = _group(groupId);
        if (g.state != GroupState.Open) revert WrongState(groupId, g.state);
        uint32 current = _epochOf(g);
        if (epoch != current) revert StaleEpoch(current, epoch);
        uint32 seq = _rootSeqOf[groupId][root];
        if (!_rootAccepted(g, seq)) revert UnknownRoot(groupId, root);
        if (nullifier == bytes32(0) || uint256(nullifier) >= FIELD) revert BadNullifier();
        if (_nullifierUsed[groupId][nullifier]) revert NullifierUsed(groupId, nullifier);

        bytes32[] memory publicInputs = new bytes32[](5);
        publicInputs[0] = root;
        publicInputs[1] = bytes32(scopeOf(groupId));
        publicInputs[2] = bytes32(uint256(epoch));
        publicInputs[3] = nullifier;
        publicInputs[4] = bytes32(uint256(uint160(msg.sender)));
        // The verifier reverts on a malformed proof and returns false on a wrong one; both end here as a revert.
        if (!gateCheck.verify(proof, publicInputs)) revert InvalidProof();

        _nullifierUsed[groupId][nullifier] = true;
        _lastEpoch[groupId][msg.sender] = epoch;
        _everRecorded[groupId][msg.sender] = true;
        ++_recordsInEpoch[groupId][epoch];
        ++g.recordCount;
        ++totalRecords;
        _records[groupId].push(AccessRecord(msg.sender, epoch, seq, uint64(block.timestamp), nullifier));
        emit AccessRecorded(groupId, epoch, msg.sender, nullifier, seq);
    }

    /* ------------------------------------------------------------------ views */

    /// @notice The scope public input of a group: one proof is good for one group of one book on one chain.
    function scopeOf(uint256 groupId) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), groupId))) >> 8;
    }

    function groupOf(uint256 groupId) external view returns (Group memory) {
        return _group(groupId);
    }

    /// @notice Groups `start`, `start + 1`, ... up to `max` (ids begin at 1). Past the end the list is shorter.
    function groupsFrom(uint256 start, uint256 max) external view returns (Group[] memory out) {
        if (start == 0) start = 1;
        uint256 end = groupCount + 1;
        if (start >= end) return new Group[](0);
        uint256 n = _min(_min(end - start, max), MAX_PAGE);
        out = new Group[](n);
        for (uint256 i; i < n; ++i) out[i] = _groups[start + i];
    }

    function currentEpoch(uint256 groupId) external view returns (uint32) {
        return _epochOf(_group(groupId));
    }

    /// @notice Seconds until the current epoch ends, so a screen can warn before a proof would go stale.
    function epochEndsIn(uint256 groupId) external view returns (uint256) {
        uint256 len = _group(groupId).epochSeconds;
        return len - (block.timestamp % len);
    }

    function isCurator(uint256 groupId, address account) external view returns (bool) {
        return _curators[groupId][account];
    }

    function isKnownRoot(uint256 groupId, bytes32 root) external view returns (bool) {
        return _rootAccepted(_group(groupId), _rootSeqOf[groupId][root]);
    }

    function isNullifierUsed(uint256 groupId, bytes32 nullifier) external view returns (bool) {
        return _nullifierUsed[groupId][nullifier];
    }

    /// @notice True when `account` recorded a proof in the current epoch of an Open group.
    /// @dev The site's gate reads this. It is an app-level gate: venues and pools never look at it.
    function hasAccess(uint256 groupId, address account) external view returns (bool) {
        Group storage g = _group(groupId);
        return g.state == GroupState.Open && _everRecorded[groupId][account] && _lastEpoch[groupId][account] == _epochOf(g);
    }

    function lastEpochOf(uint256 groupId, address account) external view returns (uint32 epoch, bool everRecorded) {
        return (_lastEpoch[groupId][account], _everRecorded[groupId][account]);
    }

    function recordsInEpoch(uint256 groupId, uint32 epoch) external view returns (uint64) {
        return _recordsInEpoch[groupId][epoch];
    }

    function leafCountOf(uint256 groupId) external view returns (uint256) {
        return _leaves[groupId].length;
    }

    /// @notice One page of the group's leaves, which is all a reader needs to rebuild the tree without an indexer.
    function leavesOf(uint256 groupId, uint256 start, uint256 max) external view returns (bytes32[] memory out) {
        bytes32[] storage list = _leaves[groupId];
        if (start >= list.length) return new bytes32[](0);
        uint256 n = _min(_min(list.length - start, max), MAX_PAGE);
        out = new bytes32[](n);
        for (uint256 i; i < n; ++i) out[i] = list[start + i];
    }

    function recordsOf(uint256 groupId, uint256 start, uint256 max) external view returns (AccessRecord[] memory out) {
        AccessRecord[] storage list = _records[groupId];
        if (start >= list.length) return new AccessRecord[](0);
        uint256 n = _min(_min(list.length - start, max), MAX_PAGE);
        out = new AccessRecord[](n);
        for (uint256 i; i < n; ++i) out[i] = list[start + i];
    }

    function deskOf(uint256 groupId) external view returns (DeskPair[] memory) {
        return _desk[groupId];
    }

    /// @notice The chain's own block number (Robinhood Chain's block.number reports the parent chain).
    function chainBlock() external view returns (uint256) {
        return _chainBlock();
    }

    /* ------------------------------------------------------------------ internals */

    function _epochOf(Group storage g) private view returns (uint32) {
        return uint32(block.timestamp / g.epochSeconds);
    }

    function _rootAccepted(Group storage g, uint32 seq) private view returns (bool) {
        if (seq == 0 || seq < g.minRootSeq) return false;
        return g.rootSeq - seq < ROOT_WINDOW;
    }

    /// @dev ArbSys.arbBlockNumber(), with a capped gas stipend and block.number where the precompile is absent.
    function _chainBlock() private view returns (uint256) {
        (bool ok, bytes memory out) = address(100).staticcall{gas: 30_000}(abi.encodeWithSignature("arbBlockNumber()"));
        if (ok && out.length == 32) return abi.decode(out, (uint256));
        return block.number;
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
