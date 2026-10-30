// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { CommitmentRegistry } from "../../src/registries/Commitment.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { CLCPurchaseFixture } from "./CLCPurchaseFixture.sol";
import {
    ICLCPurchasePool,
    ICLCPurchaseIndex,
    ICLCPurchaseLimiter,
    ICLCPurchaseQuoter,
    ICLCPurchaseFeePolicy,
    ICLCPurchaseProtocolFee
} from "./CLCPurchaseInterfaces.sol";
import { VoucherRedemptionRouter } from "./VoucherRedemptionFixture.sol";

interface IJourneySafeFactory {
    function createProxyWithNonce(address singleton, bytes calldata initializer, uint256 salt) external returns (address);
}

interface IJourneySafe {
    function VERSION() external view returns (string memory);
    function nonce() external view returns (uint256);
    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
    function getTransactionHash(
        address,
        uint256,
        bytes calldata,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address,
        uint256
    )
        external
        view
        returns (bytes32);
    function execTransaction(
        address,
        uint256,
        bytes calldata,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes calldata
    )
        external
        payable
        returns (bool);
}

// The repository's older forge-std interface omits these current Foundry JSON cheatcodes.
interface IJourneyJsonVm {
    function parseJsonKeys(string calldata json, string calldata path) external pure returns (string[] memory);
    function parseJsonString(string calldata json, string calldata path) external pure returns (string memory);
    function keyExistsJson(string calldata json, string calldata path) external view returns (bool);
}

/// @dev Explicit synthetic eligibility policy. Role balances and administration use published Hats core.
contract JourneyEligibility {
    function getHatStatus(uint256) external pure returns (bool) {
        return true;
    }

    function getWearerStatus(address, uint256) external pure returns (bool, bool) {
        return (true, true);
    }
}

/// @notice Two real forks, published CLC/Hats/Safe code, and production-artifact Green Goods contracts.
/// @dev All Safe ECDSA keys, members, gardens, evidence and service terms are synthetic. Mock routers
///      manually carry captured bytes between forks; this proves neither live CCIP nor member signing
///      nor real service delivery/capacity. The production JSON loader links libraries and checks the
///      runtime with declared immutables masked; constructor/router/chain bindings are checked separately.
abstract contract CLCVoucherJourneyFixture is CLCPurchaseFixture {
    uint256 internal constant JOURNEY_ARBITRUM_BLOCK = 517_654_615;
    uint64 internal constant JOURNEY_ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant JOURNEY_GNOSIS_SELECTOR = 465_200_170_687_744_372;
    uint256 internal constant JOURNEY_SUPPLY = 20e6;
    uint256 internal constant JOURNEY_INVENTORY = 10e6;
    uint256 internal constant JOURNEY_REWARD = 1e6;
    uint256 internal constant JOURNEY_ADAPTER_ALLOWANCE = 10e6;
    address internal constant JOURNEY_HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address internal constant JOURNEY_SAFE_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address internal constant JOURNEY_SAFE_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    bytes32 internal constant JOURNEY_SERVICE_TERMS =
        keccak256("FICTIONAL one booked 60-minute session; not issuer-confirmed");
    bytes32 internal constant JOURNEY_REMEDY_TERMS = keccak256("FICTIONAL mutually authorized partial delivery and return");
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    struct ArtifactRange {
        uint256 length;
        uint256 start;
    }

    struct JourneySafeKeys {
        uint256 first;
        uint256 second;
    }

    uint256 internal journeyArbitrumFork;
    uint256 internal journeyGnosisFork;
    address internal journeyIssuerA;
    address internal journeyIssuerB;
    address internal journeyCommunity;
    address internal journeyMember;
    address internal journeyCreator;
    address internal journeyGuardian;
    address internal journeyProviderGarden;
    address internal journeyBuyerGarden;
    HatsModule internal journeyHats;
    Core internal journeyCore;
    Services internal journeyServices;
    VoucherEntitlementModule internal journeyEarned;
    GnosisVoucherAdapter internal journeyAdapter;
    VoucherRedemptionModule internal journeySource;
    GnosisVoucherEscrow internal journeyEscrow;
    VoucherRedemptionRouter internal journeyArbitrumRouter;
    VoucherRedemptionRouter internal journeyGnosisRouter;
    ICLCGiftableToken internal journeyA;
    ICLCGiftableToken internal journeyB;
    PoolBundle internal journeyPool;
    uint256 internal journeyPoolId;
    uint256 internal journeyRequestId;
    uint256 internal journeyServiceId;
    bytes32 internal journeyEntitlement;
    bytes32 internal journeyClaimHash;
    bytes32 internal journeySetupId;
    bytes32 internal journeyAuthorizationHash;
    mapping(address safe => JourneySafeKeys keys) private journeySafeKeys;
    mapping(bytes32 libraryIdentity => address deployed) private journeyLibraries;

    function _setUpJourney() internal {
        journeyMember = makeAddr("synthetic-named-pilot-member");
        journeyCreator = makeAddr("synthetic-pilot-request-creator-and-service-steward");
        journeyGuardian = makeAddr("synthetic-pause-only-guardian");
        journeyProviderGarden = makeAddr("synthetic-provider-garden");
        journeyBuyerGarden = makeAddr("synthetic-buyer-garden");
        _selectGnosisForkAndCheckImplementations();
        journeyGnosisFork = vm.activeFork();
        _checkSafeDependencies();
        journeyIssuerA = _journeySafe(0xA110, 0xA111, 101);
        journeyIssuerB = _journeySafe(0xB110, 0xB111, 102);
        journeyCommunity = _journeySafe(0xC110, 0xC111, 103);
        _setUpJourneyCLC();
        journeyGnosisRouter = new VoucherRedemptionRouter();

        string memory rpc = "https://arb1.arbitrum.io/rpc";
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory configured) {
            rpc = configured;
        } catch { }
        uint256 pin = JOURNEY_ARBITRUM_BLOCK;
        try vm.envUint("VOUCHER_JOURNEY_ARBITRUM_BLOCK") returns (uint256 configured) {
            pin = configured;
        } catch { }
        journeyArbitrumFork = vm.createSelectFork(rpc, pin);
        assertEq(block.chainid, 42_161);
        // Arbitrum's BLOCKNUMBER opcode reports the L1 number. createSelectFork binds the L2
        // height; the rehearsal record separately retains that RPC block's hash.
        assertEq(JOURNEY_HATS.codehash, 0x91b24bc822401959192fd43e8795e2c6e23db03cd375588ea4585417902f87b2);
        _checkSafeDependencies();
        // Identical recipes deploy the same synthetic governing addresses on both real forks.
        assertEq(_journeySafe(0xA110, 0xA111, 101), journeyIssuerA);
        assertEq(_journeySafe(0xB110, 0xB111, 102), journeyIssuerB);
        assertEq(_journeySafe(0xC110, 0xC111, 103), journeyCommunity);
        _setUpJourneyCore();
        journeyArbitrumRouter = new VoucherRedemptionRouter();
        journeyEarned = VoucherEntitlementModule(
            payable(_productionProxy(
                    "src/modules/VoucherEntitlementModule.sol",
                    "VoucherEntitlementModule",
                    abi.encode(address(journeyArbitrumRouter)),
                    ""
                ))
        );
        journeySource = VoucherRedemptionModule(
            payable(_productionProxy(
                    "src/modules/VoucherRedemptionModule.sol",
                    "VoucherRedemptionModule",
                    abi.encode(address(journeyArbitrumRouter)),
                    ""
                ))
        );
        vm.selectFork(journeyGnosisFork);
        journeyAdapter = GnosisVoucherAdapter(
            payable(_productionProxy(
                    "src/modules/GnosisVoucherAdapter.sol",
                    "GnosisVoucherAdapter",
                    abi.encode(address(journeyGnosisRouter)),
                    abi.encodeCall(
                        GnosisVoucherAdapter.initialize,
                        (
                            journeyCommunity,
                            journeyGuardian,
                            JOURNEY_ARBITRUM_SELECTOR,
                            uint256(42_161),
                            address(journeyEarned)
                        )
                    )
                ))
        );
        journeyEscrow = GnosisVoucherEscrow(
            payable(_productionProxy(
                    "src/modules/GnosisVoucherEscrow.sol",
                    "GnosisVoucherEscrow",
                    abi.encode(address(journeyGnosisRouter)),
                    abi.encodeCall(
                        GnosisVoucherEscrow.initialize,
                        (
                            journeyCommunity,
                            journeyGuardian,
                            JOURNEY_ARBITRUM_SELECTOR,
                            uint256(42_161),
                            address(journeySource)
                        )
                    )
                ))
        );
        _safeExec(
            journeyIssuerA,
            address(journeyAdapter),
            abi.encodeCall(GnosisVoucherAdapter.configureAsset, (address(journeyA), journeyIssuerA, true))
        );
        _safeExec(journeyCommunity, address(journeyAdapter), abi.encodeCall(VoucherEndpoint.unpause, ()));
        _safeExec(journeyCommunity, address(journeyEscrow), abi.encodeCall(VoucherEndpoint.unpause, ()));
        _checkEndpoint(journeyAdapter, address(journeyGnosisRouter), 100);
        _checkEndpoint(journeyEscrow, address(journeyGnosisRouter), 100);
        vm.selectFork(journeyArbitrumFork);
        journeyEarned.initialize(
            journeyCommunity,
            journeyGuardian,
            JOURNEY_GNOSIS_SELECTOR,
            100,
            address(journeyAdapter),
            address(journeyCore),
            address(journeyHats)
        );
        journeySource.initialize(
            journeyCommunity, journeyGuardian, JOURNEY_GNOSIS_SELECTOR, 100, address(journeyEscrow), address(journeyCore)
        );
        _safeExec(
            journeyCommunity,
            address(journeyEarned),
            abi.encodeCall(VoucherEntitlementModule.setIssuerAuthority, (journeyIssuerA, address(journeyA), journeyIssuerA))
        );
        _safeExec(
            journeyCommunity, address(journeyEarned), abi.encodeCall(VoucherEntitlementModule.setFeeReserveMinimum, (1))
        );
        vm.deal(address(journeyEarned), 1);
        _safeExec(journeyCommunity, address(journeyEarned), abi.encodeCall(VoucherEndpoint.unpause, ()));
        _safeExec(journeyCommunity, address(journeySource), abi.encodeCall(VoucherEndpoint.unpause, ()));
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setPaused, (true)));
        _safeExec(
            journeyCommunity,
            address(journeyCore),
            abi.encodeCall(Acceptance.pinEarnedVoucherModule, (address(journeyEarned)))
        );
        _safeExec(
            journeyCommunity,
            address(journeyCore),
            abi.encodeCall(Acceptance.pinVoucherServiceSetupModule, (address(journeySource)))
        );
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setPaused, (false)));
        _checkEndpoint(journeyEarned, address(journeyArbitrumRouter), 42_161);
        _checkEndpoint(journeySource, address(journeyArbitrumRouter), 42_161);
    }

    function _setUpJourneyCLC() private {
        journeyA = _journeyVoucher(journeyIssuerA, "Synthetic Green Goods Voucher", "JGGV");
        journeyB = _journeyVoucher(journeyIssuerB, "Synthetic Partner Voucher", "JTSV");
        address admin = _journeyTimelock(journeyCommunity);
        journeyPool.index = ICLCPurchaseIndex(
            _clcProxy(
                INDEX_IMPLEMENTATION,
                admin,
                abi.encodeCall(ICLCPurchaseIndex.initialize, (journeyCommunity, new address[](0), new bytes32[](0)))
            )
        );
        journeyPool.limiter = ICLCPurchaseLimiter(
            _clcProxy(LIMITER_IMPLEMENTATION, admin, abi.encodeCall(ICLCPurchaseLimiter.initialize, (journeyCommunity)))
        );
        journeyPool.quoter = ICLCPurchaseQuoter(
            _clcProxy(QUOTER_IMPLEMENTATION, admin, abi.encodeCall(ICLCPurchaseQuoter.initialize, (journeyCommunity)))
        );
        journeyPool.feePolicy = ICLCPurchaseFeePolicy(
            _clcProxy(
                FEE_IMPLEMENTATION, admin, abi.encodeCall(ICLCPurchaseFeePolicy.initialize, (journeyCommunity, uint256(0)))
            )
        );
        journeyPool.protocolFee = ICLCPurchaseProtocolFee(
            _clcProxy(
                PROTOCOL_FEE_IMPLEMENTATION,
                admin,
                abi.encodeCall(ICLCPurchaseProtocolFee.initialize, (journeyCommunity, uint256(0), journeyCommunity))
            )
        );
        journeyPool.pool = ICLCPurchasePool(
            _clcProxy(
                POOL_IMPLEMENTATION,
                admin,
                abi.encodeCall(
                    ICLCPurchasePool.initialize,
                    (
                        "Synthetic final-candidate exchange",
                        "JPOOL",
                        uint8(6),
                        journeyCommunity,
                        address(journeyPool.feePolicy),
                        journeyCommunity,
                        address(journeyPool.index),
                        address(journeyPool.limiter),
                        address(journeyPool.quoter),
                        true,
                        address(journeyPool.protocolFee)
                    )
                )
            )
        );
        ICLCGiftableToken[2] memory tokens = [journeyA, journeyB];
        address[2] memory issuers = [journeyIssuerA, journeyIssuerB];
        for (uint256 i; i < 2; ++i) {
            _safeExec(
                journeyCommunity,
                address(journeyPool.index),
                abi.encodeCall(ICLCPurchaseIndex.register, (address(tokens[i])))
            );
            _safeExec(
                journeyCommunity,
                address(journeyPool.limiter),
                abi.encodeCall(
                    ICLCPurchaseLimiter.setLimitFor, (address(tokens[i]), address(journeyPool.pool), JOURNEY_SUPPLY)
                )
            );
            _safeExec(
                journeyCommunity,
                address(journeyPool.quoter),
                abi.encodeCall(ICLCPurchaseQuoter.setPriceIndexValue, (address(tokens[i]), uint256(1_000_000)))
            );
            _safeExec(
                issuers[i], address(tokens[i]), abi.encodeCall(ICLCGiftableToken.mintTo, (issuers[i], JOURNEY_SUPPLY))
            );
            _safeExec(
                issuers[i],
                address(tokens[i]),
                abi.encodeWithSignature("approve(address,uint256)", address(journeyPool.pool), JOURNEY_INVENTORY)
            );
            _safeExec(
                issuers[i],
                address(journeyPool.pool),
                abi.encodeCall(ICLCPurchasePool.deposit, (address(tokens[i]), JOURNEY_INVENTORY))
            );
            assertEq(tokens[i].allowance(issuers[i], address(journeyPool.pool)), 0);
        }
        _safeExec(journeyCommunity, address(journeyPool.pool), abi.encodeCall(ICLCPurchasePool.seal, (uint8(31))));
    }

    function _journeyVoucher(address issuer, string memory name, string memory symbol) private returns (ICLCGiftableToken) {
        return ICLCGiftableToken(
            _clcProxy(
                GIFTABLE_IMPLEMENTATION,
                _journeyTimelock(issuer),
                abi.encodeCall(ICLCGiftableToken.initialize, (name, symbol, uint8(6), issuer, uint256(0)))
            )
        );
    }

    function _clcProxy(address implementation, address admin, bytes memory initializer) private returns (address) {
        return ICLCERC1967Factory(CLC_FACTORY).deployAndCall(implementation, admin, initializer);
    }

    function _journeyTimelock(address owner) private returns (address) {
        address[] memory governors = new address[](1);
        governors[0] = owner;
        address timelock = _productionDeploy(
            "lib/tokenbound/lib/openzeppelin-contracts/contracts/governance/TimelockController.sol",
            "TimelockController",
            abi.encode(uint256(0), governors, governors, address(0))
        );
        assertEq(TimelockController(payable(timelock)).getMinDelay(), 0);
        return timelock;
    }

    function _setUpJourneyCore() private {
        journeyHats = HatsModule(
            _productionProxy(
                "src/modules/Hats.sol",
                "HatsModule",
                "",
                abi.encodeCall(HatsModule.initialize, (journeyCommunity, JOURNEY_HATS))
            )
        );
        JourneyEligibility eligibility = new JourneyEligibility();
        uint256 top = IHats(JOURNEY_HATS).mintTopHat(address(this), "Synthetic voucher rehearsal", "");
        uint256[6] memory roles;
        for (uint256 i; i < roles.length; ++i) {
            roles[i] = IHats(JOURNEY_HATS)
                .createHat(top, "Synthetic role", 100, address(eligibility), address(eligibility), true, "");
        }
        IHats(JOURNEY_HATS).mintHat(roles[1], journeyCreator);
        IHats(JOURNEY_HATS).mintHat(roles[3], journeyMember);
        IHats(JOURNEY_HATS).mintHat(roles[3], journeyCreator);
        _safeExec(
            journeyCommunity,
            address(journeyHats),
            abi.encodeCall(
                HatsModule.configureGarden,
                (journeyProviderGarden, roles[0], roles[1], roles[2], roles[3], roles[4], roles[5])
            )
        );
        _safeExec(
            journeyCommunity,
            address(journeyHats),
            abi.encodeCall(
                HatsModule.configureGarden, (journeyBuyerGarden, roles[0], roles[1], roles[2], roles[3], roles[4], roles[5])
            )
        );
        assertTrue(journeyHats.isStewardOf(journeyProviderGarden, journeyCreator));
        assertTrue(journeyHats.isGardenerOf(journeyBuyerGarden, journeyMember));
        assertTrue(IHats(JOURNEY_HATS).isWearerOfHat(journeyMember, roles[3]));
        assertFalse(journeyHats.isGardenerOf(journeyBuyerGarden, address(0xBAD)));

        journeyCore = Core(
            _productionProxy(
                "src/modules/CommitmentPooling.sol",
                "CommitmentPoolingModule",
                "",
                abi.encodeCall(Core.initialize, (journeyCommunity, journeyProviderGarden))
            )
        );
        address registry = _productionProxy(
            "src/registries/Commitment.sol",
            "CommitmentRegistry",
            "",
            abi.encodeCall(CommitmentRegistry.initialize, (journeyCommunity, address(journeyCore)))
        );
        address actions = _productionProxy(
            "src/registries/Action.sol", "ActionRegistry", "", abi.encodeCall(ActionRegistry.initialize, (journeyCommunity))
        );
        // The individual evidence/confirmation route never calls these existing attestation
        // dependencies. Wire their public deployment identities to satisfy the core's readiness
        // guard; no EAS approval or real garden membership is fabricated by this rehearsal.
        string memory deployment = vm.readFile(string.concat(vm.projectRoot(), "/deployments/42161-latest.json"));
        address gardenToken = abi.decode(vm.parseJson(deployment, ".gardenToken"), (address));
        address eas = abi.decode(vm.parseJson(deployment, ".eas.address"), (address));
        address workApproval = abi.decode(vm.parseJson(deployment, ".workApprovalResolver"), (address));
        assertGt(gardenToken.code.length, 0);
        assertGt(eas.code.length, 0);
        assertGt(workApproval.code.length, 0);
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setGardenToken, (gardenToken)));
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setHatsModule, (address(journeyHats))));
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setActionRegistry, (actions)));
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setEAS, (eas)));
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setWorkApprovalResolver, (workApproval)));
        _safeExec(
            journeyCommunity,
            address(journeyCore),
            abi.encodeCall(
                Core.setSchemaUIDs,
                (
                    abi.decode(vm.parseJson(deployment, ".schemas.workSchemaUID"), (bytes32)),
                    abi.decode(vm.parseJson(deployment, ".schemas.workApprovalSchemaUID"), (bytes32)),
                    abi.decode(vm.parseJson(deployment, ".schemas.assessmentSchemaUID"), (bytes32)),
                    abi.decode(vm.parseJson(deployment, ".schemas.assessmentV3SchemaUID"), (bytes32))
                )
            )
        );
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setCommitmentRegistry, (registry)));
        _safeExec(journeyCommunity, address(journeyCore), abi.encodeCall(Core.setPaused, (false)));
        vm.prank(journeyCreator);
        journeyPoolId = journeyCore.registerPool(journeyProviderGarden, Core.PoolType.Garden);
        vm.prank(journeyCreator);
        journeyCore.setProviderOpenCommitmentCap(journeyPoolId, 128);
        vm.prank(journeyCreator);
        journeyCore.setPoolCharter(journeyPoolId, "synthetic-final-candidate-charter");
        vm.prank(journeyCreator);
        journeyCore.markPoolReady(journeyPoolId);
        vm.prank(journeyCreator);
        journeyCore.openPool(journeyPoolId);
        vm.prank(journeyCreator);
        journeyCore.registerPool(journeyBuyerGarden, Core.PoolType.Garden);
        journeyServices = Services(address(journeyCore));
    }

    function _prepareJourneyReward() internal {
        vm.selectFork(journeyArbitrumFork);
        vm.prank(journeyCreator);
        journeyRequestId = journeyCore.createCommitment(_journeyParams(true));
        bytes32 recognitionPolicy = journeyEarned.RECOGNITION_POLICY();
        vm.prank(journeyCreator);
        journeyEarned.registerTerms(
            journeyRequestId,
            VoucherEntitlementModule.TermsInput(
                journeyIssuerA,
                journeyIssuerA,
                address(journeyA),
                JOURNEY_REWARD,
                recognitionPolicy,
                JOURNEY_SERVICE_TERMS,
                0
            )
        );
        _safeExec(
            journeyIssuerA,
            address(journeyEarned),
            abi.encodeCall(VoucherEntitlementModule.approveTerms, (journeyRequestId, uint64(1)))
        );
        vm.prank(journeyCreator);
        journeyEarned.consentTerms(journeyRequestId, 1);
        vm.startPrank(journeyMember);
        journeyEarned.consentTerms(journeyRequestId, 1);
        journeyCore.claimCommitment(journeyRequestId, Core.ClaimType.Individual, journeyProviderGarden);
        address[] memory contributors = new address[](1);
        contributors[0] = journeyMember;
        journeyCore.attachEvidence(journeyRequestId, "synthetic-member-reviewed-request-evidence", contributors);
        vm.stopPrank();
        vm.prank(journeyCreator);
        journeyCore.markReadyForConfirmation(journeyRequestId, "synthetic steward verification");
        vm.prank(journeyCreator);
        journeyCore.confirmFulfillment(journeyRequestId);
        Core.RecognitionEntry[] memory entries = new Core.RecognitionEntry[](1);
        entries[0] = Core.RecognitionEntry(journeyMember, 10_000);
        vm.prank(journeyCreator);
        journeyEntitlement = journeyEarned.prepareDistribution(
            journeyRequestId, entries, keccak256(abi.encode(block.chainid, journeyRequestId, entries))
        );
    }

    function _exerciseJourneyZeroDelayUpgrade() internal {
        vm.selectFork(journeyGnosisFork);
        address admin = ICLCERC1967Factory(CLC_FACTORY).adminOf(address(journeyA));
        TimelockController timelock = TimelockController(payable(admin));
        bytes memory action =
            abi.encodeWithSignature("upgrade(address,address)", address(journeyA), GIFTABLE_IMPLEMENTATION);
        bytes32 salt = keccak256("synthetic-same-implementation-control-proof");
        bytes32 operation = timelock.hashOperation(CLC_FACTORY, 0, action, bytes32(0), salt);
        uint256 timestamp = block.timestamp;
        bytes32 proxyCode = address(journeyA).codehash;
        (bool unauthorized,) = CLC_FACTORY.call(action);
        assertFalse(unauthorized, "unrelated caller cannot bypass proxy admin");
        vm.expectRevert();
        timelock.schedule(CLC_FACTORY, 0, action, bytes32(0), salt, 0);
        _safeExec(
            journeyIssuerA,
            admin,
            abi.encodeCall(TimelockController.schedule, (CLC_FACTORY, uint256(0), action, bytes32(0), salt, uint256(0)))
        );
        assertTrue(timelock.isOperationReady(operation));
        vm.expectRevert();
        timelock.execute(CLC_FACTORY, 0, action, bytes32(0), salt);
        _safeExec(
            journeyIssuerA,
            admin,
            abi.encodeCall(TimelockController.execute, (CLC_FACTORY, uint256(0), action, bytes32(0), salt))
        );
        assertEq(block.timestamp, timestamp, "zero-delay schedule and execution need no time advancement");
        assertTrue(timelock.isOperationDone(operation));
        assertEq(ICLCERC1967Factory(CLC_FACTORY).adminOf(address(journeyA)), admin);
        assertEq(address(journeyA).codehash, proxyCode);
        assertEq(journeyA.owner(), journeyIssuerA);
        assertEq(journeyA.totalSupply(), JOURNEY_SUPPLY);
        assertEq(journeyA.balanceOf(journeyIssuerA), JOURNEY_INVENTORY);
        assertEq(journeyA.balanceOf(address(journeyPool.pool)), JOURNEY_INVENTORY);
        assertEq(journeyA.allowance(journeyIssuerA, address(journeyPool.pool)), 0);
        assertFalse(journeyA.isWriter(journeyCommunity));
    }

    function _dispatchJourneyReward() internal {
        vm.selectFork(journeyArbitrumFork);
        vm.prank(journeyCreator);
        bytes32 id = journeyEarned.dispatch(journeyEntitlement);
        bytes memory data = journeyArbitrumRouter.lastData();
        vm.selectFork(journeyGnosisFork);
        journeyGnosisRouter.deliver(
            address(journeyAdapter), _journeyMessage(id, JOURNEY_ARBITRUM_SELECTOR, address(journeyEarned), data)
        );
    }

    function _relayJourneyReward() internal {
        vm.selectFork(journeyGnosisFork);
        bytes memory data = journeyGnosisRouter.lastData();
        bytes32 id = journeyGnosisRouter.lastMessageId();
        vm.selectFork(journeyArbitrumFork);
        journeyArbitrumRouter.deliver(
            address(journeyEarned), _journeyMessage(id, JOURNEY_GNOSIS_SELECTOR, address(journeyAdapter), data)
        );
    }

    function _prepareJourneyService() internal {
        vm.selectFork(journeyArbitrumFork);
        vm.prank(journeyCreator);
        journeyServiceId = journeyCore.createCommitment(_journeyParams(false));
        vm.prank(journeyCreator);
        journeyServices.setServiceOfferTerms(
            journeyServiceId,
            0,
            Services.ServiceOfferTermsInput(
                Services.ServicePaymentRoute.Voucher,
                JOURNEY_SERVICE_TERMS,
                JOURNEY_REMEDY_TERMS,
                100,
                journeyIssuerB,
                address(journeyB),
                JOURNEY_REWARD
            ),
            0
        );
        Services.ServiceOfferTerms memory terms = journeyServices.getServiceOfferTerms(journeyServiceId);
        vm.prank(journeyMember);
        journeyClaimHash = journeyServices.requestServiceClaim(
            journeyServiceId, Services.ServiceClaimRequest(journeyBuyerGarden, journeyMember, 1, 1, terms.termsHash)
        );
        vm.prank(journeyMember);
        journeySetupId = journeySource.prepareVoucherSetup(
            journeyServiceId, 1, terms.termsHash, journeyClaimHash, 1, uint64(block.timestamp + 1 days)
        );
        journeyAuthorizationHash = Codec.hash(journeySource.getSetupAuthorization(journeySetupId));
        _dispatchJourneySetup(0);
    }

    function _dispatchJourneySetup(uint8 kind) internal {
        vm.selectFork(journeyArbitrumFork);
        bytes32 id = journeySource.dispatchSetupCommand(journeySetupId, kind);
        bytes memory data = journeyArbitrumRouter.lastData();
        vm.selectFork(journeyGnosisFork);
        journeyGnosisRouter.deliver(
            address(journeyEscrow), _journeyMessage(id, JOURNEY_ARBITRUM_SELECTOR, address(journeySource), data)
        );
    }

    function _relayJourneySetup() internal {
        vm.selectFork(journeyGnosisFork);
        bytes memory data = journeyGnosisRouter.lastData();
        bytes32 id = journeyGnosisRouter.lastMessageId();
        vm.selectFork(journeyArbitrumFork);
        journeyArbitrumRouter.deliver(
            address(journeySource), _journeyMessage(id, JOURNEY_GNOSIS_SELECTOR, address(journeyEscrow), data)
        );
    }

    function _journeyParams(bool request) private view returns (Core.CreateCommitmentParams memory p) {
        p.poolId = journeyPoolId;
        p.creationRequestKey = keccak256(abi.encode("synthetic-connected-final-candidate", request));
        p.direction = request ? Core.CommitmentDirection.Request : Core.CommitmentDirection.Offer;
        p.commitmentType = Core.CommitmentType.SupportService;
        p.claimType = Core.ClaimType.Individual;
        p.claimMode = request ? Core.ClaimMode.Open : Core.ClaimMode.ApprovalGated;
        p.contributorPolicy = Core.ContributorPolicy.LeadManaged;
        p.targetUnits = request ? 1 : 60;
        p.unitLabel = request ? "reviewed synthetic contribution" : "minutes of a fictional booked session";
        p.metadataCID = "synthetic-rehearsal-only; no real terms or capacity confirmed";
    }

    function _journeyMessage(
        bytes32 id,
        uint64 selector,
        address peer,
        bytes memory data
    )
        internal
        pure
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage(id, selector, abi.encode(peer), data, new Client.EVMTokenAmount[](0));
    }

    function _checkEndpoint(VoucherEndpoint endpoint, address router, uint256 chain) private {
        assertEq(endpoint.CCIP_ROUTER(), router);
        assertEq(endpoint.getRouter(), router);
        assertEq(endpoint.LOCAL_CHAIN_ID(), chain);
        assertEq(endpoint.owner(), journeyCommunity);
        assertEq(endpoint.guardian(), journeyGuardian);
        assertEq(endpoint.UPGRADE_DELAY(), 0);
    }

    function _checkSafeDependencies() private {
        assertEq(JOURNEY_SAFE_SINGLETON.codehash, 0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff);
        assertEq(JOURNEY_SAFE_FACTORY.codehash, 0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317);
    }

    function _journeySafe(uint256 first, uint256 second, uint256 salt) private returns (address safe) {
        address[] memory owners = new address[](2);
        owners[0] = vm.addr(first);
        owners[1] = vm.addr(second);
        safe = IJourneySafeFactory(JOURNEY_SAFE_FACTORY)
            .createProxyWithNonce(
                JOURNEY_SAFE_SINGLETON,
                abi.encodeWithSignature(
                    "setup(address[],uint256,address,bytes,address,address,uint256,address)",
                    owners,
                    2,
                    address(0),
                    bytes(""),
                    address(0),
                    address(0),
                    0,
                    address(0)
                ),
                salt
            );
        journeySafeKeys[safe] = JourneySafeKeys(first, second);
        assertEq(IJourneySafe(safe).VERSION(), "1.4.1");
        assertEq(IJourneySafe(safe).getThreshold(), 2);
        assertEq(IJourneySafe(safe).getOwners().length, 2);
    }

    function _safeExec(address safe, address to, bytes memory data) internal {
        require(_safeCall(safe, to, data, false), "two synthetic Safe signatures must execute");
    }

    function _safeCall(address safe, address to, bytes memory data, bool onlyOneSigner) internal returns (bool) {
        JourneySafeKeys memory keys = journeySafeKeys[safe];
        bytes32 hash = IJourneySafe(safe)
            .getTransactionHash(to, 0, data, 0, 0, 0, 0, address(0), address(0), IJourneySafe(safe).nonce());
        bytes memory first = _journeySignature(keys.first, hash);
        bytes memory second = _journeySignature(keys.second, hash);
        bytes memory signatures = onlyOneSigner
            ? first
            : vm.addr(keys.first) < vm.addr(keys.second) ? bytes.concat(first, second) : bytes.concat(second, first);
        (bool ok, bytes memory result) = safe.call(
            abi.encodeCall(
                IJourneySafe.execTransaction, (to, 0, data, 0, 0, 0, 0, address(0), payable(address(0)), signatures)
            )
        );
        return ok && result.length == 32 && abi.decode(result, (bool));
    }

    function _journeySignature(uint256 key, bytes32 hash) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, hash);
        return abi.encodePacked(r, s, v);
    }

    function _productionProxy(
        string memory source,
        string memory name,
        bytes memory args,
        bytes memory initializer
    )
        private
        returns (address)
    {
        address implementation = _productionDeploy(source, name, args);
        (bool ok, bytes memory uuid) = implementation.staticcall(abi.encodeWithSignature("proxiableUUID()"));
        assertTrue(ok, "production UUPS implementation must expose its UUID");
        assertEq(abi.decode(uuid, (bytes32)), IMPLEMENTATION_SLOT);
        address proxy = _productionDeploy(
            "lib/tokenbound/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol",
            "ERC1967Proxy",
            abi.encode(implementation, initializer)
        );
        assertEq(address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT)))), implementation);
        return proxy;
    }

    function _productionDeploy(
        string memory source,
        string memory name,
        bytes memory args
    )
        private
        returns (address deployed)
    {
        string memory artifact = vm.readFile(
            string.concat(
                vm.projectRoot(), "/.generated/foundry/out/production/", _journeyBasename(source), "/", name, ".json"
            )
        );
        assertTrue(abi.decode(vm.parseJson(artifact, ".metadata.settings.viaIR"), (bool)));
        assertTrue(abi.decode(vm.parseJson(artifact, ".metadata.settings.optimizer.enabled"), (bool)));
        assertEq(abi.decode(vm.parseJson(artifact, ".metadata.settings.optimizer.runs"), (uint256)), 1);
        bytes memory creation = bytes.concat(_linkedProductionBytes(artifact, ".bytecode"), args);
        assembly ("memory-safe") { deployed := create(0, add(creation, 32), mload(creation)) }
        assertGt(deployed.code.length, 0, string.concat("production deployment failed: ", name));
        bytes memory actual = deployed.code;
        bytes memory expected = _linkedProductionBytes(artifact, ".deployedBytecode");
        string memory path = ".deployedBytecode.immutableReferences";
        string[] memory immutableIds = IJourneyJsonVm(address(vm)).keyExistsJson(artifact, path)
            ? IJourneyJsonVm(address(vm)).parseJsonKeys(artifact, path)
            : new string[](0);
        for (uint256 i; i < immutableIds.length; ++i) {
            ArtifactRange[] memory ranges =
                abi.decode(vm.parseJson(artifact, string.concat(path, '["', immutableIds[i], '"]')), (ArtifactRange[]));
            for (uint256 j; j < ranges.length; ++j) {
                for (uint256 k; k < ranges[j].length; ++k) {
                    actual[ranges[j].start + k] = 0;
                    expected[ranges[j].start + k] = 0;
                }
            }
        }
        assertEq(actual, expected, string.concat("production runtime differs outside declared immutables: ", name));
    }

    function _linkedProductionBytes(string memory artifact, string memory field) private returns (bytes memory) {
        bytes memory encoded = bytes(IJourneyJsonVm(address(vm)).parseJsonString(artifact, string.concat(field, ".object")));
        string memory base = string.concat(field, ".linkReferences");
        string[] memory sources = IJourneyJsonVm(address(vm)).parseJsonKeys(artifact, base);
        for (uint256 i; i < sources.length; ++i) {
            string memory sourcePath = string.concat(base, '["', sources[i], '"]');
            string[] memory names = IJourneyJsonVm(address(vm)).parseJsonKeys(artifact, sourcePath);
            for (uint256 j; j < names.length; ++j) {
                bytes32 identity = keccak256(abi.encode(vm.activeFork(), sources[i], names[j]));
                address libraryAddress = journeyLibraries[identity];
                if (libraryAddress == address(0)) {
                    libraryAddress = _productionDeploy(sources[i], names[j], "");
                    journeyLibraries[identity] = libraryAddress;
                }
                bytes memory addressText = bytes(vm.toString(libraryAddress));
                ArtifactRange[] memory ranges =
                    abi.decode(vm.parseJson(artifact, string.concat(sourcePath, '["', names[j], '"]')), (ArtifactRange[]));
                for (uint256 k; k < ranges.length; ++k) {
                    assertEq(ranges[k].length, 20);
                    for (uint256 n; n < 40; ++n) {
                        encoded[2 + ranges[k].start * 2 + n] = addressText[2 + n];
                    }
                }
            }
        }
        return vm.parseBytes(string(encoded));
    }

    function _journeyBasename(string memory source) private pure returns (string memory) {
        bytes memory s = bytes(source);
        uint256 start;
        for (uint256 i; i < s.length; ++i) {
            if (s[i] == "/") start = i + 1;
        }
        bytes memory result = new bytes(s.length - start);
        for (uint256 i; i < result.length; ++i) {
            result[i] = s[start + i];
        }
        return string(result);
    }
}
