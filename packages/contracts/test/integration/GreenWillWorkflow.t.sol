// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { GreenWillRegistry } from "../../src/registries/GreenWillRegistry.sol";
import { GreenWillUnlockModule } from "../../src/modules/GreenWillUnlockModule.sol";
import { GreenWillSupportRouter } from "../../src/modules/GreenWillSupportRouter.sol";
import { GenesisHatValidator } from "../../src/validators/GenesisHatValidator.sol";
import { WorkAttestationValidator } from "../../src/validators/WorkAttestationValidator.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockHats } from "../../src/mocks/Hats.sol";
import { MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockPublicLock, MockUnlockFactory } from "../../src/mocks/Unlock.sol";

contract GreenWillWorkflowVaultResolver {
    mapping(address garden => mapping(address asset => address vault)) internal vaults;

    function setVault(address garden, address asset, address vault) external {
        vaults[garden][asset] = vault;
    }

    function gardenAssetVaults(address garden, address asset) external view returns (address) {
        return vaults[garden][asset];
    }
}

contract GreenWillWorkflowTest is Test {
    GreenWillRegistry internal registry;
    GreenWillUnlockModule internal unlockModule;
    GreenWillSupportRouter internal supportRouter;

    GreenWillWorkflowVaultResolver internal vaultResolver;
    GenesisHatValidator internal genesisValidator;
    WorkAttestationValidator internal workValidator;
    MockERC20 internal asset;
    MockEAS internal eas;
    MockHats internal hats;
    MockOctantVault internal vault;
    MockPublicLock internal genesisLock;
    MockPublicLock internal firstWorkLock;
    MockPublicLock internal firstSupportLock;
    MockUnlockFactory internal unlockFactory;

    bytes32 internal constant GENESIS_BADGE = keccak256("GENESIS");
    bytes32 internal constant FIRST_WORK_BADGE = keccak256("FIRST_WORK");
    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");
    bytes32 internal constant WORK_SCHEMA_UID = keccak256("WORK_SCHEMA_UID");
    bytes32 internal constant WORK_UID = keccak256("WORK_UID");
    uint256 internal constant PROTOCOL_HAT_ID = 42;

    address internal constant ALICE = address(0xA11CE);
    address internal constant GARDEN = address(0x600D);

    function setUp() public {
        hats = new MockHats();
        hats.setHatActive(PROTOCOL_HAT_ID, true);
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        eas = new MockEAS();
        asset = new MockERC20();
        unlockFactory = new MockUnlockFactory();
        vaultResolver = new GreenWillWorkflowVaultResolver();

        vault = new MockOctantVault(address(asset), "GreenWill Support Vault", "gwSVLT", address(this), 0);
        vaultResolver.setVault(GARDEN, address(asset), address(vault));
        asset.mint(ALICE, 25 ether);

        genesisLock = new MockPublicLock();
        firstWorkLock = new MockPublicLock();
        firstSupportLock = new MockPublicLock();
        genesisValidator = new GenesisHatValidator(address(hats), PROTOCOL_HAT_ID);
        workValidator = new WorkAttestationValidator(address(eas), WORK_SCHEMA_UID);

        GreenWillRegistry registryImplementation = new GreenWillRegistry();
        registry = GreenWillRegistry(
            address(
                new ERC1967Proxy(
                    address(registryImplementation),
                    abi.encodeWithSelector(GreenWillRegistry.initialize.selector, address(this))
                )
            )
        );

        GreenWillUnlockModule unlockImplementation = new GreenWillUnlockModule();
        unlockModule = GreenWillUnlockModule(
            address(
                new ERC1967Proxy(
                    address(unlockImplementation),
                    abi.encodeWithSelector(
                        GreenWillUnlockModule.initialize.selector,
                        address(this),
                        address(registry),
                        address(unlockFactory),
                        0
                    )
                )
            )
        );

        GreenWillSupportRouter routerImplementation = new GreenWillSupportRouter();
        supportRouter = GreenWillSupportRouter(
            address(
                new ERC1967Proxy(
                    address(routerImplementation),
                    abi.encodeWithSelector(
                        GreenWillSupportRouter.initialize.selector,
                        address(this),
                        address(registry),
                        address(vaultResolver),
                        FIRST_SUPPORT_BADGE
                    )
                )
            )
        );

        registry.setUnlockModule(address(unlockModule));
        registry.configureBadgeClass(
            GENESIS_BADGE,
            "genesis",
            "ipfs://genesis",
            address(genesisValidator),
            address(0),
            address(genesisLock),
            true,
            true
        );
        registry.configureBadgeClass(
            FIRST_WORK_BADGE,
            "first-work",
            "ipfs://first-work",
            address(workValidator),
            address(0),
            address(firstWorkLock),
            true,
            true
        );
        registry.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            "ipfs://first-support",
            address(0),
            address(supportRouter),
            address(firstSupportLock),
            false,
            true
        );
    }

    function test_workflow_claimGenesisClaimFirstWorkThenRouteFirstSupport() public {
        vm.prank(ALICE);
        uint256 genesisTokenId = registry.claimBadge(GENESIS_BADGE, "");

        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE);

        vm.prank(ALICE);
        uint256 firstWorkTokenId = registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));

        vm.startPrank(ALICE);
        asset.approve(address(supportRouter), type(uint256).max);
        uint256 shares = supportRouter.fundVault(GARDEN, address(asset), 10 ether);
        vm.stopPrank();

        GreenWillRegistry.BadgeRecord memory genesisRecord = registry.getBadgeRecord(GENESIS_BADGE, ALICE);
        GreenWillRegistry.BadgeRecord memory firstWorkRecord = registry.getBadgeRecord(FIRST_WORK_BADGE, ALICE);
        GreenWillRegistry.BadgeRecord memory firstSupportRecord = registry.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);

        assertEq(genesisTokenId, 1, "genesis should mint first lock token");
        assertEq(firstWorkTokenId, 1, "first-work should mint first lock token on its lock");
        assertEq(firstSupportRecord.unlockTokenId, 1, "first-support should mint first lock token on its lock");
        assertTrue(registry.hasBadge(GENESIS_BADGE, ALICE), "genesis should be issued");
        assertTrue(registry.hasBadge(FIRST_WORK_BADGE, ALICE), "first-work should be issued");
        assertTrue(registry.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "first-support should be issued");
        assertEq(genesisRecord.sourceRef, bytes32(PROTOCOL_HAT_ID), "genesis source ref should be hat id");
        assertEq(firstWorkRecord.sourceRef, WORK_UID, "first-work source ref should be work attestation");
        assertEq(firstSupportRecord.issuer, address(supportRouter), "support router should be issuer");
        assertEq(shares, 10 ether, "support route should mint vault shares");
        assertEq(vault.balanceOf(ALICE), 10 ether, "supporter should receive vault shares");
        assertTrue(genesisLock.getHasValidKey(ALICE), "genesis lock key should be valid");
        assertTrue(firstWorkLock.getHasValidKey(ALICE), "first-work lock key should be valid");
        assertTrue(firstSupportLock.getHasValidKey(ALICE), "first-support lock key should be valid");
    }

    function _setWorkAttestation(bytes32 uid, bytes32 schemaUID, address attester) internal {
        eas.setAttestationByUID(
            uid,
            Attestation({
                uid: uid,
                schema: schemaUID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: GARDEN,
                attester: attester,
                revocable: true,
                data: abi.encode("work")
            })
        );
    }
}
