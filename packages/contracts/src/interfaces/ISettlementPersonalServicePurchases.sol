// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ISettlementPersonalServicePurchases {
    enum PersonalPurchaseOutcome {
        None, // no commercial outcome selected
        Payout, // irreversible full-settlement branch selected
        Refund, // immutable full recorded-net refund branch selected
        Settled, // all existing payout-plan children confirmed
        Refunded // the one existing refund child confirmed
    }

    // Exact transaction input order. buyer and recipient are both msg.sender.
    struct PersonalPurchaseConsent {
        uint256 commitmentId;
        uint64 expectedTermsRevision;
        bytes32 expectedTermsHash;
        bytes32 expectedClaimHash;
        uint64 expectedRequestNonce;
        address buyerGarden;
        uint64 expectedDestinationChainId;
        address expectedToken;
        address expectedCustodySafe;
        address authorizedDepositor;
        address refundAccount;
        uint256 expectedPrice;
        uint256 disclosedGrossAmount;
        uint256 disclosedNetAmount;
    }

    // Exact immutable storage/view/event field order. All values derive from the supported
    // core's exact consent, immutable module configuration and the signed input above.
    struct PersonalPurchaseTerms {
        uint8 version;
        bytes32 purchaseId;
        uint256 sourceChainId;
        address sourceModule;
        uint256 commitmentId;
        uint64 termsRevision;
        bytes32 termsHash;
        bytes32 claimHash;
        uint64 requestNonce;
        address buyer;
        address recipient;
        address buyerGarden;
        address providerGarden;
        uint64 destinationChainId;
        address token;
        uint256 price;
        address custodySafe;
        address authorizedDepositor;
        address refundAccount;
        uint256 disclosedGrossAmount;
        uint256 disclosedNetAmount;
    }

    // Exact input/storage/view/event order. logIndex is the RPC receipt log.logIndex,
    // not the caller's choice of a deposit-reference hash or an array-local ordinal.
    struct VerifiedCeloDeposit {
        uint64 chainId;
        address token;
        bytes32 transactionHash;
        uint32 logIndex;
        uint64 blockNumber;
        bytes32 blockHash;
        address depositingAccount;
        address custodySafe;
        uint256 grossDebit;
        uint256 receivedAmount;
    }

    struct PersonalServicePurchase {
        PersonalPurchaseTerms terms;
        VerifiedCeloDeposit deposit;
        PersonalPurchaseOutcome outcome;
        uint256 payoutPlanId;
    }

    function pledgePersonalServicePurchase(PersonalPurchaseConsent calldata consent)
        external
        returns (uint256 fundingId, bytes32 purchaseId);
    function recordPersonalServiceDeposit(uint256 fundingId, VerifiedCeloDeposit calldata deposit) external;
    function getPersonalServicePurchase(uint256 fundingId) external view returns (PersonalServicePurchase memory purchase);
    function fundingOfPersonalServicePurchase(bytes32 purchaseId) external view returns (uint256 fundingId);
    function personalServiceDepositFunding(
        uint64 chainId,
        bytes32 transactionHash,
        uint32 logIndex
    )
        external
        view
        returns (uint256 fundingId);

    // Struct event arguments are intentional additive ABI tuples. Existing events are unchanged.
    event PersonalServicePurchasePledged(
        bytes32 indexed purchaseId, uint256 indexed fundingId, uint256 indexed commitmentId, PersonalPurchaseTerms terms
    );
    event PersonalServiceDepositVerified(
        bytes32 indexed receiptKey,
        uint256 indexed fundingId,
        bytes32 indexed purchaseId,
        VerifiedCeloDeposit deposit,
        address verifiedBy
    );
    event PersonalServicePurchaseOutcomeSelected(
        bytes32 indexed purchaseId,
        uint256 indexed fundingId,
        PersonalPurchaseOutcome outcome,
        uint256 payoutPlanId,
        uint256 refundDisbursementId
    );
    event PersonalServicePurchaseOutcomeCompleted(
        bytes32 indexed purchaseId, uint256 indexed fundingId, PersonalPurchaseOutcome outcome
    );

    error UnknownPersonalServicePurchase(uint256 fundingId);
    error PersonalServiceModeRequired(uint256 commitmentId);
    error PersonalServiceConsentMismatch(uint256 commitmentId);
    error PersonalServiceTermsChanged(uint256 fundingId);
    error PersonalServiceReceiptMismatch(uint256 fundingId);
    error PersonalServiceFundingRequired(uint256 commitmentId);
    error PersonalServiceOutcomeConflict(bytes32 purchaseId, PersonalPurchaseOutcome outcome);
    error PersonalServiceUnsafeRecovery(uint256 disbursementId);
    error PersonalServiceExcessNotConsented(uint256 fundingId);
    error PersonalServiceDepositProofRequired(uint256 fundingId);
}
