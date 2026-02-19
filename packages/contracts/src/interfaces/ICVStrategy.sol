// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICVStrategy
/// @notice Minimal interface for Gardens V2 CVStrategy (Conviction Voting) view functions
/// @dev Only the view functions needed by YieldResolver for reading conviction weights.
///      Full CVStrategy has many more functions; this interface targets the read path only.
interface ICVStrategy {
    /// @notice Total number of proposals (1-indexed)
    function proposalCounter() external view returns (uint256);

    /// @notice Calculate the current conviction for a proposal
    /// @param proposalId The proposal ID (1-indexed)
    /// @return conviction The current conviction value
    function calculateProposalConviction(uint256 proposalId) external view returns (uint256 conviction);

    /// @notice Get the total staked amount on a proposal
    /// @param proposalId The proposal ID (1-indexed)
    /// @return stakedAmount The staked amount
    function getProposalStakedAmount(uint256 proposalId) external view returns (uint256 stakedAmount);

    /// @notice Get full proposal data
    /// @param proposalId The proposal ID (1-indexed)
    /// @return submitter The proposal creator
    /// @return beneficiary The address receiving funds if approved
    /// @return requestedToken The token being requested
    /// @return requestedAmount The amount requested
    /// @return stakedAmount The total staked amount
    /// @return proposalStatus The proposal status (0=Inactive, 1=Active, 2=Paused, 3=Cancelled, 4=Executed, 5=Disputed,
    /// 6=Rejected)
    /// @return blockLast The last block the proposal was updated
    /// @return convictionLast The last recorded conviction value
    /// @return threshold The conviction threshold for execution
    /// @return voterStakedPoints The voter's staked points
    /// @return arbitrableConfigVersion The arbitrable config version
    /// @return protocol The protocol fee
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address submitter,
            address beneficiary,
            address requestedToken,
            uint256 requestedAmount,
            uint256 stakedAmount,
            uint8 proposalStatus,
            uint256 blockLast,
            uint256 convictionLast,
            uint256 threshold,
            uint256 voterStakedPoints,
            uint256 arbitrableConfigVersion,
            uint256 protocol
        );
}
