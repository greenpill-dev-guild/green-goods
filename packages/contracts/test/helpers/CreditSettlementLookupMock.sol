// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal settlement relationship fixture for record-only CreditRegistry tests.
contract CreditSettlementLookupMock {
    struct LoanPrincipalRelationship {
        address creditRegistry;
        uint256 loanId;
    }

    mapping(address registry => mapping(uint256 loanId => uint256 disbursementId)) private _children;
    address public creditRegistry;
    address public commitmentPoolingModule;
    address public hatsModule;

    function configure(address creditRegistry_, address hatsModule_, address commitmentPoolingModule_) external {
        creditRegistry = creditRegistry_;
        hatsModule = hatsModule_;
        commitmentPoolingModule = commitmentPoolingModule_;
    }

    function setLoanPrincipalDisbursement(address registry, uint256 loanId, uint256 disbursementId) external {
        _children[registry][loanId] = disbursementId;
    }

    function loanPrincipalDisbursementOf(address registry, uint256 loanId) external view returns (uint256) {
        return _children[registry][loanId];
    }

    function loanPrincipalRelationshipOf(uint256) external pure returns (LoanPrincipalRelationship memory) {
        return LoanPrincipalRelationship({ creditRegistry: address(0), loanId: 0 });
    }
}
