// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";

/// @title Enhanced UUPS Proxy Deployment Script
/// @notice Deploys UUPS proxies for DeploymentRegistry with proper initialization
/// @dev Handles network detection and environment variable configuration
contract DeployProxy is Script {
    /// @notice Custom errors for gas optimization
    error NoImplementationFound();
    error ImplementationCannotBeZero();
    error OwnerCannotBeZero();
    // Configuration addresses

    address internal constant GNOSIS_SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    address internal constant EMERGENCY_GUARDIAN = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6; // GREEN_GOODS_MANAGER
    address internal constant AFO_ETH = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e;

    // Network implementations
    mapping(uint256 chainId => address implementation) public implementations;

    function setUp() public {
        // Set up known implementations
        implementations[42_161] = 0x40F2dBc4992eBAC9Bc6C997517d0Bc1bC051e8A1; // Arbitrum
        implementations[42_220] = 0x115819bCcaab03Be49107c69c00Bc4c21009839C; // Celo
    }

    /// @notice Main deployment function
    function run() external {
        uint256 chainId = block.chainid;
        address implementation = implementations[chainId];

        if (implementation == address(0)) revert NoImplementationFound();

        console.log("Deploying UUPS Proxy on Chain ID:", chainId);
        console.log("Implementation:", implementation);
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        // Encode initialization data for initializeWithSafe
        bytes memory initData = abi.encodeWithSignature(
            "initializeWithSafe(address,address,address)", msg.sender, GNOSIS_SAFE, EMERGENCY_GUARDIAN
        );

        // Deploy ERC1967Proxy with initialization
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);

        vm.stopBroadcast();

        console.log("UUPS Proxy deployed successfully!");
        console.log("   Proxy Address:", address(proxy));
        console.log("   Implementation:", implementation);
        console.log("   Owner:", msg.sender);
        console.log("   Gnosis Safe:", GNOSIS_SAFE);
        console.log("   Emergency Guardian:", EMERGENCY_GUARDIAN);

        // Verify initialization
        DeploymentRegistry registry = DeploymentRegistry(address(proxy));

        console.log("Verifying initialization...");
        console.log("   Owner:", registry.owner());
        console.log("   Gnosis Safe:", registry.gnosisSafe());
        console.log("   Emergency Guardian:", registry.emergencyGuardian());
        console.log("   Emergency Paused:", registry.emergencyPaused());

        // Test factory functions
        console.log("Testing factory functions...");

        // Test template mappings (these are public mappings, not arrays)
        bytes32 testHash = keccak256("test");
        bool isApproved = registry.approvedTemplates(testHash);
        uint256 expiration = registry.templateExpirations(testHash);

        console.log("   Test template approved:", isApproved);
        console.log("   Test template expiration:", expiration);
    }

    /// @notice Deploy proxy for specific implementation
    /// @param implementationAddr The implementation contract address
    /// @param owner The initial owner address
    function deployProxyFor(address implementationAddr, address owner) external returns (address) {
        if (implementationAddr == address(0)) revert ImplementationCannotBeZero();
        if (owner == address(0)) revert OwnerCannotBeZero();

        vm.startBroadcast();

        // Encode initialization data
        bytes memory initData = abi.encodeWithSignature(
            "initializeWithSafe(address,address,address)", owner, GNOSIS_SAFE, EMERGENCY_GUARDIAN
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(implementationAddr, initData);

        vm.stopBroadcast();

        return address(proxy);
    }

    /// @notice Get network name for current chain
    function getNetworkName() public view returns (string memory) {
        uint256 chainId = block.chainid;
        if (chainId == 42_161) return "arbitrum";
        if (chainId == 42_220) return "celo";
        if (chainId == 84_532) return "baseSepolia";
        if (chainId == 8453) return "base";
        if (chainId == 11_155_111) return "sepolia";
        if (chainId == 31_337) return "localhost";
        return "unknown";
    }
}
