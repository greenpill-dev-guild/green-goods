// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { stdJson } from "forge-std/StdJson.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IGoodDollarToken } from "../../src/interfaces/IZodiacRoles.sol";

interface IPersonalServiceDepositSafe {
    function VERSION() external view returns (string memory);
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function isOwner(address account) external view returns (bool);
    function isModuleEnabled(address account) external view returns (bool);
    function nonce() external view returns (uint256);
}

/// @notice Canonical Celo G$ incoming transfer and existing Safe conformance on a fixed fork.
/// @dev Every transfer is a local fork mutation. The publicly configured protocol Safe is
///      impersonated only to seed a fictional depositor from its actual pinned inventory; the
///      Garden Safe only receives the deposit. No private key, signature, live authorization or
///      member signing is proved. No token balance/code/storage is fabricated. Vm.Log has no mined
///      transaction hash or global RPC receipt logIndex; their array positions are local ordinals.
///      This proof supplies token/account behavior, not verified Arbitrum deposit attestations.
contract CeloPersonalServiceDepositForkTest is Test {
    using stdJson for string;

    uint256 private constant CELO_CHAIN_ID = 42_220;
    uint256 private constant CELO_FORK_BLOCK = 75_178_393;
    address private constant CANONICAL_GDOLLAR = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A;
    bytes32 private constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)");
    address private constant FICTIONAL_DEPOSITOR = address(0xF1C710);

    error ForkInventoryUnavailable(address account, uint256 available, uint256 required);
    error ForkFeeConsumesTransfer(uint256 amount, uint256 fee);
    error ForkCanonicalTransferFailed(address from, address to, uint256 amount);
    error InvalidForkSeedHolder(address holder);

    struct DepositObservation {
        uint256 transferCallAmount;
        uint256 fee;
        bool senderPays;
        uint256 grossDebit;
        uint256 receivedAmount;
        uint256 principalCreditAmount;
        uint256 principalRecordedLogOrdinal;
    }

    struct TransferLedger {
        uint256 safeCredits;
        uint256 safeDebits;
        uint256 depositorCredits;
        uint256 depositorDebits;
        uint256 principalCredits;
    }

    IPersonalServiceDepositSafe private gardenSafe;
    address private seedHolder;
    address private garden;
    address[] private recoveryOwners;

    function setUp() public {
        // Mandatory input and exact pin: absence or an inaccessible fork is a visible failure.
        vm.createSelectFork(vm.envString("CELO_RPC_URL"), CELO_FORK_BLOCK);
        assertEq(block.chainid, CELO_CHAIN_ID, "fork must be Celo Mainnet");
        assertEq(block.number, CELO_FORK_BLOCK, "fork block differs from the reviewed pin");
        string memory plan = vm.readFile("./.generated/runtime/42220-garden-roles-proof.json");
        assertEq(plan.readAddress(".canonicalTarget"), CANONICAL_GDOLLAR, "fixture asset is not canonical G$");
        gardenSafe = IPersonalServiceDepositSafe(plan.readAddress(".boundaries[0].safe"));
        // Public configuration provenance, read at the same pinned Celo state. Impersonation is
        // fixture setup only, not evidence that this source authorized a real personal purchase.
        string memory release = vm.readFile("./config/commitment-pooling-release.json");
        seedHolder = release.readAddress(".ownership.protocolSafe");
        if (seedHolder == address(0) || seedHolder == address(gardenSafe)) revert InvalidForkSeedHolder(seedHolder);
        garden = plan.readAddress(".boundaries[0].garden");
        recoveryOwners = plan.readAddressArray(".enable[0].approvers");
        assertGt(CANONICAL_GDOLLAR.code.length, 0, "canonical token has no code");
        assertGt(address(gardenSafe).code.length, 0, "reviewed Garden Safe has no code");
        assertEq(FICTIONAL_DEPOSITOR.code.length, 0, "fictional depositor already has contract code");
        assertEq(IERC20(CANONICAL_GDOLLAR).balanceOf(FICTIONAL_DEPOSITOR), 0, "fictional depositor already has G$");
        emit log_named_uint("fork chain ID", block.chainid);
        emit log_named_uint("fork block", block.number);
        emit log_named_bytes32("canonical G$ runtime code hash (proxy if applicable)", CANONICAL_GDOLLAR.codehash);
        emit log_named_bytes32("existing Garden Safe runtime code hash", address(gardenSafe).codehash);
        emit log("local fork logs have no mined transaction hash or global RPC receipt logIndex");
    }

    function testCeloPersonalServiceDeposit_existingSafeMatchesReviewedOwnershipPolicy() public {
        assertEq(gardenSafe.VERSION(), "1.4.1", "Safe version changed");
        assertEq(gardenSafe.getThreshold(), 2, "Garden Safe threshold changed");
        assertEq(gardenSafe.getOwners().length, 3, "Garden Safe owner count changed");
        assertEq(recoveryOwners.length, 2, "fixture must name both recovery organizations");
        assertTrue(gardenSafe.isOwner(garden), "garden account is not a Safe owner");
        assertTrue(gardenSafe.isOwner(recoveryOwners[0]), "first recovery organization is not a Safe owner");
        assertTrue(gardenSafe.isOwner(recoveryOwners[1]), "second recovery organization is not a Safe owner");
        assertFalse(gardenSafe.isOwner(FICTIONAL_DEPOSITOR), "fictional depositor unexpectedly owns the Safe");
    }

    function testCeloPersonalServiceDeposit_canonicalIncomingTransferSeparatesGrossNetAndLogs() public {
        _seedFictionalDepositor();
        DepositObservation memory observation = _depositAndObserve();
        _logObservation(observation);
    }

    function testCeloPersonalServiceDeposit_incomingTransferGrantsNoSafeSpendingAuthority() public {
        _seedFictionalDepositor();
        uint256 nonceBefore = gardenSafe.nonce();
        uint256 thresholdBefore = gardenSafe.getThreshold();
        bytes32 ownersBefore = keccak256(abi.encode(gardenSafe.getOwners()));
        assertFalse(gardenSafe.isModuleEnabled(FICTIONAL_DEPOSITOR), "fictional depositor already has module authority");
        assertFalse(gardenSafe.isOwner(FICTIONAL_DEPOSITOR), "fictional depositor already has owner authority");
        DepositObservation memory observation = _depositAndObserve();
        assertGt(observation.receivedAmount, 0, "the Safe received no personal deposit");
        assertEq(gardenSafe.nonce(), nonceBefore, "receiving tokens consumed a Safe transaction nonce");
        assertEq(gardenSafe.getThreshold(), thresholdBefore, "receiving tokens changed the Safe threshold");
        assertEq(keccak256(abi.encode(gardenSafe.getOwners())), ownersBefore, "receiving tokens changed Safe owners");
        assertFalse(gardenSafe.isModuleEnabled(FICTIONAL_DEPOSITOR), "incoming tokens granted module authority");
        assertFalse(gardenSafe.isOwner(FICTIONAL_DEPOSITOR), "incoming tokens granted ownership");
    }

    function _seedFictionalDepositor() private {
        uint256 available = IERC20(CANONICAL_GDOLLAR).balanceOf(seedHolder);
        uint256 amount = available / 4;
        if (amount > 1000 ether) amount = 1000 ether;
        if (amount == 0) revert ForkInventoryUnavailable(seedHolder, available, 4);
        (uint256 fee, bool senderPays) =
            IGoodDollarToken(CANONICAL_GDOLLAR).getFees(amount, seedHolder, FICTIONAL_DEPOSITOR);
        if (!senderPays && fee >= amount) revert ForkFeeConsumesTransfer(amount, fee);
        uint256 grossDebit = senderPays ? amount + fee : amount;
        if (grossDebit > available) revert ForkInventoryUnavailable(seedHolder, available, grossDebit);
        emit log("fixture seed uses vm.prank(publicly configured protocolSafe); no real signature or authorization");
        vm.prank(seedHolder);
        if (!IERC20(CANONICAL_GDOLLAR).transfer(FICTIONAL_DEPOSITOR, amount)) {
            revert ForkCanonicalTransferFailed(seedHolder, FICTIONAL_DEPOSITOR, amount);
        }
        uint256 seeded = IERC20(CANONICAL_GDOLLAR).balanceOf(FICTIONAL_DEPOSITOR);
        if (seeded == 0) revert ForkInventoryUnavailable(FICTIONAL_DEPOSITOR, seeded, 1);
    }

    function _depositAndObserve() private returns (DepositObservation memory observation) {
        uint256 depositorBefore = IERC20(CANONICAL_GDOLLAR).balanceOf(FICTIONAL_DEPOSITOR);
        uint256 safeBefore = IERC20(CANONICAL_GDOLLAR).balanceOf(address(gardenSafe));
        observation.transferCallAmount = depositorBefore / 4;
        if (observation.transferCallAmount > 100 ether) observation.transferCallAmount = 100 ether;
        if (observation.transferCallAmount == 0) revert ForkInventoryUnavailable(FICTIONAL_DEPOSITOR, depositorBefore, 4);
        (observation.fee, observation.senderPays) = IGoodDollarToken(CANONICAL_GDOLLAR)
            .getFees(observation.transferCallAmount, FICTIONAL_DEPOSITOR, address(gardenSafe));
        if (!observation.senderPays && observation.fee >= observation.transferCallAmount) {
            revert ForkFeeConsumesTransfer(observation.transferCallAmount, observation.fee);
        }
        uint256 expectedGross =
            observation.senderPays ? observation.transferCallAmount + observation.fee : observation.transferCallAmount;
        uint256 expectedNet =
            observation.senderPays ? observation.transferCallAmount : observation.transferCallAmount - observation.fee;
        if (expectedGross > depositorBefore) {
            revert ForkInventoryUnavailable(FICTIONAL_DEPOSITOR, depositorBefore, expectedGross);
        }
        vm.recordLogs();
        vm.prank(FICTIONAL_DEPOSITOR);
        if (!IERC20(CANONICAL_GDOLLAR).transfer(address(gardenSafe), observation.transferCallAmount)) {
            revert ForkCanonicalTransferFailed(FICTIONAL_DEPOSITOR, address(gardenSafe), observation.transferCallAmount);
        }
        Vm.Log[] memory logs = vm.getRecordedLogs();
        observation.grossDebit = depositorBefore - IERC20(CANONICAL_GDOLLAR).balanceOf(FICTIONAL_DEPOSITOR);
        observation.receivedAmount = IERC20(CANONICAL_GDOLLAR).balanceOf(address(gardenSafe)) - safeBefore;
        assertEq(observation.grossDebit, expectedGross, "actual gross debit differs from canonical fee quote");
        assertEq(observation.receivedAmount, expectedNet, "actual net receipt differs from canonical fee quote");
        _assertTransferAccounting(logs, observation);
    }

    function _assertTransferAccounting(Vm.Log[] memory logs, DepositObservation memory observation) private {
        TransferLedger memory ledger;
        for (uint256 index; index < logs.length; ++index) {
            Vm.Log memory entry = logs[index];
            if (entry.emitter != CANONICAL_GDOLLAR || entry.topics.length != 3 || entry.topics[0] != TRANSFER_TOPIC) {
                continue;
            }
            assertEq(entry.data.length, 32, "canonical Transfer amount has unexpected encoding");
            address from = address(uint160(uint256(entry.topics[1])));
            address to = address(uint160(uint256(entry.topics[2])));
            uint256 amount = abi.decode(entry.data, (uint256));
            if (from == address(gardenSafe)) ledger.safeDebits += amount;
            if (to == address(gardenSafe)) ledger.safeCredits += amount;
            if (from == FICTIONAL_DEPOSITOR) ledger.depositorDebits += amount;
            if (to == FICTIONAL_DEPOSITOR) ledger.depositorCredits += amount;
            if (from == FICTIONAL_DEPOSITOR && to == address(gardenSafe)) {
                ledger.principalCredits++;
                observation.principalCreditAmount = amount;
                observation.principalRecordedLogOrdinal = index;
            }
        }
        assertEq(ledger.principalCredits, 1, "receipt must identify one canonical depositor-to-Safe credit");
        assertGt(observation.principalCreditAmount, 0, "principal credit event records no value");
        assertGe(ledger.safeCredits, ledger.safeDebits, "event ledger does not show a net Safe receipt");
        assertGe(ledger.depositorDebits, ledger.depositorCredits, "event ledger does not show a net depositor debit");
        assertEq(
            ledger.safeCredits - ledger.safeDebits,
            observation.receivedAmount,
            "Transfer events disagree with actual Safe net"
        );
        assertEq(
            ledger.depositorDebits - ledger.depositorCredits,
            observation.grossDebit,
            "Transfer events disagree with actual gross debit"
        );
    }

    function _logObservation(DepositObservation memory observation) private {
        emit log_named_uint("transfer call amount", observation.transferCallAmount);
        emit log_named_uint("canonical quoted fee", observation.fee);
        emit log_named_uint("sender pays fee (1=yes)", observation.senderPays ? 1 : 0);
        emit log_named_uint("actual depositor gross debit", observation.grossDebit);
        emit log_named_uint("actual Safe received net", observation.receivedAmount);
        emit log_named_uint("principal canonical Transfer credit value", observation.principalCreditAmount);
        emit log_named_uint(
            "principal local recorded-log ordinal (not RPC logIndex)", observation.principalRecordedLogOrdinal
        );
        if (observation.fee == 0) {
            emit log("pinned incoming fee quote is zero; this fork case does not prove a nonzero fee branch");
        }
    }
}
