// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";
import { KarmaLib } from "../src/lib/Karma.sol";
import { IKarmaGap, IProjectResolver } from "../src/interfaces/IKarmaGap.sol";

/// @title E2EKarmaGAPForkTest
/// @notice End-to-end tests using real Karma GAP contracts via chain forks
/// @dev These tests require RPC URLs for Arbitrum, Celo, and Base Sepolia
contract E2EKarmaGAPForkTest is Test {
    error UnsupportedChainForForkTesting();

    GardenToken public gardenToken;
    GardenAccount public gardenAccountImpl;
    ActionRegistry public actionRegistry;
    DeploymentRegistry public deploymentRegistry;

    address public deployer;
    address public operator;
    address public gardener;
    address public communityToken;

    /// @notice Setup function - runs before each test
    function setUp() public {
        deployer = address(this);
        operator = makeAddr("operator");
        gardener = makeAddr("gardener");

        // Fund accounts
        vm.deal(deployer, 100 ether);
        vm.deal(operator, 10 ether);
        vm.deal(gardener, 10 ether);
    }

    /// @notice Deploy all contracts for testing
    function _deployContracts(address _communityToken) internal {
        // Deploy deployment registry
        deploymentRegistry = new DeploymentRegistry();
        deploymentRegistry.initialize(deployer);

        // Get EAS addresses for current chain
        (address eas, address easRegistry) = _getEASAddresses();

        // Configure network
        DeploymentRegistry.NetworkConfig memory config = DeploymentRegistry.NetworkConfig({
            eas: eas,
            easSchemaRegistry: easRegistry,
            communityToken: _communityToken,
            actionRegistry: address(0),
            gardenToken: address(0),
            workResolver: address(0),
            workApprovalResolver: address(0)
        });

        deploymentRegistry.setNetworkConfig(block.chainid, config);

        // Deploy garden account impl
        gardenAccountImpl = new GardenAccount(
            address(0x3), // ERC4337 entry point (placeholder)
            address(0x4), // Multicall forwarder (placeholder)
            address(0x5), // ERC6551 registry (placeholder)
            deployer, // Guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        );

        // Deploy garden token
        gardenToken = new GardenToken(address(gardenAccountImpl));
        gardenToken.initialize(deployer, address(deploymentRegistry));

        // Deploy action registry
        actionRegistry = new ActionRegistry();
        actionRegistry.initialize(deployer);

        // Register test action
        Capital[] memory caps = new Capital[](1);
        caps[0] = Capital.LIVING;
        string[] memory media = new string[](1);
        media[0] = "ipfs://test";

        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 365 days, "Plant Trees", "Plant native trees", caps, media
        );

        // Update config
        config.actionRegistry = address(actionRegistry);
        config.gardenToken = address(gardenToken);
        deploymentRegistry.setNetworkConfig(block.chainid, config);
    }

    /// @notice Get EAS addresses for current chain (Base Sepolia, Arbitrum, Celo)
    function _getEASAddresses() internal view returns (address eas, address easRegistry) {
        uint256 chainId = block.chainid;
        if (chainId == 84_532) {
            // Base Sepolia
            eas = 0x4200000000000000000000000000000000000021;
            easRegistry = 0x4200000000000000000000000000000000000020;
        } else if (chainId == 42_161) {
            // Arbitrum One
            eas = 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458;
            easRegistry = 0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB;
        } else if (chainId == 42_220) {
            // Celo
            eas = 0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92;
            easRegistry = 0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34;
        } else {
            _revertUnsupportedChain();
        }
    }

    /// @notice Get community token for current chain (Base Sepolia, Arbitrum, Celo)
    function _getCommunityToken() internal view returns (address) {
        uint256 chainId = block.chainid;
        if (chainId == 84_532) return 0x4cB67033da4FD849a552A4C5553E7F532B93E516; // Base Sepolia
        if (chainId == 42_161) return 0x633d825006E4c659b061db7FB9378eDEe8bd95f3; // Arbitrum One
        if (chainId == 42_220) return 0x4cB67033da4FD849a552A4C5553E7F532B93E516; // Celo
        _revertUnsupportedChain();
    }

    /// @notice Helper to revert with unsupported chain error
    function _revertUnsupportedChain() private pure {
        revert UnsupportedChainForForkTesting();
    }

    /// @notice Test: Garden creation creates GAP project on Arbitrum
    function testForkArbitrum_createGarden() public {
        // Skip if no RPC URL provided
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory rpcUrl) {
            if (bytes(rpcUrl).length == 0) {
                console.log("Skipping Arbitrum test: No RPC URL");
                return;
            }
        } catch {
            console.log("Skipping Arbitrum test: No RPC URL");
            return;
        }

        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"));
        _testCreateGarden(42_161);
    }

    /// @notice Test: Garden creation creates GAP project on Celo
    function testForkCelo_createGarden() public {
        // Skip if no RPC URL provided
        try vm.envString("CELO_RPC_URL") returns (string memory rpcUrl) {
            if (bytes(rpcUrl).length == 0) {
                console.log("Skipping Celo test: No RPC URL");
                return;
            }
        } catch {
            console.log("Skipping Celo test: No RPC URL");
            return;
        }

        vm.createSelectFork(vm.envString("CELO_RPC_URL"));
        _testCreateGarden(42_220);
    }

    /// @notice Test: Garden creation creates GAP project on Base Sepolia
    function testForkBaseSepolia_createGarden() public {
        // Skip if no RPC URL provided
        try vm.envString("BASE_SEPOLIA_RPC_URL") returns (string memory rpcUrl) {
            if (bytes(rpcUrl).length == 0) {
                console.log("Skipping Base Sepolia test: No RPC URL");
                return;
            }
        } catch {
            console.log("Skipping Base Sepolia test: No RPC URL");
            return;
        }

        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
        _testCreateGarden(84_532);
    }

    /// @notice Test garden creation and verify GAP project
    function _testCreateGarden(uint256 chainId) internal {
        console.log("\n=== Testing Garden Creation on Chain:", chainId);

        communityToken = _getCommunityToken();
        _deployContracts(communityToken);

        address[] memory gardeners = new address[](1);
        gardeners[0] = gardener;

        address[] memory operators = new address[](1);
        operators[0] = operator;

        // Create garden
        console.log("Creating garden...");
        address gardenAddr = gardenToken.mintGarden(
            communityToken,
            "E2E Test Garden",
            "Testing Karma GAP integration",
            "Test Location",
            "ipfs://banner",
            gardeners,
            operators
        );

        GardenAccount garden = GardenAccount(payable(gardenAddr));

        // Verify GAP project created
        bytes32 projectUID = garden.getGAPProjectUID();
        console.log("Garden created at:", gardenAddr);
        console.log("GAP Project UID:", vm.toString(projectUID));

        // Verify project UID is not zero
        assertTrue(projectUID != bytes32(0), "GAP project should be created");

        // Verify we can query the GAP contract
        IKarmaGap gapContract = IKarmaGap(KarmaLib.getGapContract());
        console.log("Karma GAP contract at:", address(gapContract));

        // Note: We can't easily verify the attestation on-chain without EAS helper methods
        // but the fact that we got a non-zero UID means the attestation was created

        console.log("[OK] Garden creation with GAP project successful");
    }

    /// @notice Test: Operator addition makes them GAP project admin on Arbitrum
    function testForkArbitrum_operatorBecomesProjectAdmin() public {
        // Skip if no RPC URL provided
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory rpcUrl) {
            if (bytes(rpcUrl).length == 0) {
                console.log("Skipping Arbitrum admin test: No RPC URL");
                return;
            }
        } catch {
            console.log("Skipping Arbitrum admin test: No RPC URL");
            return;
        }

        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"));
        _testOperatorBecomesAdmin();
    }

    /// @notice Test operator addition adds GAP project admin
    function _testOperatorBecomesAdmin() internal {
        console.log("\n=== Testing Operator -> GAP Admin Flow ===");

        communityToken = _getCommunityToken();
        _deployContracts(communityToken);

        // Create garden with one operator
        address[] memory gardeners = new address[](1);
        gardeners[0] = gardener;
        address[] memory operators = new address[](1);
        operators[0] = operator;

        address gardenAddr = gardenToken.mintGarden(
            communityToken, "Admin Test Garden", "Testing admin addition", "Location", "ipfs://banner", gardeners, operators
        );

        GardenAccount garden = GardenAccount(payable(gardenAddr));
        bytes32 projectUID = garden.getGAPProjectUID();

        console.log("Garden created with GAP Project UID:", vm.toString(projectUID));

        // Add new operator
        address newOperator = makeAddr("newOperator");
        vm.prank(operator);
        garden.addGardenOperator(newOperator);

        console.log("New operator added:", newOperator);

        // Verify new operator is in garden operators
        assertTrue(garden.gardenOperators(newOperator), "New operator should be added");

        // Verify new operator is also GAP project admin
        IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
        bool isAdmin = resolver.isProjectAdmin(projectUID, newOperator);

        console.log("Is new operator a GAP project admin?", isAdmin);
        assertTrue(isAdmin, "New operator should be project admin");

        console.log("[OK] Operator -> GAP admin flow successful");
    }

    /// @notice Test: Full workflow on Base Sepolia (create -> impact)
    function testForkBaseSepolia_fullWorkflow() public {
        // Skip if no RPC URL provided
        try vm.envString("BASE_SEPOLIA_RPC_URL") returns (string memory rpcUrl) {
            if (bytes(rpcUrl).length == 0) {
                console.log("Skipping Base Sepolia workflow test: No RPC URL");
                return;
            }
        } catch {
            console.log("Skipping Base Sepolia workflow test: No RPC URL");
            return;
        }

        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
        _testFullWorkflow();
    }

    /// @notice Test full workflow: create garden -> create impact
    function _testFullWorkflow() internal {
        console.log("\n=== Testing Full Workflow ===");

        communityToken = _getCommunityToken();
        _deployContracts(communityToken);

        // 1. Create garden -> GAP project
        address[] memory gardeners = new address[](1);
        gardeners[0] = gardener;
        address[] memory operators = new address[](1);
        operators[0] = operator;

        address gardenAddr = gardenToken.mintGarden(
            communityToken, "Full Workflow Garden", "E2E test", "Location", "ipfs://banner", gardeners, operators
        );

        GardenAccount garden = GardenAccount(payable(gardenAddr));
        bytes32 projectUID = garden.getGAPProjectUID();
        assertTrue(projectUID != bytes32(0), "GAP project should exist");

        console.log("[OK] Step 1: Garden created with GAP project");

        // 2. Create project impact (simulating work approval)
        vm.prank(operator);
        bytes32 impactUID =
            garden.createProjectImpact("Plant Native Trees", "Successfully planted 50 native trees", "ipfs://proof-image");

        assertTrue(impactUID != bytes32(0), "Impact should be created");
        console.log("[OK] Step 2: Project impact created:", vm.toString(impactUID));

        console.log("[OK] Full workflow successful");
    }
}
