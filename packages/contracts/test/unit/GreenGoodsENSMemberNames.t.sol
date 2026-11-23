// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GreenGoodsENSRegistrar } from "../../src/registries/ENSRegistrar.sol";
import { GreenGoodsENSMemberNames } from "../../src/registries/ENSMemberNames.sol";
import { IGreenGoodsENSRegistrar } from "../../src/interfaces/IGreenGoodsENSRegistrar.sol";
import { IGreenGoodsENSMemberNames } from "../../src/interfaces/IGreenGoodsENSMemberNames.sol";
import { ENSSlug } from "../../src/lib/ENSSlug.sol";
import { RecordingCCIPRouter } from "../helpers/ENSRegistrarMocks.sol";

/// @dev Hats Protocol's membership read, with wearers a test names.
contract WearerList {
    mapping(address account => mapping(uint256 hatId => bool wears)) internal wearers;

    function setWearer(address account, uint256 hatId, bool wears) external {
        wearers[account][hatId] = wears;
    }

    function isWearerOfHat(address account, uint256 hatId) external view returns (bool) {
        return wearers[account][hatId];
    }
}

/// @notice Members registering their own names, on a proxy that started as the plain registrar
/// and was upgraded: the path the live contract would take.
contract GreenGoodsENSMemberNamesTest is Test {
    uint64 internal constant ETH_CHAIN_SELECTOR = 5_009_297_550_715_157_269;
    uint256 internal constant FEE = 0.0004 ether;
    bytes32 internal constant SUPPORT_REF = keccak256("support request 42");
    uint256 internal constant MEMBER_HAT = 42;
    uint256 internal constant DIRECTORY_KEY = 0xD1EC7;

    GreenGoodsENSMemberNames internal registrar;
    RecordingCCIPRouter internal router;
    WearerList internal hats;

    address internal owner = makeAddr("owner");
    address internal l1Receiver = makeAddr("l1 receiver");
    address internal gardenToken = makeAddr("garden token");
    address internal garden = makeAddr("garden account");
    address internal lostAccount = makeAddr("lost passkey account");
    address internal newAccount = makeAddr("new passkey account");
    address internal member = makeAddr("garden member");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.warp(1_800_000_000);
        router = new RecordingCCIPRouter(FEE);
        hats = new WearerList();
        hats.setWearer(member, MEMBER_HAT, true);
        registrar = _upgradedRegistrar();
        vm.startPrank(owner);
        registrar.setAuthorizedCaller(gardenToken, true);
        registrar.setMembershipHat(address(hats), MEMBER_HAT);
        registrar.setNameAttestor(vm.addr(DIRECTORY_KEY));
        registrar.setSponsorship(3, 2, 0.001 ether);
        vm.stopPrank();
        vm.deal(owner, 1 ether);
        vm.deal(gardenToken, 1 ether);
    }

    /// @dev A registrar proxy on the plain implementation, upgraded to the member-names one.
    function _upgradedRegistrar() internal returns (GreenGoodsENSMemberNames) {
        address proxy = address(
            new ERC1967Proxy(
                address(new GreenGoodsENSRegistrar()),
                abi.encodeCall(GreenGoodsENSRegistrar.initialize, (address(router), ETH_CHAIN_SELECTOR, l1Receiver, owner))
            )
        );
        address next = address(new GreenGoodsENSMemberNames());
        vm.prank(owner);
        GreenGoodsENSRegistrar(payable(proxy)).upgradeTo(next);
        return GreenGoodsENSMemberNames(payable(proxy));
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

    function _grant(
        address account,
        string memory slug,
        uint256 deadline,
        uint256 signerKey
    )
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, registrar.nameGrantDigest(account, slug, deadline));
        return abi.encodePacked(r, s, v);
    }

    function _claim(address account, string memory slug) internal {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(account, slug, deadline, DIRECTORY_KEY);
        vm.prank(account);
        registrar.claimName(slug, deadline, grant);
    }

    function _importIsClosedSoAssign(string memory slug, address account) internal {
        vm.prank(owner);
        registrar.adminAssignName(slug, account, SUPPORT_REF);
    }

    function _lastPayload() internal view returns (uint8 action, string memory slug, address holder, uint8 nameType) {
        return abi.decode(router.payloads(router.count() - 1), (uint8, string, address, uint8));
    }

    function testUpgrade_MemberNames_keepsEveryNameAndStartsWithClaimsAndSponsorshipOff() public {
        GreenGoodsENSRegistrar plain = GreenGoodsENSRegistrar(
            payable(address(
                    new ERC1967Proxy(
                        address(new GreenGoodsENSRegistrar()),
                        abi.encodeCall(
                            GreenGoodsENSRegistrar.initialize, (address(router), ETH_CHAIN_SELECTOR, l1Receiver, owner)
                        )
                    )
                ))
        );
        IGreenGoodsENSRegistrar.ImportedName[] memory names = new IGreenGoodsENSRegistrar.ImportedName[](2);
        names[0] = IGreenGoodsENSRegistrar.ImportedName("maya", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        names[1] = IGreenGoodsENSRegistrar.ImportedName("miyawaki-park", garden, IGreenGoodsENSRegistrar.NameType.Garden);
        vm.startPrank(owner);
        plain.importNames(names);
        plain.setAuthorizedCaller(gardenToken, true);
        plain.setNameChangeCooldown(7 days);
        plain.upgradeTo(address(new GreenGoodsENSMemberNames()));
        vm.stopPrank();

        GreenGoodsENSMemberNames upgraded = GreenGoodsENSMemberNames(payable(address(plain)));
        assertEq(address(upgraded.ccipRouter()), address(router));
        assertEq(upgraded.ethereumChainSelector(), ETH_CHAIN_SELECTOR);
        assertEq(upgraded.l1Receiver(), l1Receiver);
        assertEq(upgraded.ownerToSlug(lostAccount), "maya");
        assertEq(upgraded.slugOwner(keccak256("miyawaki-park")), garden);
        assertEq(uint8(upgraded.slugNameType(keccak256("miyawaki-park"))), uint8(IGreenGoodsENSRegistrar.NameType.Garden));
        assertEq(upgraded.nameChangeCooldown(), 7 days);
        assertTrue(upgraded.authorizedCallers(gardenToken));
        assertTrue(upgraded.importOpen());
        assertEq(upgraded.owner(), owner);

        // Everything this layer added reads as unset, so nothing is claimable or sponsored.
        assertEq(address(upgraded.hats()), address(0));
        assertEq(upgraded.protocolHatId(), 0);
        assertEq(upgraded.nameAttestor(), address(0));
        (uint96 maxFee,,,,,) = upgraded.sponsorship();
        assertEq(maxFee, 0);
        (uint256 membersLeft, uint256 gardensLeft) = upgraded.sponsoredSendsLeftToday();
        assertEq(membersLeft + gardensLeft, 0);

        // Until the owner sets the limits, the balance pays for no garden: a mint that sends nothing
        // has its name held, with its registration waiting.
        vm.prank(owner);
        upgraded.finishImport();
        vm.deal(address(upgraded), 1 ether);
        vm.prank(gardenToken);
        upgraded.registerGarden("unsponsored-garden", makeAddr("unsponsored garden"));
        assertEq(upgraded.slugOwner(keccak256("unsponsored-garden")), makeAddr("unsponsored garden"));
        vm.prank(gardenToken);
        upgraded.registerGarden{ value: FEE }("paid-garden", newAccount);
        assertEq(address(upgraded).balance, 1 ether);
    }

    function testClaimName_isRefusedWhileTheImportIsOpen() public {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "noor", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSRegistrar.ImportStillOpen.selector);
        registrar.claimName("noor", deadline, grant);
    }

    function testRegisterGarden_usesTheReserveWhenTheMinterSendsNothingWithinTheDailyLimit() public {
        _finishImport();
        // A stranger is refused before any limit is counted.
        vm.prank(stranger);
        vm.expectRevert(IGreenGoodsENSRegistrar.NotAuthorizedCaller.selector);
        registrar.registerGarden("miyawaki-park", garden);

        vm.deal(address(registrar), 1 ether);
        vm.prank(gardenToken);
        registrar.registerGarden("miyawaki-park", garden);
        assertEq(address(registrar).balance, 1 ether - FEE);
        (uint256 membersLeft, uint256 gardensLeft) = registrar.sponsoredSendsLeftToday();
        assertEq(gardensLeft, 1);
        assertEq(membersLeft, 3, "a garden does not use the members' limit");

        // A minter who pays does not draw on the limit.
        vm.prank(gardenToken);
        registrar.registerGarden{ value: FEE }("paid-garden", newAccount);
        (, gardensLeft) = registrar.sponsoredSendsLeftToday();
        assertEq(gardensLeft, 1);

        // The gardens' limit is their own, and members are not held up by it.
        vm.prank(gardenToken);
        registrar.registerGarden("second-garden", makeAddr("second garden"));
        _claim(member, "maya");
    }

    function testRegisterGarden_holdsTheNameWhenTheReserveCannotPayAndTheOwnerSendsItLater() public {
        _finishImport();
        address thirdGarden = makeAddr("third garden");
        vm.deal(address(registrar), 1 ether);
        vm.startPrank(gardenToken);
        registrar.registerGarden("first-garden", makeAddr("first garden"));
        registrar.registerGarden("second-garden", makeAddr("second garden"));
        uint256 sent = router.count();

        // Over the gardens' limit: the mint carries on, and the name is held here, not lost.
        vm.expectEmit(true, true, false, true, address(registrar));
        emit IGreenGoodsENSMemberNames.GardenRegistrationDeferred(thirdGarden, FEE, "third-garden");
        registrar.registerGarden("third-garden", thirdGarden);
        vm.stopPrank();
        assertEq(router.count(), sent, "nothing reached L1");
        assertEq(registrar.slugOwner(keccak256("third-garden")), thirdGarden);

        // A member whose username matches cannot take it.
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "third-garden", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameTaken.selector);
        registrar.claimName("third-garden", deadline, grant);

        // The owner sends the waiting registration later.
        vm.prank(owner);
        registrar.adminResendRegistration("third-garden", keccak256("ops-ticket-9"));
        (, string memory slug, address holder, uint8 nameType) = _lastPayload();
        assertEq(slug, "third-garden");
        assertEq(holder, thirdGarden);
        assertEq(nameType, uint8(IGreenGoodsENSRegistrar.NameType.Garden));

        // An empty reserve or a fee above the cap holds the name the same way.
        vm.deal(address(registrar), 0);
        vm.warp(block.timestamp + 1 days);
        vm.prank(gardenToken);
        registrar.registerGarden("fourth-garden", makeAddr("fourth garden"));
        assertEq(registrar.slugOwner(keccak256("fourth-garden")), makeAddr("fourth garden"));
        vm.deal(address(registrar), 1 ether);
        router.setFee(0.002 ether);
        vm.prank(gardenToken);
        registrar.registerGarden("fifth-garden", makeAddr("fifth garden"));
        assertEq(router.count(), sent + 1, "only the owner's resend reached L1");
    }

    function testClaimName_registersTheDirectoryUsernameFromTheReserve() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        assertEq(member.balance, 0, "a passkey account holds no ETH");
        _claim(member, "maya");

        assertEq(registrar.ownerToSlug(member), "maya");
        assertEq(uint8(registrar.slugNameType(keccak256("maya"))), uint8(IGreenGoodsENSRegistrar.NameType.Gardener));
        (uint8 action, string memory slug, address holder, uint8 nameType) = _lastPayload();
        assertEq(action, 0);
        assertEq(slug, "maya");
        assertEq(holder, member);
        assertEq(nameType, uint8(IGreenGoodsENSRegistrar.NameType.Gardener));
        assertEq(address(registrar).balance, 1 ether - FEE);
        assertTrue(registrar.sponsoredClaimUsed(member));
    }

    function testClaimName_refusesAnyNameTheDirectoryDidNotVouchForThisAccount() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "maya", deadline, DIRECTORY_KEY);

        // The member tries a different name under their own grant.
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        registrar.claimName("vitalik", deadline, grant);

        // Another member tries to use this member's grant.
        hats.setWearer(newAccount, MEMBER_HAT, true);
        vm.prank(newAccount);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        registrar.claimName("maya", deadline, grant);

        // A grant signed by anyone but the directory.
        bytes memory forged = _grant(member, "maya", deadline, 0xBAD);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        registrar.claimName("maya", deadline, forged);

        // A later deadline than the one signed, and a lapsed grant.
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        registrar.claimName("maya", deadline + 1, grant);
        vm.warp(deadline + 1);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.NameGrantExpired.selector);
        registrar.claimName("maya", deadline, grant);
        assertEq(router.count(), 0);
    }

    function testClaimName_needsTheGardenMemberHat() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(stranger, "maya", deadline, DIRECTORY_KEY);
        // The directory vouches for the name, but the account has joined no garden.
        vm.prank(stranger);
        vm.expectRevert(IGreenGoodsENSMemberNames.NotProtocolMember.selector);
        registrar.claimName("maya", deadline, grant);
    }

    function testClaimName_givesOneNamePerAccountAndOneAccountPerName() public {
        _import("taken", lostAccount, IGreenGoodsENSRegistrar.NameType.Gardener);
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        uint256 deadline = block.timestamp + 10 minutes;

        // A username someone already holds as a name.
        bytes memory grant = _grant(member, "taken", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameTaken.selector);
        registrar.claimName("taken", deadline, grant);

        // A second name for an account that has one, even with a fresh grant.
        _claim(member, "maya");
        grant = _grant(member, "maya-two", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSRegistrar.AlreadyHasName.selector);
        registrar.claimName("maya-two", deadline, grant);

        // Presenting the grant again does nothing: the name is held.
        grant = _grant(member, "maya", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSRegistrar.NameTaken.selector);
        registrar.claimName("maya", deadline, grant);
    }

    function testClaimName_refusesAUsernameThatCannotBeAName() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        uint256 deadline = block.timestamp + 10 minutes;
        // Even a grant the directory signed cannot register a name the receiver would refuse.
        bytes memory grant = _grant(member, "Maya Silva", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(ENSSlug.InvalidSlug.selector);
        registrar.claimName("Maya Silva", deadline, grant);
    }

    function testClaimName_sponsorsEachAccountOnce() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        _claim(member, "maya");

        // An operator releases the name; the cooldown passes; the member registers again.
        vm.prank(owner);
        registrar.adminReleaseName("maya", member, SUPPORT_REF);
        vm.warp(block.timestamp + 30 days);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "maya", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.SponsoredClaimUsed.selector);
        registrar.claimName("maya", deadline, grant);

        // Paying the fee works, and the excess comes back.
        vm.deal(member, 1 ether);
        vm.prank(member);
        registrar.claimName{ value: FEE + 1 gwei }("maya", deadline, grant);
        assertEq(registrar.ownerToSlug(member), "maya");
        assertEq(member.balance, 1 ether - FEE);
    }

    function testClaimName_stopsAtTheDailyLimitAndResumesTheNextDay() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        address[4] memory members = [member, makeAddr("m2"), makeAddr("m3"), makeAddr("m4")];
        string[4] memory names = ["maya", "noor", "ravi", "sipho"];
        for (uint256 i; i < 3; ++i) {
            hats.setWearer(members[i], MEMBER_HAT, true);
            _claim(members[i], names[i]);
        }
        (uint256 membersLeft, uint256 gardensLeft) = registrar.sponsoredSendsLeftToday();
        assertEq(membersLeft, 0);
        assertEq(gardensLeft, 2, "members do not use the gardens' limit");

        hats.setWearer(members[3], MEMBER_HAT, true);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(members[3], names[3], deadline, DIRECTORY_KEY);
        vm.prank(members[3]);
        vm.expectRevert(IGreenGoodsENSMemberNames.DailySponsorLimitReached.selector);
        registrar.claimName(names[3], deadline, grant);
        // The refused account's one sponsored registration is not spent.
        assertFalse(registrar.sponsoredClaimUsed(members[3]));
        // A garden still gets its name from the reserve.
        vm.prank(gardenToken);
        registrar.registerGarden("late-garden", garden);

        vm.warp(block.timestamp + 1 days);
        (membersLeft,) = registrar.sponsoredSendsLeftToday();
        assertEq(membersLeft, 3);
        _claim(members[3], names[3]);
        assertEq(registrar.ownerToSlug(members[3]), "sipho");
    }

    function testClaimName_neverPaysMoreThanTheFeeCapFromTheReserve() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        // L1 gas spikes and the router quotes ten times the usual fee.
        router.setFee(0.004 ether);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "maya", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(
            abi.encodeWithSelector(IGreenGoodsENSRegistrar.BalanceFeeCapExceeded.selector, 0.004 ether, 0.001 ether)
        );
        registrar.claimName("maya", deadline, grant);
        // A garden mint is not refused: its name is held and its registration waits for the owner.
        vm.prank(gardenToken);
        registrar.registerGarden("miyawaki-park", garden);
        assertEq(registrar.slugOwner(keccak256("miyawaki-park")), garden);
        assertEq(address(registrar).balance, 1 ether);
        assertFalse(registrar.sponsoredClaimUsed(member));

        // The owner's own recovery actions are not capped, and a member can still pay.
        _importIsClosedSoAssign("maya-held", lostAccount);
        vm.deal(member, 1 ether);
        vm.prank(member);
        registrar.claimName{ value: 0.004 ether }("maya", deadline, grant);
        assertEq(registrar.ownerToSlug(member), "maya");
    }

    function testClaimName_paidDoesNotSpendTheSponsoredRegistrationAndPartPaymentIsRefused() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        vm.deal(member, 1 ether);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "maya", deadline, DIRECTORY_KEY);

        // Less than the fee is refused outright; the reserve does not top it up.
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSRegistrar.InsufficientFee.selector);
        registrar.claimName{ value: FEE - 1 }("maya", deadline, grant);

        vm.prank(member);
        registrar.claimName{ value: FEE }("maya", deadline, grant);
        assertFalse(registrar.sponsoredClaimUsed(member), "paying keeps the sponsored registration for later");
        (uint256 membersLeft,) = registrar.sponsoredSendsLeftToday();
        assertEq(membersLeft, 3);
        assertEq(address(registrar).balance, 1 ether, "the reserve is untouched");
    }

    function testClaimName_refusesAGrantThatRunsLongerThanAnHour() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        uint256 deadline = block.timestamp + 1 hours + 1;
        bytes memory grant = _grant(member, "maya", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.NameGrantTooLong.selector);
        registrar.claimName("maya", deadline, grant);

        // A grant's remaining life is bounded by the shortest cooldown, an hour.
        vm.prank(owner);
        vm.expectRevert(IGreenGoodsENSRegistrar.InvalidCooldown.selector);
        registrar.setNameChangeCooldown(1 hours - 1);
    }

    function testClaimName_isOffUntilTheOwnerSetsTheDirectoryAndTheHat() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        vm.prank(owner);
        registrar.setNameAttestor(address(0));
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _grant(member, "maya", deadline, DIRECTORY_KEY);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.ClaimsNotConfigured.selector);
        registrar.claimName("maya", deadline, grant);

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.setNameAttestor(stranger);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.setMembershipHat(address(hats), 7);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        registrar.setSponsorship(1000, 1000, 1 ether);

        // A registrar whose owner set the directory but not the hat.
        GreenGoodsENSMemberNames fresh = _upgradedRegistrar();
        vm.startPrank(owner);
        fresh.finishImport();
        fresh.setNameAttestor(vm.addr(DIRECTORY_KEY));
        vm.stopPrank();
        (uint8 v, bytes32 r, bytes32 sig) = vm.sign(DIRECTORY_KEY, fresh.nameGrantDigest(member, "maya", deadline));
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.ClaimsNotConfigured.selector);
        fresh.claimName("maya", deadline, abi.encodePacked(r, sig, v));
    }

    function testClaimName_grantIsBoundToThisChainAndThisContract() public {
        _finishImport();
        vm.deal(address(registrar), 1 ether);
        uint256 deadline = block.timestamp + 10 minutes;
        vm.chainId(100);
        bytes memory otherChain = _grant(member, "maya", deadline, DIRECTORY_KEY);
        vm.chainId(31_337);
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        registrar.claimName("maya", deadline, otherChain);

        // A grant the same directory key signed for another registrar.
        GreenGoodsENSMemberNames other = _upgradedRegistrar();
        (uint8 v, bytes32 r, bytes32 sig) = vm.sign(DIRECTORY_KEY, other.nameGrantDigest(member, "maya", deadline));
        vm.prank(member);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        registrar.claimName("maya", deadline, abi.encodePacked(r, sig, v));
    }
}
