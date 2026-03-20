// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { stdJson } from "forge-std/StdJson.sol";

import { GreenGoodsENSReceiver } from "../src/registries/ENSReceiver.sol";
import { GreenGoodsENS } from "../src/registries/ENS.sol";
import { IENS, INameWrapper } from "../src/interfaces/IENS.sol";

/// @title UpgradeENSReceiver
/// @notice Redeploys GreenGoodsENSReceiver with NameWrapper support and re-wires the ENS integration.
/// @dev ENSReceiver is NOT a UUPS proxy — it must be redeployed, then cross-references updated.
///
///  Usage (Sepolia — same-chain, unwrapped):
///    forge script script/UpgradeENSReceiver.s.sol:UpgradeENSReceiver --sig "deploySepolia()" --rpc-url $SEPOLIA_RPC_URL
///
///  Usage (Mainnet — cross-chain, wrapped):
///    forge script script/UpgradeENSReceiver.s.sol:UpgradeENSReceiver --sig "deployMainnet()" --rpc-url $MAINNET_RPC_URL
///
///  Usage (Arbitrum — update l1Receiver after mainnet deploy):
///    forge script script/UpgradeENSReceiver.s.sol:UpgradeENSReceiver \
///      --sig "updateL1Receiver(address)" <NEW_RECEIVER> --rpc-url $ARBITRUM_RPC_URL
contract UpgradeENSReceiver is Script {
    using stdJson for string;

    // namehash("greengoods.eth")
    bytes32 constant BASE_NODE = 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;

    // ═══════════════════════════════════════════════════════
    // Sepolia: same-chain, unwrapped
    // ═══════════════════════════════════════════════════════

    /// @notice Redeploy ENSReceiver on Sepolia with the existing LocalCCIPRouter.
    ///         Re-wires sender ↔ receiver and sets ENS approval in one transaction.
    /// @dev IMPORTANT: The sender's CCIP_ROUTER is immutable — the new receiver MUST use
    ///      the same router, otherwise the onlyRouter modifier will reject CCIP messages.
    function deploySepolia() public {
        string memory json = _loadDeployment(11_155_111);
        string memory networkJson = _loadNetworkConfig("sepolia");

        address oldReceiver = json.readAddress(".ensReceiver");
        address greenGoodsENS = json.readAddress(".greenGoodsENS");
        address rootGarden = json.readAddress(".rootGarden.address");

        string memory bp = ".networks.sepolia";
        address ensRegistry = networkJson.readAddress(string.concat(bp, ".contracts.ensRegistry"));
        address ensResolver = networkJson.readAddress(string.concat(bp, ".contracts.ensResolver"));

        // Read the existing CCIP router from the sender — MUST reuse it (immutable in sender)
        address existingRouter = address(GreenGoodsENS(payable(greenGoodsENS)).CCIP_ROUTER());
        uint64 chainSelector = GreenGoodsENS(payable(greenGoodsENS)).ETHEREUM_CHAIN_SELECTOR();

        console.log("=== Sepolia ENSReceiver Migration ===");
        console.log("Old receiver:", oldReceiver);
        console.log("GreenGoodsENS (sender):", greenGoodsENS);
        console.log("Existing CCIP Router:", existingRouter);
        console.log("Root garden:", rootGarden);
        console.log("ENS Registry:", ensRegistry);
        console.log("ENS Resolver:", ensResolver);

        vm.startBroadcast();

        // 1. Deploy new ENSReceiver reusing existing router (sender's CCIP_ROUTER is immutable)
        GreenGoodsENSReceiver newReceiver = new GreenGoodsENSReceiver(
            existingRouter, // MUST match sender's immutable CCIP_ROUTER
            chainSelector,
            greenGoodsENS, // l2Sender (same chain on Sepolia)
            ensRegistry,
            ensResolver,
            BASE_NODE,
            msg.sender,
            address(0) // nameWrapper: unwrapped
        );
        console.log("New ENSReceiver deployed:", address(newReceiver));

        // 2. Approve new receiver as ENS operator
        IENS(ensRegistry).setApprovalForAll(address(newReceiver), true);
        console.log("ENS Registry approval: granted");

        // 3. Update l1Receiver on the sender (same chain on Sepolia)
        GreenGoodsENS(payable(greenGoodsENS)).setL1Receiver(address(newReceiver));
        console.log("GreenGoodsENS.l1Receiver updated to:", address(newReceiver));

        // 4. Re-register root garden slug on new receiver
        if (rootGarden != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try newReceiver.adminRegister("community", rootGarden, GreenGoodsENSReceiver.NameType.Garden) {
                console.log("Root garden 'community' slug migrated");
            } catch {
                console.log("WARNING: Root garden slug migration failed (may already exist)");
            }
        }

        vm.stopBroadcast();

        _printResult(address(newReceiver));
    }

    // ═══════════════════════════════════════════════════════
    // Mainnet: cross-chain, wrapped (NameWrapper)
    // ═══════════════════════════════════════════════════════

    /// @notice Redeploy ENSReceiver on Ethereum mainnet with NameWrapper support.
    ///         After this, run updateL1Receiver() on Arbitrum to complete the wiring.
    function deployMainnet() public {
        string memory json = _loadDeployment(1);
        string memory networkJson = _loadNetworkConfig("mainnet");

        address oldReceiver = json.readAddress(".ensReceiver");

        string memory bp = ".networks.mainnet";
        address ensRegistry = networkJson.readAddress(string.concat(bp, ".contracts.ensRegistry"));
        address ensResolver = networkJson.readAddress(string.concat(bp, ".contracts.ensResolver"));
        address ccipRouter = networkJson.readAddress(string.concat(bp, ".contracts.ccipRouter"));
        address nameWrapper = networkJson.readAddress(string.concat(bp, ".contracts.nameWrapper"));

        // L2 sender from env (Arbitrum GreenGoodsENS address)
        address l2Sender;
        try vm.envAddress("ENS_L2_SENDER") returns (address parsed) {
            l2Sender = parsed;
        } catch {
            // Not set — try loading from Arbitrum deployment
        }
        if (l2Sender == address(0)) {
            // Try loading from Arbitrum deployment
            try vm.readFile(_deploymentPath(42_161)) returns (string memory arbJson) {
                l2Sender = stdJson.readAddress(arbJson, ".greenGoodsENS");
            } catch {
                // Will be set post-deploy
            }
        }

        // Arbitrum chain selector (source chain for CCIP messages)
        uint64 arbitrumChainSelector = 4_949_039_107_694_359_620;

        console.log("=== Mainnet ENSReceiver Migration ===");
        console.log("Old receiver:", oldReceiver);
        console.log("L2 Sender (Arbitrum GreenGoodsENS):", l2Sender);
        console.log("ENS Registry:", ensRegistry);
        console.log("ENS Resolver:", ensResolver);
        console.log("NameWrapper:", nameWrapper);
        console.log("CCIP Router:", ccipRouter);

        vm.startBroadcast();

        // 1. Deploy new ENSReceiver with NameWrapper
        GreenGoodsENSReceiver newReceiver = new GreenGoodsENSReceiver(
            ccipRouter, arbitrumChainSelector, l2Sender, ensRegistry, ensResolver, BASE_NODE, msg.sender, nameWrapper
        );
        console.log("New ENSReceiver deployed:", address(newReceiver));

        // 2. Approve receiver on NameWrapper (deployer must be wrapped owner of greengoods.eth)
        if (nameWrapper != address(0)) {
            INameWrapper(nameWrapper).setApprovalForAll(address(newReceiver), true);
            console.log("NameWrapper approval: granted");
        } else {
            IENS(ensRegistry).setApprovalForAll(address(newReceiver), true);
            console.log("ENS Registry approval: granted");
        }

        vm.stopBroadcast();

        _printResult(address(newReceiver));

        if (l2Sender == address(0)) {
            console.log("");
            console.log("WARNING: l2Sender not set. After deploying, run:");
            console.log(
                "  cast send <NEW_RECEIVER> 'setL2Sender(address)' <ARBITRUM_GREENGOODS_ENS> --rpc-url $MAINNET_RPC_URL"
            );
        }

        console.log("");
        console.log("NEXT STEP: Update l1Receiver on Arbitrum:");
        console.log(
            "  bun script/upgrade-ens-receiver.ts update-l1-receiver --network arbitrum --new-receiver",
            address(newReceiver)
        );
    }

    // ═══════════════════════════════════════════════════════
    // L2: Update l1Receiver on GreenGoodsENS
    // ═══════════════════════════════════════════════════════

    /// @notice Update the l1Receiver address on the L2 GreenGoodsENS contract.
    /// @param newReceiver The new ENSReceiver address on L1 (Ethereum mainnet)
    function updateL1Receiver(address newReceiver) public {
        require(newReceiver != address(0), "Zero address");

        string memory json = _loadDeployment(block.chainid);
        address greenGoodsENS = json.readAddress(".greenGoodsENS");

        console.log("=== Update L1 Receiver ===");
        console.log("Chain:", block.chainid);
        console.log("GreenGoodsENS:", greenGoodsENS);
        console.log("Current l1Receiver:", GreenGoodsENS(payable(greenGoodsENS)).l1Receiver());
        console.log("New l1Receiver:", newReceiver);

        vm.startBroadcast();
        GreenGoodsENS(payable(greenGoodsENS)).setL1Receiver(newReceiver);
        vm.stopBroadcast();

        console.log("l1Receiver updated successfully");
    }

    // ═══════════════════════════════════════════════════════
    // Migration: re-register slugs on new receiver
    // ═══════════════════════════════════════════════════════

    /// @notice Migrate registrations from old receiver to new receiver via adminRegister.
    /// @param newReceiver Address of the newly deployed ENSReceiver
    /// @param slugs Array of slugs to migrate
    /// @param owners Array of owner addresses (parallel to slugs)
    /// @param nameTypes Array of name types: 0 = Gardener, 1 = Garden (parallel to slugs)
    function migrateRegistrations(
        address newReceiver,
        string[] calldata slugs,
        address[] calldata owners,
        uint8[] calldata nameTypes
    )
        public
    {
        require(slugs.length == owners.length && slugs.length == nameTypes.length, "Array length mismatch");

        console.log("=== Migrate Registrations ===");
        console.log("Target receiver:", newReceiver);
        console.log("Registrations to migrate:", slugs.length);

        vm.startBroadcast();

        uint256 success;
        uint256 skipped;

        for (uint256 i = 0; i < slugs.length; i++) {
            // solhint-disable-next-line no-empty-blocks
            try GreenGoodsENSReceiver(newReceiver).adminRegister(
                slugs[i], owners[i], GreenGoodsENSReceiver.NameType(nameTypes[i])
            ) {
                console.log("  Migrated:", slugs[i], "->", owners[i]);
                success++;
            } catch {
                console.log("  Skipped (already exists?):", slugs[i]);
                skipped++;
            }
        }

        vm.stopBroadcast();

        console.log("Migration complete. Migrated:", success);
        console.log("Skipped:", skipped);
    }

    /// @notice Migrate registrations from a JSON file with { slugs, owners, nameTypes } arrays.
    /// @dev This keeps the CLI path deterministic and avoids shell-encoding dynamic arrays.
    function migrateRegistrationsFromFile(address newReceiver, string calldata filePath) external {
        string memory json = vm.readFile(filePath);
        string[] memory slugs = abi.decode(vm.parseJson(json, ".slugs"), (string[]));
        address[] memory owners = abi.decode(vm.parseJson(json, ".owners"), (address[]));
        uint256[] memory rawNameTypes = abi.decode(vm.parseJson(json, ".nameTypes"), (uint256[]));

        require(slugs.length == owners.length && slugs.length == rawNameTypes.length, "Array length mismatch");

        uint8[] memory nameTypes = new uint8[](rawNameTypes.length);
        for (uint256 i = 0; i < rawNameTypes.length; i++) {
            require(rawNameTypes[i] <= type(uint8).max, "Invalid name type");
            nameTypes[i] = uint8(rawNameTypes[i]);
        }

        this.migrateRegistrations(newReceiver, slugs, owners, nameTypes);
    }

    // ═══════════════════════════════════════════════════════
    // Internal helpers
    // ═══════════════════════════════════════════════════════

    function _deploymentPath(uint256 chainId) internal view returns (string memory) {
        return string.concat(vm.projectRoot(), "/deployments/", vm.toString(chainId), "-latest.json");
    }

    function _loadDeployment(uint256 chainId) internal view returns (string memory) {
        return vm.readFile(_deploymentPath(chainId));
    }

    function _loadNetworkConfig(string memory /* networkName */ ) internal view returns (string memory) {
        string memory p = string.concat(vm.projectRoot(), "/deployments/networks.json");
        return vm.readFile(p);
    }

    function _printResult(address newReceiver) internal view {
        console.log("");
        console.log("=== DEPLOYMENT RESULT ===");
        console.log("New ENSReceiver:", newReceiver);
        console.log("");
        console.log("Update deployments/{chainId}-latest.json:");
        console.log("  ensReceiver:", newReceiver);
    }
}
