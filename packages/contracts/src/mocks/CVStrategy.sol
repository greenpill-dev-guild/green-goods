// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IVotingPowerRegistry } from "../vendor/gardens/IVotingPowerRegistry.sol";

/// @title MockCVStrategy
/// @notice Mock conviction voting strategy implementing the HypercertSignalPool ABI
/// @dev Uses hybrid approach: faithful allocation tracking + simplified conviction formula.
///      Conviction formula: convictionLast + (stakedAmount * blocksElapsed * weight / D)
///      This is sufficient for E2E flow validation without implementing full exponential decay.
contract MockCVStrategy {
    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    struct HypercertEntry {
        uint256 stakedAmount;
        uint256 convictionLast;
        uint256 blockLast;
        bool active;
    }

    struct Signal {
        uint256 hypercertId;
        int256 deltaSupport;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error NotEligibleVoter(address account);
    error HypercertNotRegistered(uint256 hypercertId);
    error HypercertAlreadyRegistered(uint256 hypercertId);
    error InsufficientSupport(uint256 hypercertId, uint256 currentAmount, int256 delta);

    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Power registry for voter eligibility checks
    IVotingPowerRegistry public votingPowerRegistry;

    /// @notice Community this strategy belongs to
    address public community;

    /// @notice CV parameters
    uint256 public decay;
    uint256 public maxRatio;
    uint256 public weight;
    uint256 public minThresholdPoints;
    uint256 public constant D = 10_000_000;

    /// @notice Registered hypercert IDs
    uint256[] internal _registeredIds;

    /// @notice Hypercert state by ID
    mapping(uint256 id => HypercertEntry) public entries;

    /// @notice Voter allocations: voter => hypercertId => amount
    mapping(address voter => mapping(uint256 id => uint256 amount)) public voterAllocations;

    /// @notice Track which IDs a voter has allocated to (for getVoterAllocations)
    mapping(address voter => uint256[] ids) internal _voterAllocationIds;

    /// @notice Total stake per voter across all hypercerts
    mapping(address voter => uint256) public voterTotalStakes;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _votingPowerRegistry,
        address _community,
        uint256 _decay,
        uint256 _maxRatio,
        uint256 _weight,
        uint256 _minThresholdPoints
    ) {
        votingPowerRegistry = IVotingPowerRegistry(_votingPowerRegistry);
        community = _community;
        decay = _decay;
        maxRatio = _maxRatio;
        weight = _weight;
        minThresholdPoints = _minThresholdPoints;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Hypercert Registration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register a hypercert for signaling
    function registerHypercert(uint256 hypercertId) external {
        if (entries[hypercertId].active) revert HypercertAlreadyRegistered(hypercertId);

        entries[hypercertId] = HypercertEntry({ stakedAmount: 0, convictionLast: 0, blockLast: block.number, active: true });
        _registeredIds.push(hypercertId);
    }

    /// @notice Deregister a hypercert from signaling
    function deregisterHypercert(uint256 hypercertId) external {
        if (!entries[hypercertId].active) revert HypercertNotRegistered(hypercertId);

        entries[hypercertId].active = false;

        // Remove from registered list
        for (uint256 i = 0; i < _registeredIds.length; i++) {
            if (_registeredIds[i] == hypercertId) {
                _registeredIds[i] = _registeredIds[_registeredIds.length - 1];
                _registeredIds.pop();
                break;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Support Allocation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Allocate or deallocate support for hypercerts
    /// @param signals Array of (hypercertId, deltaSupport) where deltaSupport can be negative
    function allocateSupport(Signal[] calldata signals) external {
        if (!_isEligible(msg.sender)) revert NotEligibleVoter(msg.sender);

        for (uint256 i = 0; i < signals.length; i++) {
            uint256 hid = signals[i].hypercertId;
            int256 delta = signals[i].deltaSupport;

            if (!entries[hid].active) revert HypercertNotRegistered(hid);

            // Update conviction snapshot before changing stake
            _updateConviction(hid);

            uint256 currentAllocation = voterAllocations[msg.sender][hid];

            if (delta < 0) {
                uint256 decrease = uint256(-delta);
                if (decrease > currentAllocation) {
                    revert InsufficientSupport(hid, currentAllocation, delta);
                }
                voterAllocations[msg.sender][hid] = currentAllocation - decrease;
                voterTotalStakes[msg.sender] -= decrease;
                entries[hid].stakedAmount -= decrease;
            } else {
                uint256 increase = uint256(delta);
                if (currentAllocation == 0 && increase > 0) {
                    _voterAllocationIds[msg.sender].push(hid);
                }
                voterAllocations[msg.sender][hid] = currentAllocation + increase;
                voterTotalStakes[msg.sender] += increase;
                entries[hid].stakedAmount += increase;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions (matches HYPERCERT_SIGNAL_POOL_ABI)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Calculate current conviction for a hypercert
    /// @dev Simplified formula: convictionLast + (stakedAmount * elapsed * weight / D)
    function calculateConviction(uint256 hypercertId) external view returns (uint256) {
        HypercertEntry storage e = entries[hypercertId];
        if (!e.active) return 0;

        uint256 elapsed = block.number - e.blockLast;
        if (elapsed == 0) return e.convictionLast;

        return e.convictionLast + (e.stakedAmount * elapsed * weight / D);
    }

    /// @notice Get conviction weights for all registered hypercerts
    /// @return ids Array of hypercert IDs
    /// @return weights Array of conviction weights (parallel to ids)
    function getConvictionWeights() external view returns (uint256[] memory ids, uint256[] memory weights) {
        uint256 len = _registeredIds.length;
        ids = new uint256[](len);
        weights = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            uint256 hid = _registeredIds[i];
            ids[i] = hid;

            HypercertEntry storage e = entries[hid];
            uint256 elapsed = block.number - e.blockLast;
            weights[i] = e.convictionLast + (e.stakedAmount * elapsed * weight / D);
        }
    }

    /// @notice Get a voter's allocations across all hypercerts
    /// @return ids Array of hypercert IDs the voter has allocated to
    /// @return amounts Array of allocation amounts (parallel to ids)
    function getVoterAllocations(address voter) external view returns (uint256[] memory ids, uint256[] memory amounts) {
        uint256[] storage allIds = _voterAllocationIds[voter];

        // Count non-zero allocations
        uint256 count = 0;
        for (uint256 i = 0; i < allIds.length; i++) {
            if (voterAllocations[voter][allIds[i]] > 0) count++;
        }

        ids = new uint256[](count);
        amounts = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < allIds.length; i++) {
            uint256 amt = voterAllocations[voter][allIds[i]];
            if (amt > 0) {
                ids[j] = allIds[i];
                amounts[j] = amt;
                j++;
            }
        }
    }

    /// @notice Get all registered hypercert IDs
    function getRegisteredHypercerts() external view returns (uint256[] memory) {
        return _registeredIds;
    }

    /// @notice Check if an account is eligible to vote
    function isEligibleVoter(address account) external view returns (bool) {
        return _isEligible(account);
    }

    /// @notice Get total stake for a voter
    function voterTotalStake(address voter) external view returns (uint256) {
        return voterTotalStakes[voter];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin (test helpers)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Update decay parameter (for testing different CV configs)
    function setDecay(uint256 _decay) external {
        decay = _decay;
    }

    /// @notice Update weight parameter
    function setWeight(uint256 _weight) external {
        weight = _weight;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Snapshot conviction before stake changes
    function _updateConviction(uint256 hypercertId) internal {
        HypercertEntry storage e = entries[hypercertId];
        uint256 elapsed = block.number - e.blockLast;
        if (elapsed > 0) {
            e.convictionLast = e.convictionLast + (e.stakedAmount * elapsed * weight / D);
            e.blockLast = block.number;
        }
    }

    /// @notice Check voter eligibility via power registry
    function _isEligible(address account) internal view returns (bool) {
        if (address(votingPowerRegistry) == address(0)) return true;
        return votingPowerRegistry.isMember(account);
    }
}
