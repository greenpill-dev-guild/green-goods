// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";

/// @notice Payout-plan state and behavior kept outside the SettlementModule shell.
/// @dev Public library entrypoints execute with DELEGATECALL. This keeps the source module
///      deployable without weakening the single-address settlement interface.
library SettlementPlanLib {
    uint256 internal constant MAX_PAYOUT_CONTRIBUTORS = 40;
    uint16 private constant _BPS_DENOMINATOR = 10_000;

    struct State {
        uint256 nextPayoutPlanId;
        mapping(uint256 payoutPlanId => ISettlementModule.CommitmentPayoutPlan plan) payoutPlans;
        mapping(uint256 payoutPlanId => mapping(address contributor => ISettlementModule.ContributorPayout payout))
            contributorPayouts;
        mapping(uint256 commitmentId => uint256 payoutPlanId) payoutPlanOfCommitment;
    }

    struct RuntimeConfig {
        address hatsModule;
        address poolingModule;
        address gDollarToken;
        uint64 destinationEvmChainId;
    }

    event CommitmentPayoutPlanCreated(
        uint256 indexed payoutPlanId,
        uint256 indexed commitmentId,
        address indexed providerGarden,
        address payerGarden,
        address source,
        address token,
        uint8 payoutKind,
        uint256 declaredAmount,
        uint256 gardenRetainedAmount,
        address beneficiaryGarden,
        address beneficiaryRecipient,
        uint256 beneficiaryAmount,
        bytes32 recognitionSnapshotHash,
        address createdBy
    );
    event ContributorPayoutSet(
        uint256 indexed payoutPlanId,
        uint32 indexed paymentSnapshotVersion,
        address indexed contributor,
        address recipient,
        uint16 recognitionWeightBps,
        uint16 paymentWeightBps,
        uint256 amount,
        string reasonCID,
        address editedBy
    );
    event CommitmentPayoutSnapshotCommitted(
        uint256 indexed payoutPlanId,
        uint32 indexed paymentSnapshotVersion,
        uint32 rowCount,
        uint256 gardenRetainedAmount,
        uint256 contributorPayoutTotal,
        bytes32 paymentSnapshotHash,
        string reasonCID,
        address editedBy
    );
    event CommitmentPayoutPlanFinalized(
        uint256 indexed payoutPlanId,
        uint8 payoutKind,
        uint32 payablePayoutCount,
        uint256 contributorPayoutTotal,
        uint256 beneficiaryAmount,
        uint256 gardenRetainedAmount,
        bytes32 recognitionSnapshotHash,
        bytes32 paymentSnapshotHash,
        bool completedWithoutDispatch,
        uint64 finalizedAt
    );

    function initialize(State storage self) public {
        if (self.nextPayoutPlanId == 0) self.nextPayoutPlanId = 1;
    }

    function createCommitmentPayoutPlan(
        State storage self,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        RuntimeConfig memory config,
        uint256 commitmentId,
        ISettlementModule.RecognitionEntry[] calldata recognitionEntries,
        bytes32 recognitionSnapshotHash
    )
        public
        returns (uint256 payoutPlanId)
    {
        ICommitmentPoolingModule.Commitment memory commitment =
            ICommitmentPoolingModule(config.poolingModule).getCommitment(commitmentId);
        if (commitment.payerGarden == address(0)) {
            revert ISettlementModule.InvalidPayerGarden(commitmentId);
        }
        _requireSteward(config.hatsModule, commitment.payerGarden);

        uint256 existing = self.payoutPlanOfCommitment[commitmentId];
        if (existing != 0) revert ISettlementModule.CommitmentPayoutPlanExists(commitmentId, existing);
        if (
            commitment.state != ICommitmentPoolingModule.CommitmentState.Fulfilled || commitment.consideration.amount == 0
                || commitment.consideration.rail != ICommitmentPoolingModule.ConsiderationRail.CeloSettlement
                || commitment.consideration.source != address(0) || commitment.consideration.token != address(0)
        ) revert ISettlementModule.ConsiderationNotDeclared(commitmentId);

        ISettlementModule.SettlementAccount storage payerAccount =
            _activeAccount(accounts, commitment.payerGarden, config.destinationEvmChainId);
        payoutPlanId = self.nextPayoutPlanId++;
        ISettlementModule.CommitmentPayoutPlan storage plan = self.payoutPlans[payoutPlanId];
        plan.commitmentId = commitmentId;
        plan.providerGarden = commitment.providerGarden;
        plan.payerGarden = commitment.payerGarden;
        plan.source = payerAccount.account;
        plan.token = config.gDollarToken;
        plan.declaredAmount = commitment.consideration.amount;
        plan.paymentSnapshotVersion = 1;
        plan.createdAt = uint64(block.timestamp);

        bool beneficiaryShape = commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request
            && commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden;
        if (beneficiaryShape) {
            _createBeneficiarySnapshot(
                plan,
                accounts,
                config.destinationEvmChainId,
                payoutPlanId,
                commitment,
                recognitionEntries,
                recognitionSnapshotHash
            );
        } else {
            plan.payoutKind = ISettlementModule.DisbursementKind.ContributorConsideration;
            _createContributorSnapshot(
                self, plan, payoutPlanId, config.poolingModule, recognitionEntries, recognitionSnapshotHash
            );
        }

        self.payoutPlanOfCommitment[commitmentId] = payoutPlanId;
        _emitPlanCreated(plan, payoutPlanId, msg.sender);
        if (plan.payoutKind == ISettlementModule.DisbursementKind.ContributorConsideration) {
            _emitContributorSnapshot(self, plan, payoutPlanId, "", msg.sender);
        }
    }

    function setContributorPayouts(
        State storage self,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address hatsModule,
        uint64 destinationEvmChainId,
        uint256 payoutPlanId,
        uint256 gardenRetainedAmount,
        ISettlementModule.ContributorPayoutInput[] calldata payouts,
        string calldata reasonCID
    )
        public
    {
        ISettlementModule.CommitmentPayoutPlan storage plan = _knownPlan(self, payoutPlanId);
        _requireSteward(hatsModule, plan.payerGarden);
        _activeAccountMatches(accounts, plan.payerGarden, plan.source, destinationEvmChainId);
        if (plan.finalized) revert ISettlementModule.PayoutPlanFinalized(payoutPlanId);
        if (plan.payoutKind != ISettlementModule.DisbursementKind.ContributorConsideration) {
            revert ISettlementModule.PayoutKindMismatch(
                payoutPlanId, ISettlementModule.DisbursementKind.ContributorConsideration, plan.payoutKind
            );
        }
        if (plan.payerGarden != plan.providerGarden && gardenRetainedAmount != 0) {
            revert ISettlementModule.PayoutPlanInvariantMismatch(plan.declaredAmount, gardenRetainedAmount, 0, 0);
        }
        (uint256[] memory amounts, uint256 contributorTotal) =
            _validatedEditAmounts(self, plan, payouts, gardenRetainedAmount, reasonCID);
        _applyContributorEdit(self, plan, payoutPlanId, gardenRetainedAmount, contributorTotal, amounts, reasonCID);
        _emitContributorSnapshot(self, plan, payoutPlanId, reasonCID, msg.sender);
    }

    function finalizeCommitmentPayoutPlan(
        State storage self,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address hatsModule,
        address poolingModule,
        uint64 destinationEvmChainId,
        uint256 payoutPlanId
    )
        public
    {
        ISettlementModule.CommitmentPayoutPlan storage plan = _knownPlan(self, payoutPlanId);
        _requireSteward(hatsModule, plan.payerGarden);
        _activeAccountMatches(accounts, plan.payerGarden, plan.source, destinationEvmChainId);
        if (plan.finalized) revert ISettlementModule.PayoutPlanFinalized(payoutPlanId);

        if (plan.payoutKind == ISettlementModule.DisbursementKind.GardenBeneficiary) {
            _activeAccountMatches(accounts, plan.beneficiaryGarden, plan.beneficiaryRecipient, destinationEvmChainId);
            if (
                plan.gardenRetainedAmount != 0 || plan.contributorPayoutTotal != 0
                    || plan.beneficiaryAmount != plan.declaredAmount || plan.contributorOrder.length != 0
                    || plan.payablePayoutCount != 1
            ) {
                revert ISettlementModule.PayoutPlanInvariantMismatch(
                    plan.declaredAmount, plan.gardenRetainedAmount, plan.contributorPayoutTotal, plan.beneficiaryAmount
                );
            }
        } else {
            if (plan.payerGarden != plan.providerGarden && plan.gardenRetainedAmount != 0) {
                revert ISettlementModule.PayoutPlanInvariantMismatch(
                    plan.declaredAmount, plan.gardenRetainedAmount, plan.contributorPayoutTotal, 0
                );
            }
            if (plan.declaredAmount != plan.gardenRetainedAmount + plan.contributorPayoutTotal) {
                revert ISettlementModule.PayoutPlanInvariantMismatch(
                    plan.declaredAmount, plan.gardenRetainedAmount, plan.contributorPayoutTotal, 0
                );
            }
            _revalidateRecognition(self, plan, poolingModule);
        }

        plan.finalized = true;
        plan.finalizedAt = uint64(block.timestamp);
        bool completedWithoutDispatch =
            plan.payoutKind == ISettlementModule.DisbursementKind.ContributorConsideration && plan.payablePayoutCount == 0;
        emit CommitmentPayoutPlanFinalized(
            payoutPlanId,
            uint8(plan.payoutKind),
            plan.payablePayoutCount,
            plan.contributorPayoutTotal,
            plan.beneficiaryAmount,
            plan.gardenRetainedAmount,
            plan.recognitionSnapshotHash,
            plan.paymentSnapshotHash,
            completedWithoutDispatch,
            plan.finalizedAt
        );
    }

    function _createBeneficiarySnapshot(
        ISettlementModule.CommitmentPayoutPlan storage plan,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        uint64 destinationEvmChainId,
        uint256 payoutPlanId,
        ICommitmentPoolingModule.Commitment memory commitment,
        ISettlementModule.RecognitionEntry[] calldata recognitionEntries,
        bytes32 recognitionSnapshotHash
    )
        private
    {
        if (commitment.providerGarden == address(0) || commitment.providerGarden == commitment.payerGarden) {
            revert ISettlementModule.InvalidPayoutVector();
        }
        if (recognitionEntries.length != 0 || recognitionSnapshotHash != bytes32(0)) {
            revert ISettlementModule.InvalidRecognitionVector();
        }
        ISettlementModule.SettlementAccount storage beneficiaryAccount =
            _activeAccount(accounts, commitment.providerGarden, destinationEvmChainId);
        plan.payoutKind = ISettlementModule.DisbursementKind.GardenBeneficiary;
        plan.beneficiaryGarden = commitment.providerGarden;
        plan.beneficiaryRecipient = beneficiaryAccount.account;
        plan.beneficiaryAmount = commitment.consideration.amount;
        plan.payablePayoutCount = 1;
        plan.paymentSnapshotHash = keccak256(
            abi.encode(
                block.chainid,
                payoutPlanId,
                plan.payoutKind,
                plan.beneficiaryGarden,
                plan.beneficiaryRecipient,
                plan.beneficiaryAmount
            )
        );
    }

    function _createContributorSnapshot(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        address poolingModule,
        ISettlementModule.RecognitionEntry[] calldata recognitionEntries,
        bytes32 recognitionSnapshotHash
    )
        private
    {
        uint256 length = recognitionEntries.length;
        if (length == 0 || length > MAX_PAYOUT_CONTRIBUTORS) {
            revert ISettlementModule.TooManyPayoutContributors(length, MAX_PAYOUT_CONTRIBUTORS);
        }
        ICommitmentPoolingModule.RecognitionEntry[] memory poolingEntries =
            new ICommitmentPoolingModule.RecognitionEntry[](length);
        for (uint256 index; index < length; ++index) {
            poolingEntries[index] = ICommitmentPoolingModule.RecognitionEntry({
                contributor: recognitionEntries[index].contributor,
                recognitionWeightBps: recognitionEntries[index].recognitionWeightBps
            });
        }
        bytes32 canonical = ICommitmentPoolingModule(poolingModule).validateRecognitionSnapshot(
            plan.commitmentId, poolingEntries, recognitionSnapshotHash
        );
        if (canonical != recognitionSnapshotHash) {
            revert ISettlementModule.RecognitionSnapshotMismatch(canonical, recognitionSnapshotHash);
        }

        plan.recognitionSnapshotHash = recognitionSnapshotHash;
        plan.recognitionContributorCount = uint32(length);
        uint256[] memory amounts = _calculateAndStoreContributorRows(self, plan, payoutPlanId, recognitionEntries);
        _commitInitialContributorSnapshot(self, plan, payoutPlanId, amounts);
    }

    function _calculateAndStoreContributorRows(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        ISettlementModule.RecognitionEntry[] calldata recognitionEntries
    )
        private
        returns (uint256[] memory amounts)
    {
        uint256 length = recognitionEntries.length;
        amounts = new uint256[](length);
        uint256[] memory remainders = new uint256[](length);
        uint256 distributed;
        for (uint256 index; index < length; ++index) {
            ISettlementModule.RecognitionEntry calldata entry = recognitionEntries[index];
            if (entry.contributor == address(0)) revert ISettlementModule.InvalidRecognitionVector();
            if (index != 0 && recognitionEntries[index - 1].contributor >= entry.contributor) {
                revert ISettlementModule.InvalidRecognitionVector();
            }
            uint256 product = plan.declaredAmount * entry.recognitionWeightBps;
            amounts[index] = product / _BPS_DENOMINATOR;
            remainders[index] = product % _BPS_DENOMINATOR;
            distributed += amounts[index];
            plan.contributorOrder.push(entry.contributor);
            self.contributorPayouts[payoutPlanId][entry.contributor] = ISettlementModule.ContributorPayout({
                contributor: entry.contributor,
                recognitionWeightBps: entry.recognitionWeightBps,
                paymentWeightBps: 0,
                amount: 0,
                recipient: entry.contributor,
                disbursementId: 0
            });
        }
        _distributeRemainder(plan.contributorOrder, amounts, remainders, plan.declaredAmount - distributed);
    }

    function _commitInitialContributorSnapshot(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        uint256[] memory amounts
    )
        private
    {
        uint16[] memory paymentWeights = _normalizeWeights(plan.contributorOrder, amounts, plan.declaredAmount);
        ISettlementModule.PaymentSnapshotEntry[] memory snapshot =
            _replaceContributorRows(self, plan, payoutPlanId, amounts, paymentWeights);
        uint256 declaredAmount = plan.declaredAmount;
        plan.contributorPayoutTotal = declaredAmount;
        plan.paymentSnapshotHash =
            keccak256(abi.encode(block.chainid, payoutPlanId, uint32(1), uint256(0), declaredAmount, snapshot));
    }

    function _validatedEditAmounts(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        ISettlementModule.ContributorPayoutInput[] calldata payouts,
        uint256 gardenRetainedAmount,
        string calldata reasonCID
    )
        private
        view
        returns (uint256[] memory amounts, uint256 contributorTotal)
    {
        uint256 length = plan.contributorOrder.length;
        if (payouts.length != length) revert ISettlementModule.InvalidPayoutVector();
        amounts = new uint256[](length);
        for (uint256 index; index < length; ++index) {
            if (payouts[index].contributor != plan.contributorOrder[index]) {
                revert ISettlementModule.InvalidPayoutVector();
            }
            amounts[index] = payouts[index].amount;
            contributorTotal += payouts[index].amount;
        }
        if (plan.declaredAmount != gardenRetainedAmount + contributorTotal) {
            revert ISettlementModule.PayoutPlanInvariantMismatch(
                plan.declaredAmount, gardenRetainedAmount, contributorTotal, 0
            );
        }
        uint256[] memory canonical = _canonicalAmounts(self, plan, plan.declaredAmount);
        bool canonicalVector = gardenRetainedAmount == 0;
        for (uint256 index; index < length; ++index) {
            if (amounts[index] != canonical[index]) canonicalVector = false;
        }
        if (!canonicalVector && bytes(reasonCID).length == 0) {
            revert ISettlementModule.RecognitionPaymentDivergenceRequiresReason();
        }
    }

    function _applyContributorEdit(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        uint256 gardenRetainedAmount,
        uint256 contributorTotal,
        uint256[] memory amounts,
        string calldata reasonCID
    )
        private
    {
        uint16[] memory weights = _normalizeWeights(plan.contributorOrder, amounts, contributorTotal);
        uint32 nextVersion = plan.paymentSnapshotVersion + 1;
        plan.paymentSnapshotVersion = nextVersion;
        plan.gardenRetainedAmount = gardenRetainedAmount;
        plan.contributorPayoutTotal = contributorTotal;
        plan.latestEditReasonCID = reasonCID;
        plan.payablePayoutCount = 0;
        ISettlementModule.PaymentSnapshotEntry[] memory snapshot =
            _replaceContributorRows(self, plan, payoutPlanId, amounts, weights);
        plan.paymentSnapshotHash = keccak256(
            abi.encode(block.chainid, payoutPlanId, nextVersion, gardenRetainedAmount, contributorTotal, snapshot)
        );
    }

    function _replaceContributorRows(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        uint256[] memory amounts,
        uint16[] memory weights
    )
        private
        returns (ISettlementModule.PaymentSnapshotEntry[] memory snapshot)
    {
        snapshot = new ISettlementModule.PaymentSnapshotEntry[](amounts.length);
        for (uint256 index; index < amounts.length; ++index) {
            address contributor = plan.contributorOrder[index];
            ISettlementModule.ContributorPayout storage payout = self.contributorPayouts[payoutPlanId][contributor];
            payout.amount = amounts[index];
            payout.paymentWeightBps = weights[index];
            if (amounts[index] != 0) ++plan.payablePayoutCount;
            snapshot[index] = ISettlementModule.PaymentSnapshotEntry({
                contributor: contributor,
                recipient: payout.recipient,
                recognitionWeightBps: payout.recognitionWeightBps,
                paymentWeightBps: weights[index],
                amount: amounts[index]
            });
        }
    }

    function _emitContributorSnapshot(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        string memory reasonCID,
        address editor
    )
        private
    {
        for (uint256 index; index < plan.contributorOrder.length; ++index) {
            ISettlementModule.ContributorPayout storage payout =
                self.contributorPayouts[payoutPlanId][plan.contributorOrder[index]];
            emit ContributorPayoutSet(
                payoutPlanId,
                plan.paymentSnapshotVersion,
                payout.contributor,
                payout.recipient,
                payout.recognitionWeightBps,
                payout.paymentWeightBps,
                payout.amount,
                reasonCID,
                editor
            );
        }
        emit CommitmentPayoutSnapshotCommitted(
            payoutPlanId,
            plan.paymentSnapshotVersion,
            uint32(plan.contributorOrder.length),
            plan.gardenRetainedAmount,
            plan.contributorPayoutTotal,
            plan.paymentSnapshotHash,
            reasonCID,
            editor
        );
    }

    function _emitPlanCreated(
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 payoutPlanId,
        address creator
    )
        private
    {
        emit CommitmentPayoutPlanCreated(
            payoutPlanId,
            plan.commitmentId,
            plan.providerGarden,
            plan.payerGarden,
            plan.source,
            plan.token,
            uint8(plan.payoutKind),
            plan.declaredAmount,
            plan.gardenRetainedAmount,
            plan.beneficiaryGarden,
            plan.beneficiaryRecipient,
            plan.beneficiaryAmount,
            plan.recognitionSnapshotHash,
            creator
        );
    }

    function _canonicalAmounts(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        uint256 total
    )
        private
        view
        returns (uint256[] memory amounts)
    {
        uint256 length = plan.contributorOrder.length;
        amounts = new uint256[](length);
        uint256[] memory remainders = new uint256[](length);
        uint256 distributed;
        uint256 payoutPlanId = self.payoutPlanOfCommitment[plan.commitmentId];
        for (uint256 index; index < length; ++index) {
            ISettlementModule.ContributorPayout storage payout =
                self.contributorPayouts[payoutPlanId][plan.contributorOrder[index]];
            uint256 product = total * payout.recognitionWeightBps;
            amounts[index] = product / _BPS_DENOMINATOR;
            remainders[index] = product % _BPS_DENOMINATOR;
            distributed += amounts[index];
        }
        _distributeRemainder(plan.contributorOrder, amounts, remainders, total - distributed);
    }

    function _normalizeWeights(
        address[] storage contributors,
        uint256[] memory amounts,
        uint256 total
    )
        private
        view
        returns (uint16[] memory weights)
    {
        uint256 length = amounts.length;
        weights = new uint16[](length);
        if (total == 0) return weights;
        uint256[] memory rawWeights = new uint256[](length);
        uint256[] memory remainders = new uint256[](length);
        uint256 distributed;
        for (uint256 index; index < length; ++index) {
            uint256 product = amounts[index] * _BPS_DENOMINATOR;
            rawWeights[index] = product / total;
            remainders[index] = product % total;
            distributed += rawWeights[index];
        }
        _distributeRemainder(contributors, rawWeights, remainders, _BPS_DENOMINATOR - distributed);
        for (uint256 index; index < length; ++index) {
            weights[index] = uint16(rawWeights[index]);
        }
    }

    function _distributeRemainder(
        address[] storage contributors,
        uint256[] memory values,
        uint256[] memory remainders,
        uint256 count
    )
        private
        view
    {
        bool[] memory used = new bool[](values.length);
        for (uint256 unit; unit < count; ++unit) {
            uint256 best;
            bool found;
            for (uint256 index; index < values.length; ++index) {
                if (
                    !used[index]
                        && (
                            !found || remainders[index] > remainders[best]
                                || (remainders[index] == remainders[best] && contributors[index] < contributors[best])
                        )
                ) {
                    best = index;
                    found = true;
                }
            }
            if (!found) break;
            ++values[best];
            used[best] = true;
        }
    }

    function _revalidateRecognition(
        State storage self,
        ISettlementModule.CommitmentPayoutPlan storage plan,
        address poolingModule
    )
        private
        view
    {
        uint256 length = plan.contributorOrder.length;
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](length);
        uint256 payoutPlanId = self.payoutPlanOfCommitment[plan.commitmentId];
        for (uint256 index; index < length; ++index) {
            ISettlementModule.ContributorPayout storage payout =
                self.contributorPayouts[payoutPlanId][plan.contributorOrder[index]];
            entries[index] = ICommitmentPoolingModule.RecognitionEntry({
                contributor: payout.contributor,
                recognitionWeightBps: payout.recognitionWeightBps
            });
        }
        bytes32 canonical = ICommitmentPoolingModule(poolingModule).validateRecognitionSnapshot(
            plan.commitmentId, entries, plan.recognitionSnapshotHash
        );
        if (canonical != plan.recognitionSnapshotHash) {
            revert ISettlementModule.RecognitionSnapshotMismatch(canonical, plan.recognitionSnapshotHash);
        }
    }

    function _knownPlan(
        State storage self,
        uint256 payoutPlanId
    )
        private
        view
        returns (ISettlementModule.CommitmentPayoutPlan storage plan)
    {
        plan = self.payoutPlans[payoutPlanId];
        if (plan.commitmentId == 0) revert ISettlementModule.UnknownPayoutPlan(payoutPlanId);
    }

    function _activeAccount(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address garden,
        uint64 destinationEvmChainId
    )
        private
        view
        returns (ISettlementModule.SettlementAccount storage account)
    {
        account = accounts[garden];
        if (account.account == address(0)) revert ISettlementModule.UnknownSettlementAccount(garden);
        if (!account.active) revert ISettlementModule.SettlementAccountInactive(garden);
        if (account.chainId != destinationEvmChainId) {
            revert ISettlementModule.InvalidSettlementChain(account.chainId);
        }
    }

    function _activeAccountMatches(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address garden,
        address expected,
        uint64 destinationEvmChainId
    )
        private
        view
    {
        ISettlementModule.SettlementAccount storage account = _activeAccount(accounts, garden, destinationEvmChainId);
        if (account.account != expected) revert ISettlementModule.SettlementAccountInactive(garden);
    }

    function _requireSteward(address hatsModule, address garden) private view {
        if (
            !IHatsModule(hatsModule).isStewardOf(garden, msg.sender)
                && !IHatsModule(hatsModule).isOwnerOf(garden, msg.sender)
        ) revert ISettlementModule.NotSettlementSteward(msg.sender, garden);
    }
}
