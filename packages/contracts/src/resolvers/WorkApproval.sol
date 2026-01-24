// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkApprovalSchema, WorkSchema } from "../Schemas.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IGreenGoodsResolver } from "../interfaces/IGreenGoodsResolver.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotInActionRegistry } from "./Work.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";

error NotInWorkRegistry();
error NotGardenOperator();

/// @title WorkApprovalResolver
/// @notice A schema resolver for the Actions event schema
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
/// @dev Role checks are performed via HatsModule (Hats Protocol)
contract WorkApprovalResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    address public immutable ACTION_REGISTRY;

    /// @notice HatsModule for role verification
    IHats public immutable HATS_MODULE;

    /// @notice The GreenGoods resolver for triggering protocol integrations
    IGreenGoodsResolver public greenGoodsResolver;

    /// @notice The KarmaGAPModule for creating GAP impacts
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Emitted when the GreenGoods resolver is updated
    event GreenGoodsResolverUpdated(address indexed oldResolver, address indexed newResolver);

    /// @notice Emitted when the KarmaGAPModule is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /**
     * @dev Storage gap for future upgrades
     * Reserves 48 slots (50 total - 2 used: greenGoodsResolver, karmaGAPModule)
     * Note: ACTION_REGISTRY and HATS_MODULE are immutable (not in storage)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[48] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs, address actionAddrs, address hatsModule) SchemaResolver(IEAS(easAddrs)) {
        ACTION_REGISTRY = actionAddrs;
        HATS_MODULE = IHats(hatsModule);
        _disableInitializers();
    }

    /// @notice Initializes the contract and sets the specified address as the owner.
    /// @dev This function replaces the constructor for upgradable contracts.
    /// @param _multisig The address that will own the contract.
    function initialize(address _multisig) external initializer {
        __Ownable_init();
        _transferOwnership(_multisig);
    }

    /// @notice Sets the GreenGoods resolver address
    /// @param _resolver The new resolver address
    function setGreenGoodsResolver(address _resolver) external onlyOwner {
        address oldResolver = address(greenGoodsResolver);
        greenGoodsResolver = IGreenGoodsResolver(_resolver);
        emit GreenGoodsResolverUpdated(oldResolver, _resolver);
    }

    /// @notice Sets the KarmaGAPModule address
    /// @param _karmaGAPModule The new module address
    function setKarmaGAPModule(address _karmaGAPModule) external onlyOwner {
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_karmaGAPModule);
        emit KarmaGAPModuleUpdated(oldModule, _karmaGAPModule);
    }

    /// @notice Indicates whether the resolver is payable.
    /// @dev This is a pure function that always returns true.
    /// @return A boolean indicating that the resolver is payable
    function isPayable() public pure override returns (bool) {
        return true;
    }

    /// @notice Handles the logic to be executed when an attestation is made
    /// @dev Validates operator identity, work relationship, and action validity
    ///
    /// **Validation Order (Security Critical):**
    /// 1. WORK RELATIONSHIP: Verify work was submitted to this garden
    /// 2. IDENTITY: Verify attester is a garden operator (can approve work)
    /// 3. ACTION: Verify action exists in registry
    /// 4. GAP INTEGRATION: Create project impact if approved and GAP supported
    ///
    /// **GAP Impact Creation:**
    /// - Only created if schema.approved == true
    /// - Only if chain supports GAP (KarmaLib.isSupported())
    /// - Uses try/catch to prevent GAP failures from reverting approval
    ///
    /// @param attestation The attestation data structure
    /// @return bool True if attestation is valid
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal override returns (bool) {
        WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
        Attestation memory workAttestation = _eas.getAttestation(schema.workUID);
        address garden = workAttestation.recipient;

        // WORK RELATIONSHIP: Verify work was submitted to this garden
        if (garden != attestation.recipient) {
            revert NotInWorkRegistry();
        }

        // IDENTITY CHECK: Verify operator status via HatsModule
        // Only operators can approve work
        if (!HATS_MODULE.isOperator(garden, attestation.attester)) {
            revert NotGardenOperator();
        }

        // ACTION VALIDATION: Verify action exists
        if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).startTime == 0) {
            revert NotInActionRegistry();
        }

        // GAP INTEGRATION: Create project impact if approved
        // Uses KarmaGAPModule for decoupled GAP operations
        if (schema.approved && address(karmaGAPModule) != address(0)) {
            _createGAPProjectImpact(schema, workAttestation);
        }

        // GREENGOODS RESOLVER: Trigger all enabled integrations (Octant, Unlock, etc.)
        // Only called for approved work; resolver uses try/catch internally
        if (schema.approved && address(greenGoodsResolver) != address(0)) {
            _callGreenGoodsResolver(schema, workAttestation, attestation);
        }

        return (true);
    }

    /// @notice Calls the GreenGoods resolver for approved work
    /// @dev Called after validation; uses try/catch to prevent resolver failures from reverting approval
    function _callGreenGoodsResolver(
        WorkApprovalSchema memory schema,
        Attestation memory workAttestation,
        Attestation calldata approvalAttestation
    )
        private
    {
        WorkSchema memory workSchema = abi.decode(workAttestation.data, (WorkSchema));

        // Get first media IPFS CID (for proof)
        string memory mediaIPFS = workSchema.media.length > 0 ? workSchema.media[0] : "";

        // Call resolver with try/catch — integration failures don't block attestations
        // solhint-disable-next-line no-empty-blocks
        try greenGoodsResolver.onWorkApproved(
            workAttestation.recipient, // garden address
            schema.workUID, // work UID
            approvalAttestation.uid, // approval UID
            bytes32(schema.actionUID), // action UID (converted from uint256)
            workAttestation.attester, // worker (who submitted work)
            approvalAttestation.attester, // operator (who approved)
            schema.feedback, // approval feedback
            mediaIPFS // evidence
        ) {
            // Success - resolver events provide observability
        } catch {
            // Intentionally ignore resolver failures — approval succeeds even if integrations fail
        }
    }

    /// @notice Handles the logic to be executed when an attestation is revoked.
    /// @dev Only garden operators can revoke work approvals.
    ///
    /// **Validation:**
    /// - Verifies the revoker is an operator of the garden the approval was for
    /// - Original approver OR any garden operator can revoke
    ///
    /// @param attestation The attestation being revoked
    /// @return A boolean indicating whether the revocation is valid.
    function onRevoke(Attestation calldata attestation, uint256 /*value*/ ) internal view override returns (bool) {
        // The approval attestation recipient is the garden address
        address garden = attestation.recipient;

        // IDENTITY CHECK: Only operators can revoke work approvals via HatsModule
        // This allows the original approver or any other operator to revoke if needed
        if (!HATS_MODULE.isOperator(garden, attestation.attester)) {
            revert NotGardenOperator();
        }

        return true;
    }

    /// @notice Creates GAP project impact securely via KarmaGAPModule
    /// @dev SECURITY: Only called after full validation in onAttest()
    /// @param schema Work approval schema data
    /// @param workAttestation The work attestation being approved
    function _createGAPProjectImpact(WorkApprovalSchema memory schema, Attestation memory workAttestation) private {
        // Get work and action data
        WorkSchema memory workSchema = abi.decode(workAttestation.data, (WorkSchema));
        ActionRegistry.Action memory action = ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID);

        // Prepare impact data
        string memory workTitle = action.title;
        string memory impactDesc = schema.feedback;
        string memory proof = workSchema.media.length > 0 ? workSchema.media[0] : "";

        // SECURITY: Use try/catch to prevent GAP failures from reverting approval
        // The KarmaGAPModule has authorization checks
        // Since we already validated operator in onAttest(), this is secure
        // solhint-disable-next-line no-empty-blocks
        try karmaGAPModule.createImpact(
            workAttestation.recipient, // garden address
            0, // tokenId will be resolved by module
            workTitle,
            impactDesc,
            proof,
            schema.workUID
        ) {
            // Success - event emitted by KarmaGAPModule
        } catch {
            // Intentionally ignore failures - approval succeeds even if GAP integration fails
        }
    }

    /// @notice Authorizes an upgrade to the contract's implementation.
    /// @dev This function can only be called by the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
