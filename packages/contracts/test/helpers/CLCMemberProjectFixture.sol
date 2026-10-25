// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CLCVoucherJourneyFixture } from "./CLCVoucherJourneyFixture.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { ICLCPurchaseIndex, ICLCPurchaseLimiter, ICLCPurchaseQuoter } from "./CLCPurchaseInterfaces.sol";

/// @notice FICTIONAL TAS project and separately budgeted peer services on published dependencies.
/// @dev Three synthetic EOA senders are distinct; vm.prank is not real member/passkey signing.
///      Existing collective Safes execute with synthetic signatures. CCIP and service delivery are
///      simulated. Token supply, reserve, pool exposure and consumed service capacity are distinct.
abstract contract CLCMemberProjectFixture is CLCVoucherJourneyFixture {
    bytes32 internal constant MEMBER_PROJECT_BRIEF = keccak256("FICTIONAL TAS impact website shared brief");
    bytes32 internal constant ENGINEER_HELP_TERMS =
        keccak256("FICTIONAL one 60-minute standalone integration lesson; excludes TAS website implementation");
    bytes32 internal constant ANALYST_HELP_TERMS =
        keccak256("FICTIONAL one 60-minute general measurement coaching; excludes TAS metrics report");
    bytes32 internal constant MEMBER_REMEDY = keccak256("FICTIONAL exact delivered/refundable split; no reverse swap");
    uint256 internal constant MEMBER_SUPPLY = 6e6;
    uint256 internal constant MEMBER_POOL_STOCK = 2e6;
    uint256 internal constant MEMBER_REWARD = 1e6;

    struct ProjectMilestone {
        address participant;
        address issuer;
        address token;
        bytes32 voucherTerms;
        uint256 commitmentId;
        bytes32 entitlement;
    }

    address internal projectDesigner;
    address internal projectAnalyst;
    address internal projectEngineer;
    ICLCGiftableToken internal analystHelp;
    ICLCGiftableToken internal engineerHelp;
    ProjectMilestone[3] internal projectMilestones;

    function _setUpMemberProject() internal {
        _setUpJourney();
        projectDesigner = vm.addr(0xD351);
        projectAnalyst = vm.addr(0xA351);
        projectEngineer = vm.addr(0xE351);
        vm.selectFork(journeyArbitrumFork);
        (,,, uint256 gardenerHat,,,,) = journeyHats.getGardenHatIds(journeyProviderGarden);
        IHats(JOURNEY_HATS).mintHat(gardenerHat, projectDesigner);
        IHats(JOURNEY_HATS).mintHat(gardenerHat, projectAnalyst);
        IHats(JOURNEY_HATS).mintHat(gardenerHat, projectEngineer);
        vm.selectFork(journeyGnosisFork);
        analystHelp = _memberToken(projectAnalyst, "Fictional analyst coaching", "MACH");
        engineerHelp = _memberToken(projectEngineer, "Fictional engineer integration lesson", "MEIH");
        _admitMemberAsset(analystHelp, projectAnalyst, 1e6);
        _admitMemberAsset(engineerHelp, projectEngineer, 2e6);
        _configureProjectRewards();
        projectMilestones[0] =
            ProjectMilestone(projectDesigner, projectEngineer, address(engineerHelp), ENGINEER_HELP_TERMS, 0, 0);
        projectMilestones[1] = ProjectMilestone(
            projectAnalyst, journeyIssuerB, address(journeyB), keccak256("FICTIONAL TAS hub entitlement"), 0, 0
        );
        projectMilestones[2] = ProjectMilestone(
            projectEngineer,
            journeyIssuerA,
            address(journeyA),
            keccak256("FICTIONAL GG access unit; two units per assisted session"),
            0,
            0
        );
    }

    function _memberToken(
        address member,
        string memory name,
        string memory symbol
    )
        private
        returns (ICLCGiftableToken token)
    {
        token = ICLCGiftableToken(
            ICLCERC1967Factory(CLC_FACTORY)
                .deployAndCall(
                    GIFTABLE_IMPLEMENTATION,
                    member,
                    abi.encodeCall(ICLCGiftableToken.initialize, (name, symbol, uint8(6), member, uint256(0)))
                )
        );
        assertEq(token.owner(), member);
        assertEq(ICLCERC1967Factory(CLC_FACTORY).adminOf(address(token)), member);
        assertEq(token.totalSupply(), 0);
        assertFalse(token.isWriter(address(this)));
        assertFalse(token.isWriter(journeyCommunity));
    }

    function _admitMemberAsset(ICLCGiftableToken token, address member, uint256 price) private {
        _safeExec(
            journeyCommunity, address(journeyPool.index), abi.encodeCall(ICLCPurchaseIndex.register, (address(token)))
        );
        _safeExec(
            journeyCommunity,
            address(journeyPool.limiter),
            abi.encodeCall(ICLCPurchaseLimiter.setLimitFor, (address(token), address(journeyPool.pool), MEMBER_SUPPLY))
        );
        _safeExec(
            journeyCommunity,
            address(journeyPool.quoter),
            abi.encodeCall(ICLCPurchaseQuoter.setPriceIndexValue, (address(token), price))
        );
        vm.startPrank(member);
        token.mintTo(member, MEMBER_SUPPLY);
        token.approve(address(journeyPool.pool), MEMBER_POOL_STOCK);
        journeyPool.pool.deposit(address(token), MEMBER_POOL_STOCK);
        vm.stopPrank();
        assertEq(token.balanceOf(member), 4e6);
        assertEq(token.balanceOf(address(journeyPool.pool)), MEMBER_POOL_STOCK);
        assertEq(token.allowance(member, address(journeyPool.pool)), 0);
    }

    function _configureProjectRewards() private {
        // Collective and member source registration remains a governance-only paused batch.
        vm.selectFork(journeyArbitrumFork);
        bool previousPause = journeyEarned.paused();
        if (!previousPause) _safeExec(journeyCommunity, address(journeyEarned), abi.encodeCall(VoucherEndpoint.pause, ()));
        _safeExec(
            journeyCommunity,
            address(journeyEarned),
            abi.encodeCall(
                VoucherEntitlementModule.setIssuerAuthority, (projectEngineer, address(engineerHelp), projectEngineer)
            )
        );
        _safeExec(
            journeyCommunity,
            address(journeyEarned),
            abi.encodeCall(VoucherEntitlementModule.setIssuerAuthority, (journeyIssuerB, address(journeyB), journeyIssuerB))
        );
        if (!previousPause) {
            _safeExec(journeyCommunity, address(journeyEarned), abi.encodeCall(VoucherEndpoint.unpause, ()));
        }
        assertEq(journeyEarned.paused(), previousPause);
        vm.selectFork(journeyGnosisFork);
        vm.prank(projectEngineer);
        journeyAdapter.configureAsset(address(engineerHelp), projectEngineer, true);
        _safeExec(
            journeyIssuerB,
            address(journeyAdapter),
            abi.encodeCall(GnosisVoucherAdapter.configureAsset, (address(journeyB), journeyIssuerB, true))
        );
        _safeExec(
            journeyIssuerB,
            address(journeyB),
            abi.encodeWithSignature("approve(address,uint256)", address(journeyAdapter), MEMBER_REWARD)
        );
        _safeExec(
            journeyIssuerA,
            address(journeyA),
            abi.encodeWithSignature("approve(address,uint256)", address(journeyAdapter), MEMBER_REWARD)
        );
        // Member issuance and pool inventory are not earned rewards. Engineer grants no adapter
        // allowance until explicitly repairing the designer's approved, fulfilled project reward.
    }

    function _createProjectRequests() internal {
        vm.selectFork(journeyArbitrumFork);
        bytes32 recognitionPolicy = journeyEarned.RECOGNITION_POLICY();
        for (uint256 i; i < 3; ++i) {
            ProjectMilestone storage milestone = projectMilestones[i];
            Core.CreateCommitmentParams memory p = _projectParams(i);
            vm.prank(journeyCreator);
            milestone.commitmentId = journeyCore.createCommitment(p);
            vm.prank(journeyCreator);
            journeyEarned.registerTerms(
                milestone.commitmentId,
                VoucherEntitlementModule.TermsInput(
                    milestone.issuer,
                    milestone.issuer,
                    milestone.token,
                    MEMBER_REWARD,
                    recognitionPolicy,
                    milestone.voucherTerms,
                    0
                )
            );
        }
    }

    function _acceptProjectRequest(uint256 index) internal {
        ProjectMilestone storage milestone = projectMilestones[index];
        uint256 id = milestone.commitmentId;
        if (index == 0) {
            vm.prank(projectEngineer);
            journeyEarned.approveTerms(id, 1);
        } else {
            _safeExec(
                milestone.issuer,
                address(journeyEarned),
                abi.encodeCall(VoucherEntitlementModule.approveTerms, (id, uint64(1)))
            );
        }
        vm.prank(journeyCreator);
        journeyEarned.consentTerms(id, 1);
        vm.startPrank(milestone.participant);
        journeyEarned.consentTerms(id, 1);
        journeyCore.claimCommitment(id, Core.ClaimType.Individual, journeyProviderGarden);
        vm.stopPrank();
    }

    function _fulfillProjectRequest(uint256 index) internal {
        ProjectMilestone storage milestone = projectMilestones[index];
        address[] memory contributors = new address[](1);
        contributors[0] = milestone.participant;
        string[3] memory evidence = [
            "FICTIONAL reviewed TAS landing-page and impact-section design",
            "FICTIONAL validated metrics definitions sample data and impact summary",
            "FICTIONAL working TAS site using accepted design and data contract"
        ];
        vm.prank(milestone.participant);
        journeyCore.attachEvidence(milestone.commitmentId, evidence[index], contributors);
        vm.prank(journeyCreator);
        journeyCore.markReadyForConfirmation(milestone.commitmentId, evidence[index]);
        vm.prank(journeyCreator);
        journeyCore.confirmFulfillment(milestone.commitmentId);
        Core.RecognitionEntry[] memory entries = new Core.RecognitionEntry[](1);
        entries[0] = Core.RecognitionEntry(milestone.participant, 10_000);
        vm.prank(journeyCreator);
        milestone.entitlement = journeyEarned.prepareDistribution(
            milestone.commitmentId, entries, keccak256(abi.encode(block.chainid, milestone.commitmentId, entries))
        );
    }

    function _dispatchProjectReward(uint256 index) internal {
        vm.selectFork(journeyArbitrumFork);
        vm.prank(journeyCreator);
        bytes32 id = journeyEarned.dispatch(projectMilestones[index].entitlement);
        bytes memory data = journeyArbitrumRouter.lastData();
        vm.selectFork(journeyGnosisFork);
        journeyGnosisRouter.deliver(
            address(journeyAdapter), _journeyMessage(id, JOURNEY_ARBITRUM_SELECTOR, address(journeyEarned), data)
        );
    }

    function _relayProjectReward() internal {
        vm.selectFork(journeyGnosisFork);
        bytes memory data = journeyGnosisRouter.lastData();
        bytes32 id = journeyGnosisRouter.lastMessageId();
        vm.selectFork(journeyArbitrumFork);
        journeyArbitrumRouter.deliver(
            address(journeyEarned), _journeyMessage(id, JOURNEY_GNOSIS_SELECTOR, address(journeyAdapter), data)
        );
    }

    function _prepareMemberLesson() internal {
        vm.selectFork(journeyArbitrumFork);
        Core.CreateCommitmentParams memory p = _projectParams(3);
        p.direction = Core.CommitmentDirection.Offer;
        p.claimMode = Core.ClaimMode.ApprovalGated;
        p.targetUnits = 60;
        p.unitLabel = "minutes of standalone integration lesson; excludes TAS site implementation";
        p.metadataCID = "FICTIONAL standalone integration teaching; separate work and capacity from website";
        vm.prank(projectEngineer);
        journeyServiceId = journeyCore.createCommitment(p);
        vm.prank(journeyCreator);
        journeyServices.setServiceOfferTerms(
            journeyServiceId,
            0,
            Services.ServiceOfferTermsInput(
                Services.ServicePaymentRoute.Voucher,
                ENGINEER_HELP_TERMS,
                MEMBER_REMEDY,
                100,
                projectEngineer,
                address(engineerHelp),
                MEMBER_REWARD
            ),
            0
        );
        Services.ServiceOfferTerms memory terms = journeyServices.getServiceOfferTerms(journeyServiceId);
        vm.startPrank(projectAnalyst);
        journeyClaimHash = journeyServices.requestServiceClaim(
            journeyServiceId, Services.ServiceClaimRequest(journeyBuyerGarden, projectAnalyst, 1, 1, terms.termsHash)
        );
        journeySetupId = journeySource.prepareVoucherSetup(
            journeyServiceId, 1, terms.termsHash, journeyClaimHash, 1, uint64(block.timestamp + 1 days)
        );
        vm.stopPrank();
        journeyAuthorizationHash = Codec.hash(journeySource.getSetupAuthorization(journeySetupId));
        _dispatchJourneySetup(0);
    }

    function _projectParams(uint256 index) private view returns (Core.CreateCommitmentParams memory p) {
        p.poolId = journeyPoolId;
        p.creationRequestKey = keccak256(abi.encode(MEMBER_PROJECT_BRIEF, index));
        p.direction = Core.CommitmentDirection.Request;
        p.commitmentType = Core.CommitmentType.SupportService;
        p.claimType = Core.ClaimType.Individual;
        p.claimMode = Core.ClaimMode.Open;
        p.contributorPolicy = Core.ContributorPolicy.LeadManaged;
        p.targetUnits = 1;
        p.unitLabel = "one separately accepted TAS website deliverable";
        p.metadataCID = string(
            abi.encodePacked(
                "FICTIONAL shared TAS brief:", vm.toString(MEMBER_PROJECT_BRIEF), "; milestone:", vm.toString(index)
            )
        );
    }
}
