// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementModule } from "../../src/modules/SettlementModule.sol";

interface ISettlementCcipReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

contract SettlementPayerMockRouter {
    uint256 public fee;
    uint256 public nonce;
    uint64 public lastDestinationSelector;
    bytes public lastReceiver;
    bytes public lastData;
    bytes32 public lastMessageId;

    function setFee(uint256 fee_) external {
        fee = fee_;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        return fee;
    }

    function ccipSend(
        uint64 destinationSelector,
        Client.EVM2AnyMessage calldata message
    )
        external
        payable
        returns (bytes32 messageId)
    {
        require(msg.value == fee, "fee");
        lastDestinationSelector = destinationSelector;
        lastReceiver = message.receiver;
        lastData = message.data;
        messageId = keccak256(abi.encode(address(this), ++nonce));
        lastMessageId = messageId;
    }

    function deliver(
        address receiver,
        bytes32 messageId,
        uint64 sourceSelector,
        address sender,
        bytes calldata data
    )
        external
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        ISettlementCcipReceiver(receiver).ccipReceive(
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: sourceSelector,
                sender: abi.encode(sender),
                data: data,
                destTokenAmounts: noTokens
            })
        );
    }

    function tryDeliverWithReceiverGas(
        address receiver,
        bytes32 messageId,
        uint64 sourceSelector,
        address sender,
        bytes calldata data,
        uint256 receiverGasLimit
    )
        external
        returns (bool success, uint256 gasUsed, bytes memory returnData)
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: sourceSelector,
            sender: abi.encode(sender),
            data: data,
            destTokenAmounts: noTokens
        });
        uint256 gasBefore = gasleft();
        (success, returnData) = receiver.call{ gas: receiverGasLimit }(
            abi.encodeWithSelector(ISettlementCcipReceiver.ccipReceive.selector, message)
        );
        gasUsed = gasBefore - gasleft();
    }
}

contract SettlementPayerMockHats {
    mapping(address garden => mapping(address account => bool)) public stewards;
    mapping(address garden => mapping(address account => bool)) public members;

    function setSteward(address garden, address account, bool enabled) external {
        stewards[garden][account] = enabled;
    }

    function setMember(address garden, address account, bool enabled) external {
        members[garden][account] = enabled;
    }

    function isStewardOf(address garden, address account) external view returns (bool) {
        return stewards[garden][account];
    }

    function isOwnerOf(address garden, address account) external view returns (bool) {
        return stewards[garden][account];
    }

    function isGardenerOf(address garden, address account) external view returns (bool) {
        return members[garden][account];
    }

    function isEvaluatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isFunderOf(address, address) external pure returns (bool) {
        return false;
    }

    function isCommunityOf(address, address) external pure returns (bool) {
        return false;
    }
}

contract SettlementPayerMockPooling {
    error PoolingReadDisabled();

    mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment) private _commitments;
    mapping(uint256 poolId => ICommitmentPoolingModule.Pool) private _pools;
    mapping(uint256 commitmentId => mapping(address claimant => ICommitmentPoolingModule.PendingClaim claim)) private
        _pendingClaims;
    bytes32 public canonicalRecognitionHash;
    bool public commitmentReadsDisabled;

    function setCommitmentReadsDisabled(bool disabled) external {
        commitmentReadsDisabled = disabled;
    }

    function setCommitment(uint256 commitmentId, ICommitmentPoolingModule.Commitment memory commitment) external {
        ICommitmentPoolingModule.Commitment storage stored = _commitments[commitmentId];
        stored.poolId = commitment.poolId;
        stored.creator = commitment.creator;
        stored.counterparty = commitment.counterparty;
        stored.state = commitment.state;
        stored.direction = commitment.direction;
        stored.claimType = commitment.claimType;
        stored.claimMode = commitment.claimMode;
        stored.counterpartyKind = commitment.counterpartyKind;
        stored.providerGarden = commitment.providerGarden;
        stored.payerGarden = commitment.payerGarden;
        stored.consideration = commitment.consideration;
    }

    function setPendingClaim(
        uint256 commitmentId,
        address claimant,
        ICommitmentPoolingModule.PendingClaim memory claim
    )
        external
    {
        _pendingClaims[commitmentId][claimant] = claim;
    }

    function setPool(uint256 poolId, ICommitmentPoolingModule.Pool memory pool) external {
        _pools[poolId] = pool;
    }

    function setCanonicalRecognitionHash(bytes32 hash) external {
        canonicalRecognitionHash = hash;
    }

    function getCommitment(uint256 commitmentId) external view returns (ICommitmentPoolingModule.Commitment memory) {
        if (commitmentReadsDisabled) revert PoolingReadDisabled();
        return _commitments[commitmentId];
    }

    function getPool(uint256 poolId) external view returns (ICommitmentPoolingModule.Pool memory) {
        return _pools[poolId];
    }

    function getPendingClaim(
        uint256 commitmentId,
        address claimant
    )
        external
        view
        returns (ICommitmentPoolingModule.PendingClaim memory)
    {
        return _pendingClaims[commitmentId][claimant];
    }

    function validateRecognitionSnapshot(
        uint256,
        ICommitmentPoolingModule.RecognitionEntry[] calldata,
        bytes32 suppliedHash
    )
        external
        view
        returns (bytes32)
    {
        if (suppliedHash != canonicalRecognitionHash) return canonicalRecognitionHash;
        return suppliedHash;
    }
}

contract SettlementPayerTest is Test {
    uint64 internal constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant CELO_CHAIN_ID = 42_220;
    address internal constant OWNER = address(0xA11CE);
    address internal constant PROTOCOL_GARDEN = address(0x1000);
    address internal constant PROVIDER_GARDEN = address(0x2000);
    address internal constant PAYER_SAFE = address(0x3000);
    address internal constant BENEFICIARY_SAFE = address(0x4000);
    address internal constant GDOLLAR = address(0x5000);

    SettlementPayerMockRouter internal router;
    SettlementPayerMockHats internal hats;
    SettlementPayerMockPooling internal pooling;
    SettlementModule internal settlementImplementation;
    ISettlementModule internal settlement;

    function setUp() public virtual {
        router = new SettlementPayerMockRouter();
        hats = new SettlementPayerMockHats();
        pooling = new SettlementPayerMockPooling();

        settlementImplementation = new SettlementModule(address(router), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        settlement = ISettlementModule(
            address(
                new ERC1967Proxy(
                    address(settlementImplementation),
                    abi.encodeWithSelector(
                        ISettlementModule.initialize.selector,
                        OWNER,
                        address(hats),
                        address(pooling),
                        PROTOCOL_GARDEN,
                        GDOLLAR
                    )
                )
            )
        );

        hats.setSteward(PROTOCOL_GARDEN, OWNER, true);
        hats.setSteward(PROVIDER_GARDEN, OWNER, true);
        vm.deal(OWNER, 1);
        vm.startPrank(OWNER);
        settlement.registerSettlementAccount(
            PROTOCOL_GARDEN,
            CELO_CHAIN_ID,
            PAYER_SAFE,
            _owners(0x10),
            address(0x6000),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3))
        );
        settlement.registerSettlementAccount(
            PROVIDER_GARDEN,
            CELO_CHAIN_ID,
            BENEFICIARY_SAFE,
            _owners(0x20),
            address(0x7000),
            bytes32(uint256(4)),
            bytes32(uint256(5)),
            bytes32(uint256(6))
        );
        settlement.setCcipRoute(1, address(0x8000), 500_000, 1, 0);
        settlement.setFeeReserveMinimum(1);
        settlement.fundFees{ value: 1 }();
        settlement.setPaused(false);
        vm.stopPrank();
    }

    function testGardenRequestCreatesImmutableBeneficiaryShape() public {
        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));

        vm.prank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));

        ISettlementModule.CommitmentPayoutPlan memory plan = settlement.getPayoutPlan(planId);
        assertEq(uint8(plan.payoutKind), uint8(ISettlementModule.DisbursementKind.GardenBeneficiary));
        assertEq(plan.payerGarden, PROTOCOL_GARDEN);
        assertEq(plan.providerGarden, PROVIDER_GARDEN);
        assertEq(plan.source, PAYER_SAFE);
        assertEq(plan.beneficiaryRecipient, BENEFICIARY_SAFE);
        assertEq(plan.beneficiaryAmount, 100 ether);
        assertEq(plan.payablePayoutCount, 1);
        assertEq(settlement.payoutContributors(planId).length, 0);
    }

    function testBeneficiaryPreparationIgnoresGardenerDeliveryButRechecksAccount() public {
        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));

        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 childId = settlement.prepareGardenBeneficiaryPayout(planId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory child = settlement.getDisbursement(childId);
        assertEq(uint8(child.kind), uint8(ISettlementModule.DisbursementKind.GardenBeneficiary));
        assertEq(child.recipient, BENEFICIARY_SAFE);
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Pending));

        vm.startPrank(OWNER);
        settlement.setAccountActive(PROVIDER_GARDEN, false);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.SettlementAccountInactive.selector, PROVIDER_GARDEN));
        settlement.dispatchDisbursement(childId);
        vm.stopPrank();
    }

    function testZeroPayerFailsBeforePlanState() public {
        pooling.setCommitment(9, _gardenRequest(address(0), PROVIDER_GARDEN));

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.InvalidPayerGarden.selector, 9));
        settlement.createCommitmentPayoutPlan(9, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        assertEq(settlement.payoutPlanOfCommitment(9), 0);
    }

    function testGardenRequestWithoutBeneficiarySettlementAccountFailsClosed() public {
        address unregisteredGarden = address(0xABCD);
        pooling.setCommitment(10, _gardenRequest(PROTOCOL_GARDEN, unregisteredGarden));

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.UnknownSettlementAccount.selector, unregisteredGarden));
        settlement.createCommitmentPayoutPlan(10, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        assertEq(settlement.payoutPlanOfCommitment(10), 0);
    }

    function testBackfilledGardenInternalBeneficiaryShapeFailsClosed() public {
        pooling.setCommitment(11, _gardenRequest(PROVIDER_GARDEN, PROVIDER_GARDEN));

        vm.prank(OWNER);
        vm.expectRevert(ISettlementModule.InvalidPayoutVector.selector);
        settlement.createCommitmentPayoutPlan(11, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        assertEq(settlement.payoutPlanOfCommitment(11), 0);
    }

    function _gardenRequest(
        address payer,
        address provider
    )
        internal
        pure
        returns (ICommitmentPoolingModule.Commitment memory commitment)
    {
        commitment.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        commitment.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        commitment.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        commitment.counterpartyKind = ICommitmentPoolingModule.ClaimType.Garden;
        commitment.providerGarden = provider;
        commitment.payerGarden = payer;
        commitment.consideration = ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.CeloSettlement,
            source: address(0),
            token: address(0),
            amount: 100 ether
        });
    }

    function _owners(uint160 base) internal pure returns (address[3] memory owners) {
        owners[0] = address(base + 1);
        owners[1] = address(base + 2);
        owners[2] = address(base + 3);
    }
}
