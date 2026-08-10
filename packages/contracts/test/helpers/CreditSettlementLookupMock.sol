// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal settlement relationship fixture for record-only CreditRegistry tests.
contract CreditSettlementLookupMock {
    mapping(address registry => mapping(uint256 loanId => uint256 disbursementId)) private _children;

    function setLoanPrincipalDisbursement(address registry, uint256 loanId, uint256 disbursementId) external {
        _children[registry][loanId] = disbursementId;
    }

    function loanPrincipalDisbursementOf(address registry, uint256 loanId) external view returns (uint256) {
        return _children[registry][loanId];
    }
}
