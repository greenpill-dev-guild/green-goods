// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { GreenGoodsENSRegistrar } from "../../src/registries/ENSRegistrar.sol";
import { GreenGoodsENSMemberNames } from "../../src/registries/ENSMemberNames.sol";
import { IGreenGoodsENSRegistrar } from "../../src/interfaces/IGreenGoodsENSRegistrar.sol";
import { IGreenGoodsENSMemberNames } from "../../src/interfaces/IGreenGoodsENSMemberNames.sol";
import { GreenGoodsENSReceiver, UnauthorizedSender } from "../../src/registries/ENSReceiver.sol";
import { IENSResolver } from "../../src/interfaces/IENS.sol";

interface ILiveSender {
    function HATS() external view returns (address);
    function protocolHatId() external view returns (uint256);
    function slugOwner(bytes32 slugHash) external view returns (address);
    function slugNameType(bytes32 slugHash) external view returns (uint8);
    function ownerToSlug(address owner) external view returns (string memory);
}

interface IOwned {
    function owner() external view returns (address);
}

interface IGardenTokenENS {
    function ensModule() external view returns (address);
    function setENSModule(address module) external;
}

interface ISkipCheat {
    function skip(bool skipTest) external;
}

/// @dev forge-std in this repository predates Foundry's log query cheatcode.
interface ILogCheats {
    struct EthGetLogs {
        address emitter;
        bytes32[] topics;
        bytes data;
        bytes32 blockHash;
        uint64 blockNumber;
        bytes32 transactionHash;
        uint64 transactionIndex;
        uint256 logIndex;
        bool removed;
    }

    function eth_getLogs(
        uint256 fromBlock,
        uint256 toBlock,
        address target,
        bytes32[] calldata topics
    )
        external
        returns (EthGetLogs[] memory);
    function rpc(string calldata method, string calldata params) external returns (bytes memory);
}

/// @title CrossChainENSRegistrarForkTest
/// @notice The upgradeable registrar taking over from the live Arbitrum sender, proven against
/// live state: every name the sender registered is carried over, the garden token and the live
/// L1 receiver are re-pointed, and an operator release and reassignment change the real ENS records.
/// @dev Owner actions are pranked as the live owners; nothing is signed or broadcast. The CCIP
/// hop is simulated the way CrossChainENS.t.sol does it: the Arbitrum side sends through the real
/// router, and a payload of the same encoding, built by the test, is handed to the L1 receiver as
/// its router. The registrar's own message bytes do not reach the receiver here.
contract CrossChainENSRegistrarForkTest is Test {
    address internal constant LIVE_SENDER = 0x4fAD8Db8e04005884D484eC730aDae10d7A2e491;
    address internal constant LIVE_RECEIVER = 0x742c8935d314363e8c16df5b0791525109Fb9387;
    address internal constant GARDEN_TOKEN = 0xe1Da335110b1ed48e7df63209f5D424d02276593;
    address internal constant ARB_CCIP_ROUTER = 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8;
    uint64 internal constant ETH_CHAIN_SELECTOR = 5_009_297_550_715_157_269;
    uint64 internal constant ARB_CHAIN_SELECTOR = 4_949_039_107_694_359_620;
    address internal constant ENS_PUBLIC_RESOLVER = 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63;
    bytes32 internal constant BASE_NODE = 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;
    /// @dev The block of the live sender's first registration.
    uint256 internal constant SENDER_FIRST_LOG_BLOCK = 433_714_702;
    bytes32 internal constant SUPPORT_REF = keccak256("fork proof: lost passkey");
    /// @dev Stands in for the passkey directory's signing key.
    uint256 internal constant DIRECTORY_KEY = uint256(keccak256("fork proof: directory signer"));

    ILogCheats internal constant LOGS = ILogCheats(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal arbFork;
    uint256 internal ethFork;
    /// @dev The Arbitrum fork's own height. On an Arbitrum fork `block.number` is the L1 height.
    uint256 internal arbHeight;
    GreenGoodsENSRegistrar internal registrar;
    IGreenGoodsENSRegistrar.ImportedName[] internal liveNames;

    function testCutover_registrarTakesOverTheLiveSenderAndRecoversAMemberName() public {
        // Skipped, never passed, without both forks or the live sender's event history.
        if (!_tryDualFork()) ISkipCheat(address(vm)).skip(true);
        vm.selectFork(arbFork);
        if (!_readLiveNames()) ISkipCheat(address(vm)).skip(true);
        vm.makePersistent(address(this));

        // ── Arbitrum: carry every live name over ──
        registrar = GreenGoodsENSRegistrar(
            payable(address(
                    new ERC1967Proxy(
                        address(new GreenGoodsENSRegistrar()),
                        abi.encodeCall(
                            GreenGoodsENSRegistrar.initialize,
                            (ARB_CCIP_ROUTER, ETH_CHAIN_SELECTOR, LIVE_RECEIVER, address(this))
                        )
                    )
                ))
        );
        registrar.importNames(liveNames);
        registrar.finishImport();

        uint256 members;
        address lostAccount;
        string memory memberSlug;
        for (uint256 i; i < liveNames.length; ++i) {
            IGreenGoodsENSRegistrar.ImportedName memory name = liveNames[i];
            bytes32 slugHash = keccak256(bytes(name.slug));
            assertEq(registrar.slugOwner(slugHash), ILiveSender(LIVE_SENDER).slugOwner(slugHash), "owner carried over");
            assertEq(
                uint8(registrar.slugNameType(slugHash)),
                ILiveSender(LIVE_SENDER).slugNameType(slugHash),
                "name type carried over: a garden imported as a member name could be released"
            );
            assertEq(registrar.ownerToSlug(name.owner), name.slug, "name carried over");
            assertFalse(registrar.available(name.slug));
            if (name.nameType == IGreenGoodsENSRegistrar.NameType.Gardener) {
                ++members;
                lostAccount = name.owner;
                memberSlug = name.slug;
            }
        }
        assertGe(liveNames.length, 28, "the live sender held at least 28 names when this proof was written");
        assertGt(members, 0, "the live sender holds member names");

        // ── Arbitrum: the garden token follows the registrar, and a mint-time registration
        //    goes out through the real CCIP router ──
        vm.prank(IOwned(GARDEN_TOKEN).owner());
        IGardenTokenENS(GARDEN_TOKEN).setENSModule(address(registrar));
        assertEq(IGardenTokenENS(GARDEN_TOKEN).ensModule(), address(registrar));
        registrar.setAuthorizedCaller(GARDEN_TOKEN, true);
        // This registration only proves the real router takes the message; it is not delivered to L1 below.
        address newGarden = makeAddr("fork proof garden account");
        uint256 gardenFee =
            registrar.getRegistrationFee("fork-proof-garden", newGarden, IGreenGoodsENSRegistrar.NameType.Garden);
        assertGt(gardenFee, 0, "the real router quotes a fee");
        vm.deal(GARDEN_TOKEN, gardenFee);
        vm.prank(GARDEN_TOKEN);
        registrar.registerGarden{ value: gardenFee }("fork-proof-garden", newGarden);
        assertEq(registrar.slugOwner(keccak256("fork-proof-garden")), newGarden);

        // ── Arbitrum: an operator releases a member's name, then assigns it to their new account ──
        address newAccount = makeAddr("fork proof new account");
        vm.deal(address(this), 1 ether);
        registrar.adminReleaseName{ value: registrar.getReleaseFee(memberSlug) }(memberSlug, lostAccount, SUPPORT_REF);
        assertEq(registrar.slugOwner(keccak256(bytes(memberSlug))), address(0));
        assertEq(bytes(registrar.ownerToSlug(lostAccount)).length, 0);
        // A garden name stays out of reach of the same path.
        IGreenGoodsENSRegistrar.ImportedName memory gardenName = _firstGarden();
        vm.expectRevert(IGreenGoodsENSRegistrar.CannotReleaseGardenName.selector);
        registrar.adminReleaseName{ value: gardenFee }(gardenName.slug, gardenName.owner, SUPPORT_REF);

        // ── Ethereum: the live receiver follows the registrar and applies both messages ──
        vm.selectFork(ethFork);
        GreenGoodsENSReceiver receiver = GreenGoodsENSReceiver(LIVE_RECEIVER);
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, keccak256(bytes(memberSlug))));
        assertEq(receiver.resolve(memberSlug), lostAccount, "L1 agrees with the sender before the release");
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), lostAccount, "ENS resolves the name to the lost account");

        // Every carried-over name is the name L1 holds, for the same account and of the same type.
        // A row L1 disagrees with would leave the chains split from the first day.
        for (uint256 i; i < liveNames.length; ++i) {
            GreenGoodsENSReceiver.Registration memory onL1 = receiver.getRegistration(liveNames[i].slug);
            assertEq(onL1.owner, liveNames[i].owner, "L1 holds the carried-over name for the same account");
            assertEq(uint8(onL1.nameType), uint8(liveNames[i].nameType), "L1 holds it as the same type");
        }

        vm.prank(receiver.owner());
        receiver.setL2Sender(address(registrar));

        // The retired sender is no longer accepted.
        vm.prank(receiver.getRouter());
        vm.expectRevert(UnauthorizedSender.selector);
        receiver.ccipReceive(_message(LIVE_SENDER, 1, memberSlug, lostAccount));

        vm.prank(receiver.getRouter());
        receiver.ccipReceive(_message(address(registrar), 1, memberSlug, lostAccount));
        assertTrue(receiver.available(memberSlug), "L1 shows the name free after the release");
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), address(0), "ENS no longer resolves the released name");

        // ── Arbitrum: with L1 free, the operator assigns the name without the cooldown ──
        vm.selectFork(arbFork);
        assertFalse(registrar.available(memberSlug), "the released name rests for everyone else");
        registrar.adminAssignName{ value: gardenFee * 2 }(memberSlug, newAccount, SUPPORT_REF);
        assertEq(registrar.ownerToSlug(newAccount), memberSlug);

        // ── Ethereum: the registration lands and ENS resolves to the new account ──
        vm.selectFork(ethFork);
        vm.prank(receiver.getRouter());
        receiver.ccipReceive(_message(address(registrar), 0, memberSlug, newAccount));
        assertEq(receiver.resolve(memberSlug), newAccount, "L1 registration follows the assignment");
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), newAccount, "ENS resolves the name to the new account");

        _memberRegistersTheirDirectoryUsername(lostAccount, receiver);
    }

    /// @dev The registrar's proxy is upgraded to the member-names implementation, as the live one
    /// would be. The account that lost its name above is still a garden member under the live
    /// hat: it registers the username the directory vouches for, paid from the reserve, and
    /// cannot register any other.
    function _memberRegistersTheirDirectoryUsername(address account, GreenGoodsENSReceiver receiver) internal {
        vm.selectFork(arbFork);
        registrar.upgradeTo(address(new GreenGoodsENSMemberNames()));
        GreenGoodsENSMemberNames names = GreenGoodsENSMemberNames(payable(address(registrar)));
        assertEq(names.ownerToSlug(liveNames[0].owner), liveNames[0].slug, "carried-over names survive the upgrade");
        _configureClaimsWithTheLiveHat(names, account);

        string memory username = "fork-proof-returning-member";
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory grant = _directoryGrant(names, account, username, deadline);

        // A name the directory did not vouch for is refused, as is an account that joined no garden.
        vm.prank(account);
        vm.expectRevert(IGreenGoodsENSMemberNames.InvalidNameGrant.selector);
        names.claimName("some-other-name", deadline, grant);
        address outsider = makeAddr("fork proof outsider");
        bytes memory outsiderGrant = _directoryGrant(names, outsider, "outsider-name", deadline);
        vm.prank(outsider);
        vm.expectRevert(IGreenGoodsENSMemberNames.NotProtocolMember.selector);
        names.claimName("outsider-name", deadline, outsiderGrant);

        // The reserve pays through the real router; the member's account sends no ETH.
        uint256 fee = names.getRegistrationFee(username, account, IGreenGoodsENSRegistrar.NameType.Gardener);
        vm.deal(address(names), fee * 2);
        vm.prank(account);
        names.claimName(username, deadline, grant);
        assertEq(names.ownerToSlug(account), username);
        assertEq(address(names).balance, fee, "the reserve paid exactly the quoted fee");
        assertTrue(names.sponsoredClaimUsed(account));

        vm.selectFork(ethFork);
        vm.prank(receiver.getRouter());
        receiver.ccipReceive(_message(address(names), 0, username, account));
        assertEq(receiver.resolve(username), account, "L1 registers the member's username");
        assertEq(
            IENSResolver(ENS_PUBLIC_RESOLVER).addr(keccak256(abi.encodePacked(BASE_NODE, keccak256(bytes(username))))),
            account,
            "ENS resolves the username to the member"
        );
    }

    function _configureClaimsWithTheLiveHat(GreenGoodsENSMemberNames names, address account) internal {
        address liveHats = ILiveSender(LIVE_SENDER).HATS();
        uint256 liveHat = ILiveSender(LIVE_SENDER).protocolHatId();
        names.setMembershipHat(liveHats, liveHat);
        names.setNameAttestor(vm.addr(DIRECTORY_KEY));
        names.setSponsorship(5, 5, 0.01 ether);
        (bool ok, bytes memory wears) =
            liveHats.staticcall(abi.encodeWithSignature("isWearerOfHat(address,uint256)", account, liveHat));
        assertTrue(ok && abi.decode(wears, (bool)), "the account still wears the live garden-member hat");
    }

    function _directoryGrant(
        GreenGoodsENSMemberNames names,
        address account,
        string memory username,
        uint256 deadline
    )
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DIRECTORY_KEY, names.nameGrantDigest(account, username, deadline));
        return abi.encodePacked(r, s, v);
    }

    receive() external payable { }

    function _message(
        address sender,
        uint8 action,
        string memory slug,
        address holder
    )
        internal
        pure
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage({
            messageId: keccak256(abi.encode("fork proof", action, slug, holder)),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(sender),
            data: abi.encode(action, slug, holder, IGreenGoodsENSRegistrar.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _firstGarden() internal view returns (IGreenGoodsENSRegistrar.ImportedName memory) {
        for (uint256 i; i < liveNames.length; ++i) {
            if (liveNames[i].nameType == IGreenGoodsENSRegistrar.NameType.Garden) return liveNames[i];
        }
        revert("no garden name on the live sender");
    }

    /// @dev The migration manifest, rebuilt from the live sender's registration events and checked
    /// row by row against its current state. The sender's mappings cannot be listed on chain, so
    /// the events are the only inventory; a name released since would fail the reconciliation.
    function _readLiveNames() internal returns (bool) {
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("NameRegistrationSent(bytes32,string,address,uint8,uint256)");
        ILogCheats.EthGetLogs[] memory logs;
        try LOGS.eth_getLogs(SENDER_FIRST_LOG_BLOCK, arbHeight, LIVE_SENDER, topics) returns (
            ILogCheats.EthGetLogs[] memory found
        ) {
            logs = found;
        } catch {
            return false;
        }
        if (logs.length == 0) return false;

        for (uint256 i; i < logs.length; ++i) {
            (string memory slug, uint8 nameType,) = abi.decode(logs[i].data, (string, uint8, uint256));
            address holder = address(uint160(uint256(logs[i].topics[2])));
            bytes32 slugHash = keccak256(bytes(slug));
            assertEq(ILiveSender(LIVE_SENDER).slugOwner(slugHash), holder, "event and live owner agree");
            assertEq(ILiveSender(LIVE_SENDER).slugNameType(slugHash), nameType, "event and live type agree");
            assertEq(ILiveSender(LIVE_SENDER).ownerToSlug(holder), slug, "event and live name agree");
            liveNames.push(
                IGreenGoodsENSRegistrar.ImportedName({
                    slug: slug, owner: holder, nameType: IGreenGoodsENSRegistrar.NameType(nameType)
                })
            );
        }
        return true;
    }

    function _tryDualFork() internal returns (bool) {
        string memory arbRpc = _env("ARBITRUM_FORK_RPC_URL", "ARBITRUM_RPC_URL");
        string memory ethRpc = _env("ETHEREUM_FORK_RPC_URL", "ETHEREUM_RPC_URL");
        if (bytes(arbRpc).length == 0 || bytes(ethRpc).length == 0) return false;
        // Its own pins: the shared fork pins predate the live receiver and most of the live names.
        uint256 arbBlock = _envBlock("ENS_REGISTRAR_ARBITRUM_FORK_BLOCK_NUMBER");
        uint256 ethBlock = _envBlock("ENS_REGISTRAR_ETHEREUM_FORK_BLOCK_NUMBER");
        arbFork = arbBlock == 0 ? vm.createFork(arbRpc) : vm.createFork(arbRpc, arbBlock);
        ethFork = ethBlock == 0 ? vm.createFork(ethRpc) : vm.createFork(ethRpc, ethBlock);
        arbHeight = arbBlock;
        if (arbHeight == 0) {
            vm.selectFork(arbFork);
            bytes memory head = LOGS.rpc("eth_blockNumber", "[]");
            for (uint256 i; i < head.length; ++i) {
                arbHeight = (arbHeight << 8) | uint8(head[i]);
            }
        }
        return true;
    }

    function _env(string memory primary, string memory fallbackName) internal view returns (string memory) {
        try vm.envString(primary) returns (string memory value) {
            if (bytes(value).length > 0) return value;
        } catch { }
        try vm.envString(fallbackName) returns (string memory value) {
            return value;
        } catch {
            return "";
        }
    }

    function _envBlock(string memory name) internal view returns (uint256) {
        try vm.envUint(name) returns (uint256 value) {
            return value;
        } catch {
            return 0;
        }
    }
}
