// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IHatsSignerGateV2, IModuleProxyFactory, IStewardSafe } from "../../src/interfaces/IHatsSignerGateV2.sol";

interface IRewardSafeGate {
    function safe() external view returns (address);
    function ownerHat() external view returns (uint256);
    function locked() external view returns (bool);
    function claimableFor() external view returns (bool);
    function isValidSignerHat(uint256 hat) external view returns (bool);
    function enabledDelegatecallTargets(address target) external view returns (bool);
    function claimSigner(uint256 hat) external;
    function removeSigner(address signer) external;
}

interface IRewardSafe {
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function nonce() external view returns (uint256);
    function approveHash(bytes32 hash) external;
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 nonce
    )
        external
        view
        returns (bytes32);
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    )
        external
        payable
        returns (bool);
}

interface IGardenHats {
    function getGardenHatIds(address garden)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool);
}

interface IRewardPayerLive {
    struct Share {
        uint256 promiseChainId;
        address promiseModule;
        uint256 commitmentId;
        address token;
        address recipient;
        uint256 amount;
    }

    function payAll(Share[] calldata shares) external returns (bytes32[] memory);
    function paidBy(bytes32 shareId) external view returns (address);
    function shareIdOf(Share calldata share) external pure returns (bytes32);
}

interface IUsdc {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @dev Rehearses a garden's reward Safe on Arbitrum One with the published Hats, Hats Signer Gate
///      v2, Safe and RewardPayer binaries: one factory call creates a locked gate and its Safe for
///      Tech and Sun's real steward hat, and the Safe pays shares through the deployed payer the way
///      the Hub builds the payment (MultiSendCallOnly 1.4.1: approve the exact total, then payAll).
///      Stewards are fictional accounts mocked as wearers of the steward hat; nothing live is sent.
contract ArbitrumRewardSafeForkTest is Test {
    address private constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address private constant HSG_IMPLEMENTATION = 0x148057884AC910Bdd93693F230C5c35a8c47CA3b;
    address private constant MODULE_FACTORY = 0x000000000000aDdB49795b0f9bA5BC298cDda236;
    address private constant CALL_ONLY_MULTISEND = 0x9641d764fc13c8B624c04430C7356C1C7C8102e2;
    address private constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address private constant PAYER = 0xEd1244F2c65f5Ddd052912Dd3F6E52A7f22F2829;
    address private constant HATS_MODULE = 0x5b943088ecdDBF8E4ae387348A88A654aC5F7266;
    address private constant POOLING = 0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a;
    address private constant DEPLOYER = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address private constant TECH_AND_SUN = 0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3;
    /// @dev Where `release reward-safes` predicts Tech and Sun's gate: the factory's CREATE2 over this setup.
    address private constant PLANNED_GATE = 0x0BF6DB5F18962B54b6EAF13bAc1aaFCCF7FDD431;
    address private constant DELEGATING_MULTISEND = 0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526;
    /// @dev FiatToken v2.2 keeps each balance in the low bits of `balanceAndBlacklistStates`.
    uint256 private constant USDC_BALANCE_SLOT = 9;

    IRewardSafeGate private gate;
    IRewardSafe private safe;
    uint256 private ownerHat;
    uint256 private stewardHat;
    address private immutable stewardA = vm.addr(0xA11CE);
    address private immutable stewardB = vm.addr(0xB0B);
    address private constant RECIPIENT_ONE = address(0x7001);
    address private constant RECIPIENT_TWO = address(0x7002);

    function setUp() public {
        string memory rpc = "https://arb1.arbitrum.io/rpc";
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory configured) {
            rpc = configured;
        } catch { }
        // The public RPC keeps no archive state, so fork at the head unless a block is pinned.
        uint256 forkBlock;
        try vm.envUint("ARBITRUM_FORK_BLOCK") returns (uint256 pinned) {
            forkBlock = pinned;
        } catch { }
        if (forkBlock == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, forkBlock);
        assertEq(block.chainid, 42_161);
        assertGt(PAYER.code.length, 0, "fork from after the payer's deploy block 526958954");
        (ownerHat, stewardHat,,,,,,) = IGardenHats(HATS_MODULE).getGardenHatIds(TECH_AND_SUN);
        uint256[] memory signerHats = new uint256[](1);
        signerHats[0] = stewardHat;
        IHatsSignerGateV2.SetupParams memory params = IHatsSignerGateV2.SetupParams({
            ownerHat: ownerHat,
            signerHats: signerHats,
            safe: address(0),
            thresholdConfig: IHatsSignerGateV2.ThresholdConfig(0, 1, 2),
            locked: true,
            claimableFor: true,
            implementation: HSG_IMPLEMENTATION,
            hsgGuard: address(0),
            hsgModules: new address[](0)
        });
        uint256 saltNonce = uint256(keccak256(abi.encode("GG_GARDEN_REWARD_SAFE_V1", uint256(42_161), TECH_AND_SUN)));
        vm.prank(DEPLOYER);
        gate = IRewardSafeGate(
            IModuleProxyFactory(MODULE_FACTORY)
                .deployModule(HSG_IMPLEMENTATION, abi.encodeWithSignature("setUp(bytes)", abi.encode(params)), saltNonce)
        );
        assertEq(address(gate), PLANNED_GATE, "the release plan's predicted gate");
        safe = IRewardSafe(gate.safe());
    }

    function testArbitrumRewardSafe_createsALockedHatGatedSafeThatBatchesOnlyThroughCallOnlyMultisend() public {
        address[] memory owners = safe.getOwners();
        assertEq(owners.length, 1);
        assertEq(owners[0], address(gate), "the gate holds the only seat until a steward claims one");
        assertEq(safe.getThreshold(), 1);
        assertTrue(gate.locked());
        assertTrue(gate.claimableFor());
        assertEq(gate.ownerHat(), ownerHat);
        assertTrue(gate.isValidSignerHat(stewardHat));
        assertTrue(gate.enabledDelegatecallTargets(CALL_ONLY_MULTISEND));
        assertFalse(gate.enabledDelegatecallTargets(DELEGATING_MULTISEND));
        assertTrue(IStewardSafe(address(safe)).isOwner(address(gate)));
    }

    function testArbitrumRewardSafe_aLoneStewardPaysEveryShareExactlyAndLeavesNothingApproved() public {
        _wearStewardHat(stewardA, true);
        vm.prank(stewardA);
        gate.claimSigner(stewardHat);
        assertEq(safe.getOwners()[0], stewardA);
        assertEq(safe.getThreshold(), 1);
        _fundSafe(20e6);

        (bytes memory data, IRewardPayerLive.Share[] memory shares) = _payment(12e6, 8e6);
        vm.prank(stewardA);
        assertTrue(_exec(data, _signatures(stewardA, address(0))));

        assertEq(IUsdc(USDC).balanceOf(RECIPIENT_ONE), 12e6);
        assertEq(IUsdc(USDC).balanceOf(RECIPIENT_TWO), 8e6);
        assertEq(IUsdc(USDC).balanceOf(address(safe)), 0);
        assertEq(IUsdc(USDC).allowance(address(safe), PAYER), 0);
        for (uint256 i; i < shares.length; ++i) {
            assertEq(IRewardPayerLive(PAYER).paidBy(IRewardPayerLive(PAYER).shareIdOf(shares[i])), address(safe));
        }
    }

    function testArbitrumRewardSafe_twoStewardsNeedBothAndTheSecondRunsItWithTheFirstsApproval() public {
        _seat(stewardA);
        _seat(stewardB);
        assertEq(safe.getThreshold(), 2);
        _fundSafe(20e6);
        (bytes memory data,) = _payment(12e6, 8e6);

        // One steward alone can't pay once there are two.
        vm.prank(stewardA);
        vm.expectRevert();
        _exec(data, _signatures(stewardA, address(0)));

        bytes32 hash = _hash(data);
        vm.prank(stewardA);
        safe.approveHash(hash);
        vm.prank(stewardB);
        assertTrue(_exec(data, _signatures(stewardA, stewardB)));
        assertEq(IUsdc(USDC).balanceOf(RECIPIENT_ONE), 12e6);
        assertEq(IUsdc(USDC).balanceOf(RECIPIENT_TWO), 8e6);
    }

    function testArbitrumRewardSafe_aSignerWhoLeftTheStewardHatBlocksPaymentUntilAnyoneRemovesThem() public {
        _seat(stewardA);
        _seat(stewardB);
        _fundSafe(20e6);
        (bytes memory data,) = _payment(12e6, 8e6);
        _wearStewardHat(stewardB, false);

        // The stale signer still counts towards the threshold, and their approval no longer counts.
        bytes32 hash = _hash(data);
        vm.prank(stewardB);
        safe.approveHash(hash);
        vm.prank(stewardA);
        vm.expectRevert();
        _exec(data, _signatures(stewardA, stewardB));
        vm.prank(stewardA);
        vm.expectRevert();
        _exec(data, _signatures(stewardA, address(0)));

        // Anyone removes them, and the remaining steward pays alone.
        vm.prank(address(0xBEEF));
        gate.removeSigner(stewardB);
        assertEq(safe.getThreshold(), 1);
        vm.prank(stewardA);
        assertTrue(_exec(data, _signatures(stewardA, address(0))));
        assertEq(IUsdc(USDC).balanceOf(RECIPIENT_ONE), 12e6);
    }

    function _seat(address steward) private {
        _wearStewardHat(steward, true);
        vm.prank(steward);
        gate.claimSigner(stewardHat);
    }

    function _wearStewardHat(address account, bool wearing) private {
        vm.mockCall(
            HATS, abi.encodeWithSignature("isWearerOfHat(address,uint256)", account, stewardHat), abi.encode(wearing)
        );
    }

    function _fundSafe(uint256 amount) private {
        vm.store(USDC, keccak256(abi.encode(address(safe), USDC_BALANCE_SLOT)), bytes32(amount));
        assertEq(IUsdc(USDC).balanceOf(address(safe)), amount, "USDC balance slot");
    }

    /// @dev The Hub's payment: MultiSendCallOnly runs approve(payer, total), then payAll(shares).
    function _payment(
        uint256 first,
        uint256 second
    )
        private
        pure
        returns (bytes memory data, IRewardPayerLive.Share[] memory shares)
    {
        shares = new IRewardPayerLive.Share[](2);
        shares[0] = IRewardPayerLive.Share(42_161, POOLING, 19, USDC, RECIPIENT_ONE, first);
        shares[1] = IRewardPayerLive.Share(42_161, POOLING, 19, USDC, RECIPIENT_TWO, second);
        bytes memory approve = abi.encodeCall(IUsdc.approve, (PAYER, first + second));
        bytes memory payAll = abi.encodeCall(IRewardPayerLive.payAll, (shares));
        bytes memory packed = abi.encodePacked(
            uint8(0), USDC, uint256(0), approve.length, approve, uint8(0), PAYER, uint256(0), payAll.length, payAll
        );
        data = abi.encodeWithSignature("multiSend(bytes)", packed);
    }

    function _hash(bytes memory data) private view returns (bytes32) {
        return safe.getTransactionHash(CALL_ONLY_MULTISEND, 0, data, 1, 0, 0, 0, address(0), address(0), safe.nonce());
    }

    function _exec(bytes memory data, bytes memory signatures) private returns (bool) {
        return safe.execTransaction(CALL_ONLY_MULTISEND, 0, data, 1, 0, 0, 0, address(0), payable(address(0)), signatures);
    }

    /// @dev Pre-validated signatures in ascending owner order: the owner as r, no s, v of 1.
    function _signatures(address first, address second) private pure returns (bytes memory) {
        if (second == address(0)) return _approved(first);
        return uint160(first) < uint160(second)
            ? bytes.concat(_approved(first), _approved(second))
            : bytes.concat(_approved(second), _approved(first));
    }

    function _approved(address owner) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(0), uint8(1));
    }
}
