// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GreenGoodsENSRegistrar } from "../../src/registries/ENSRegistrar.sol";
import { IGreenGoodsENSRegistrar } from "../../src/interfaces/IGreenGoodsENSRegistrar.sol";
import { ENSSlug } from "../../src/lib/ENSSlug.sol";
import { RecordingCCIPRouter } from "../helpers/ENSRegistrarMocks.sol";

/// @dev An authorized caller that cannot take a refund at first, and can later.
contract RefusingThenAcceptingCaller {
    GreenGoodsENSRegistrar internal immutable registrar;
    bool internal accepting;

    constructor(GreenGoodsENSRegistrar registrar_) {
        registrar = registrar_;
    }

    function register(string calldata slug, address account, uint256 payment) external payable {
        registrar.registerGarden{ value: payment }(slug, account);
    }

    function accept() external {
        accepting = true;
    }

    function claim() external {
        registrar.claimRefund();
    }

    receive() external payable {
        require(accepting, "not yet");
    }
}

/// @dev A second implementation, to prove the proxy upgrades and keeps its names.
contract GreenGoodsENSRegistrarNext is GreenGoodsENSRegistrar {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract GreenGoodsENSRegistrarTest is Test {
    uint64 internal constant ETH_CHAIN_SELECTOR = 5_009_297_550_715_157_269;
    uint256 internal constant FEE = 0.0004 ether;
    bytes32 internal constant SUPPORT_REF = keccak256("support request 42");

    GreenGoodsENSRegistrar internal registrar;
    RecordingCCIPRouter internal router;

    address internal owner = makeAddr("owner");
    address internal l1Receiver = makeAddr("l1 receiver");
    address internal gardenToken = makeAddr("garden token");
    address internal garden = makeAddr("garden account");
    address internal lostAccount = makeAddr("lost passkey account");
    address internal newAccount = makeAddr("new passkey account");
    address internal stranger = makeAddr("stranger");

    event NameReleasedByOperator(
        string slug, address indexed previousOwner, address indexed operator, bytes32 indexed supportReference
    );
    event NameAssignedByOperator(
        string slug, address indexed newOwner, address indexed operator, bytes32 indexed supportReference
    );

    function setUp() public {
        vm.warp(1_800_000_000);
        router = new RecordingCCIPRouter(FEE);
        registrar = GreenGoodsENSRegistrar(
            payable(address(
                    new ERC1967Proxy(
                        address(new GreenGoodsENSRegistrar()),
                        abi.encodeCall(
                            GreenGoodsENSRegistrar.initialize, (address(router), ETH_CHAIN_SELECTOR, l1Receiver, owner)
                        )
                    )
                ))
        );
        vm.prank(owner);
        registrar.setAuthorizedCaller(gardenToken, true);
        vm.deal(owner, 1 ether);
        vm.deal(gardenToken, 1 ether);
    }

    function _import(string memory slug, address holder, IGreenGoodsENSRegistrar.NameType nameType) internal {
        IGreenGoodsENSRegistrar.ImportedName[] memory names = new IGreenGoodsENSRegistrar.ImportedName[](1);
        names[0] = IGreenGoodsENSRegistrar.ImportedName({ slug: slug, owner: holder, nameType: nameType });
        vm.prank(owner);
        registrar.importNames(names);
    }

    function _finishImport() internal {
        vm.prank(owner);
        registrar.finishImport();
    }

    function _lastPayload() internal view returns (uint8 action, string memory slug, address holder, uint8 nameType) {
        return abi.decode(router.payloads(router.count() - 1), (uint8, string, address, uint8));
    }

    function testImport_recordsExistingNamesWithoutMessagingL1() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _import("miyawaki-park", garden, IGreenGoodsENSRegistrar.NameType.Garden);

        assertEq(registrar.ownerToSlug(lostAccount), "maya");
        assertEq(registrar.slugOwner(keccak256("miyawaki-park")), garden);
        assertFalse(registrar.available("maya"));
        assertEq(router.count(), 0, "names already on L1 must not be sent again");
    }

    function testImport_refusesDuplicatesInvalidSlugsAndStrangers() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);

        IGreenGoodsENSRegistrar.ImportedName[] memory names = new IGreenGoodsENSRegistrar.ImportedName[](1);
        names[0] = IGreenGoodsENSRegistrar.ImportedName("maya", newAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameTaken.selector);
        registrar.importNames(names);

        names[0] = IGreenGoodsENSRegistrar.ImportedName("other", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.AlreadyHasName.selector);
        registrar.importNames(names);

        names[0] = IGreenGoodsENSRegistrar.ImportedName("Maya", newAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        vm.prank(owner);
        vm.expectRevert(ENSSlug.InvalidSlug.selector);
        registrar.importNames(names);

        names[0] = IGreenGoodsENSRegistrar.ImportedName("fine", newAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.importNames(names);
    }

    function testImport_endsForGood() public {
        vm.prank(owner);
        registrar.finishImport();
        assertFalse(registrar.importOpen());

        IGreenGoodsENSRegistrar.ImportedName[] memory names = new IGreenGoodsENSRegistrar.ImportedName[](1);
        names[0] = IGreenGoodsENSRegistrar.ImportedName("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        vm.startPrank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportClosed.selector);
        registrar.importNames(names);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportClosed.selector);
        registrar.finishImport();
        vm.stopPrank();
    }

    function testRegisterGarden_sendsTheReceiversPayloadAndRefundsTheExcess() public {
        _finishImport();
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE + 1 gwei }("miyawaki-park", garden);

        (uint8 action, string memory slug, address holder, uint8 nameType) = _lastPayload();
        assertEq(action, 0);
        assertEq(slug, "miyawaki-park");
        assertEq(holder, garden);
        assertEq(nameType, uint8(IGreenGoodsENSRegistrar.NameType.Garden));
        assertEq(router.receivers(0), l1Receiver);
        assertEq(gardenToken.balance, 1 ether - FEE, "the excess is refunded");
    }

    function testRegisterGarden_neverSpendsTheContractsBalance() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        vm.prank(gardenToken);
        vm.expectRevert(IGreenGoodsENSRegistrar.InsufficientFee.selector);
        registrar.registerGarden("miyawaki-park", garden);
    }

    function testRegisterGarden_refusesUnauthorizedCallers() public {
        _finishImport();
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(IGreenGoodsENSRegistrar.NotAuthorizedCaller.selector);
        registrar.registerGarden{ value: FEE }("miyawaki-park", garden);
    }

    function testAdminRelease_clearsAMemberNameHereAndTellsL1() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();

        vm.expectEmit(true, true, true, true, address(registrar));
        emit NameReleasedByOperator("maya", lostAccount, owner, SUPPORT_REF);
        vm.prank(owner);
        registrar.adminReleaseName{ value: FEE }("maya", lostAccount, SUPPORT_REF);

        assertEq(registrar.slugOwner(keccak256("maya")), address(0));
        assertEq(bytes(registrar.ownerToSlug(lostAccount)).length, 0);
        (uint8 action, string memory slug, address holder,) = _lastPayload();
        assertEq(action, 1, "L1 must receive a release");
        assertEq(slug, "maya");
        assertEq(holder, lostAccount);
        // Released names rest before anyone else can take them.
        assertFalse(registrar.available("maya"));
        vm.warp(block.timestamp + 30 days);
        assertTrue(registrar.available("maya"));
    }

    function testAdminRelease_paysFromTheContractWhenTheOperatorSendsNothing() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.InsufficientFee.selector);
        registrar.adminReleaseName("maya", lostAccount, SUPPORT_REF);

        vm.deal(address(registrar), FEE);
        vm.prank(owner);
        registrar.adminReleaseName("maya", lostAccount, SUPPORT_REF);
        assertEq(address(registrar).balance, 0);
        assertEq(router.count(), 1);
    }

    function testAdminRelease_neverReleasesAGardenName() public {
        _import("miyawaki-park", garden, IGreenGoodsENSRegistrar.NameType.Garden);
        _finishImport();
        // A garden name the garden token registered is as fixed as one carried over.
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE }("new-garden", newAccount);
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.CannotReleaseGardenName.selector);
        registrar.adminReleaseName{ value: FEE }("new-garden", newAccount, SUPPORT_REF);
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.CannotReleaseGardenName.selector);
        registrar.adminReleaseName{ value: FEE }("miyawaki-park", garden, SUPPORT_REF);
        assertEq(registrar.slugOwner(keccak256("miyawaki-park")), garden);
    }

    function testAdminRelease_refusesAStaleOwnerAMissingNameAndAMissingReference() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();
        vm.startPrank(owner);
        // The support record named another holder: the name moved, or the record is wrong.
        vm.expectRevert(abi.encodeWithSelector(IGreenGoodsENSRegistrar.NameOwnerMismatch.selector, lostAccount));
        registrar.adminReleaseName{ value: FEE }("maya", newAccount, SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameNotRegistered.selector);
        registrar.adminReleaseName{ value: FEE }("nobody", lostAccount, SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.ReferenceRequired.selector);
        registrar.adminReleaseName{ value: FEE }("maya", lostAccount, bytes32(0));
        vm.stopPrank();
        assertEq(registrar.slugOwner(keccak256("maya")), lostAccount);
    }

    function testAdminRelease_isOwnerOnly() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();
        // Not even the name's holder can release it here.
        vm.deal(lostAccount, 1 ether);
        vm.prank(lostAccount);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.adminReleaseName{ value: FEE }("maya", lostAccount, SUPPORT_REF);
    }

    function testAdminAssign_returnsAReleasedNameToANewAccountWithoutTheCooldown() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();
        vm.startPrank(owner);
        registrar.adminReleaseName{ value: FEE }("maya", lostAccount, SUPPORT_REF);

        vm.expectEmit(true, true, true, true, address(registrar));
        emit NameAssignedByOperator("maya", newAccount, owner, SUPPORT_REF);
        registrar.adminAssignName{ value: FEE }("maya", newAccount, SUPPORT_REF);
        vm.stopPrank();

        assertEq(registrar.ownerToSlug(newAccount), "maya");
        assertEq(registrar.slugOwner(keccak256("maya")), newAccount);
        (uint8 action, string memory slug, address holder, uint8 nameType) = _lastPayload();
        assertEq(action, 0, "L1 must receive a registration");
        assertEq(slug, "maya");
        assertEq(holder, newAccount);
        assertEq(nameType, uint8(IGreenGoodsENSRegistrar.NameType.Gardener));
    }

    function testAdminAssign_cannotTakeANameSomeoneHolds() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _import("miyawaki-park", garden, IGreenGoodsENSRegistrar.NameType.Garden);
        _finishImport();
        vm.startPrank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameTaken.selector);
        registrar.adminAssignName{ value: FEE }("maya", newAccount, SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameTaken.selector);
        registrar.adminAssignName{ value: FEE }("miyawaki-park", newAccount, SUPPORT_REF);
        // An account that already has a name does not get a second one.
        vm.expectRevert(IGreenGoodsENSRegistrar.AlreadyHasName.selector);
        registrar.adminAssignName{ value: FEE }("free-name", lostAccount, SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.ReferenceRequired.selector);
        registrar.adminAssignName{ value: FEE }("free-name", newAccount, bytes32(0));
        vm.stopPrank();
    }

    function testWithdraw_keepsWhatIsOwedToRefundClaims() public {
        _finishImport();
        // The garden token here cannot receive ETH, so its refund waits to be claimed.
        vm.etch(gardenToken, hex"60006000fd");
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE + 1 gwei }("miyawaki-park", garden);
        assertEq(registrar.failedRefunds(gardenToken), 1 gwei);

        vm.deal(address(registrar), 1 gwei + 0.5 ether);
        vm.prank(owner);
        registrar.withdrawETH(owner);
        assertEq(address(registrar).balance, 1 gwei, "what is owed stays in the contract");

        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.NoWithdrawableBalance.selector);
        registrar.withdrawETH(owner);

        // The token can never collect it, so the owner delivers it to the minter.
        address minter = makeAddr("minter");
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.adminRedirectRefund(gardenToken, minter);
        vm.prank(owner);
        registrar.adminRedirectRefund(gardenToken, minter);
        assertEq(minter.balance, 1 gwei);
        assertEq(registrar.failedRefunds(gardenToken), 0);
        assertEq(registrar.totalPendingRefunds(), 0);
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.NoRefundAvailable.selector);
        registrar.adminRedirectRefund(gardenToken, minter);
    }

    function testClaimRefund_paysACreditorThatCanReceiveItLater() public {
        _finishImport();
        // A caller that refuses ETH during the registration and accepts it afterwards.
        RefusingThenAcceptingCaller caller = new RefusingThenAcceptingCaller(registrar);
        vm.prank(owner);
        registrar.setAuthorizedCaller(address(caller), true);
        vm.deal(address(caller), 1 ether);
        caller.register{ value: 0 }("picky-garden", garden, FEE + 1 gwei);
        assertEq(registrar.failedRefunds(address(caller)), 1 gwei);

        caller.accept();
        caller.claim();
        assertEq(registrar.failedRefunds(address(caller)), 0);
        assertEq(registrar.totalPendingRefunds(), 0);
        assertEq(address(caller).balance, 1 ether - FEE);
    }

    function testImport_blocksLiveRegistrationsAndRecoveryUntilItEnds() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        // A live registration now could take a name the manifest has yet to carry over.
        vm.prank(gardenToken);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportStillOpen.selector);
        registrar.registerGarden{ value: FEE }("miyawaki-park", garden);
        vm.startPrank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportStillOpen.selector);
        registrar.adminReleaseName{ value: FEE }("maya", lostAccount, SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportStillOpen.selector);
        registrar.adminAssignName{ value: FEE }("free-name", newAccount, SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportStillOpen.selector);
        registrar.adminResendRegistration{ value: FEE }("maya", SUPPORT_REF);
        vm.stopPrank();
        assertEq(router.count(), 0);
    }

    function testRegisterGarden_refusesNamesTheReceiverWouldRefuse() public {
        _finishImport();
        string[6] memory invalid =
            ["ab", "this-name-is-fifty-one-characters-long-and-too-long", "-lead", "trail-", "dou--ble", "Upper"];
        for (uint256 i; i < invalid.length; ++i) {
            vm.prank(gardenToken);
            vm.expectRevert(ENSSlug.InvalidSlug.selector);
            registrar.registerGarden{ value: FEE }(invalid[i], garden);
        }
        // The shortest and longest names allowed.
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE }("abc", garden);
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE }("this-name-is-exactly-fifty-characters-long-so-fine", newAccount);
    }

    function testRegisterGarden_waitsOutTheCooldownOfAReleasedName() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();
        vm.prank(owner);
        registrar.adminReleaseName{ value: FEE }("maya", lostAccount, SUPPORT_REF);

        vm.prank(gardenToken);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameInCooldown.selector);
        registrar.registerGarden{ value: FEE }("maya", garden);

        vm.warp(block.timestamp + 30 days);
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE }("maya", garden);
        assertEq(registrar.slugOwner(keccak256("maya")), garden);
    }

    function testSetNameChangeCooldown_isBounded() public {
        vm.startPrank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.InvalidCooldown.selector);
        registrar.setNameChangeCooldown(0);
        vm.expectRevert(IGreenGoodsENSRegistrar.InvalidCooldown.selector);
        registrar.setNameChangeCooldown(365 days + 1);
        registrar.setNameChangeCooldown(7 days);
        vm.stopPrank();
        assertEq(registrar.nameChangeCooldown(), 7 days);
    }

    function testAdminResend_sendsTheCurrentHoldersRegistrationAgain() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _import("miyawaki-park", garden, IGreenGoodsENSRegistrar.NameType.Garden);
        _finishImport();

        vm.startPrank(owner);
        registrar.adminResendRegistration{ value: FEE }("miyawaki-park", SUPPORT_REF);
        (uint8 action, string memory slug, address holder, uint8 nameType) = _lastPayload();
        assertEq(action, 0);
        assertEq(slug, "miyawaki-park");
        assertEq(holder, garden);
        assertEq(nameType, uint8(IGreenGoodsENSRegistrar.NameType.Garden));
        // Nothing changes here: the name and its holder are as they were.
        assertEq(registrar.slugOwner(keccak256("miyawaki-park")), garden);

        vm.expectRevert(IGreenGoodsENSRegistrar.NameNotRegistered.selector);
        registrar.adminResendRegistration{ value: FEE }("nobody", SUPPORT_REF);
        vm.expectRevert(IGreenGoodsENSRegistrar.ReferenceRequired.selector);
        registrar.adminResendRegistration{ value: FEE }("maya", bytes32(0));
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.adminResendRegistration("maya", SUPPORT_REF);
    }

    function testRenounceOwnership_isRefused() public {
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.OwnershipCannotBeRenounced.selector);
        registrar.renounceOwnership();
        assertEq(registrar.owner(), owner);
    }

    function testUpgrade_Registrar_isOwnerOnlyAndKeepsEveryName() public {
        _import("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        address next = address(new GreenGoodsENSRegistrarNext());

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.upgradeTo(next);

        vm.prank(owner);
        registrar.upgradeTo(next);
        assertEq(GreenGoodsENSRegistrarNext(payable(address(registrar))).version(), 2);
        assertEq(registrar.ownerToSlug(lostAccount), "maya");
        assertEq(registrar.l1Receiver(), l1Receiver);
        assertEq(registrar.nameChangeCooldown(), 30 days);
    }

    function testInitialize_runsOnceAndNeverOnTheImplementation() public {
        vm.expectRevert("Initializable: contract is already initialized");
        registrar.initialize(address(router), ETH_CHAIN_SELECTOR, l1Receiver, stranger);

        GreenGoodsENSRegistrar implementation = new GreenGoodsENSRegistrar();
        vm.expectRevert("Initializable: contract is already initialized");
        implementation.initialize(address(router), ETH_CHAIN_SELECTOR, l1Receiver, stranger);
    }

    function testInitialize_refusesAMissingRouterReceiverOrOwner() public {
        address implementation = address(new GreenGoodsENSRegistrar());
        address[3][3] memory inputs = [
            [address(0), l1Receiver, owner], [address(router), address(0), owner], [address(router), l1Receiver, address(0)]
        ];
        for (uint256 i; i < inputs.length; ++i) {
            vm.expectRevert();
            new ERC1967Proxy(
                implementation,
                abi.encodeCall(
                    GreenGoodsENSRegistrar.initialize, (inputs[i][0], ETH_CHAIN_SELECTOR, inputs[i][1], inputs[i][2])
                )
            );
        }
    }
}
