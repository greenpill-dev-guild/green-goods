import { ActionRegistry, GardenAccount, GardenToken, Capital } from "../generated";

import type {
  Action,
  Garden,
  Gardener,
  ActionRegistry_ActionRegistered_handlerArgs,
  ActionRegistry_ActionStartTimeUpdated_handlerArgs,
  ActionRegistry_ActionEndTimeUpdated_handlerArgs,
  ActionRegistry_ActionTitleUpdated_handlerArgs,
  ActionRegistry_ActionInstructionsUpdated_handlerArgs,
  ActionRegistry_ActionMediaUpdated_handlerArgs,
  GardenToken_GardenMinted_handlerArgs,
  GardenAccount_NameUpdated_handlerArgs,
  GardenAccount_DescriptionUpdated_handlerArgs,
  GardenAccount_LocationUpdated_handlerArgs,
  GardenAccount_BannerImageUpdated_handlerArgs,
  GardenAccount_GardenerAdded_handlerArgs,
  GardenAccount_GardenerRemoved_handlerArgs,
  GardenAccount_GardenOperatorAdded_handlerArgs,
  GardenAccount_GardenOperatorRemoved_handlerArgs,
  GardenAccount_GAPProjectCreated_handlerArgs,
  GardenAccount_OpenJoiningUpdated_handlerArgs,
  HandlerTypes_contractRegisterArgs,
  GardenToken_GardenMinted_eventArgs,
  contractRegistrations,
} from "../generated/src/Types.gen";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maps numeric capital type values from the smart contract to Capital enum values.
 * These values correspond to the Capital enum in the ActionRegistry contract.
 */
const CAPITAL_TYPE_MAP: Record<number, Capital> = {
  0: "SOCIAL",
  1: "MATERIAL",
  2: "FINANCIAL",
  3: "LIVING",
  4: "INTELLECTUAL",
  5: "EXPERIENTIAL",
  6: "SPIRITUAL",
  7: "CULTURAL",
} as const;

/**
 * Converts a numeric capital type from the blockchain to a Capital enum value.
 * Returns "UNKNOWN" for any unrecognized values.
 */
function mapCapitalType(value: bigint): Capital {
  const numValue = Number(value);
  return CAPITAL_TYPE_MAP[numValue] ?? "UNKNOWN";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a default Garden entity with empty values.
 * Used when handling update events for gardens that don't exist yet.
 */
function createDefaultGarden(gardenId: string, chainId: number, timestamp: number): Garden {
  return {
    id: gardenId,
    chainId,
    tokenAddress: "",
    tokenID: 0n,
    name: "",
    description: "",
    location: "",
    bannerImage: "",
    openJoining: false,
    gardeners: [],
    operators: [],
    createdAt: timestamp,
    gapProjectUID: undefined,
  };
}

// ============================================================================
// ACTION REGISTRY EVENT HANDLERS
// ============================================================================

// Handler for the ActionRegistered event
ActionRegistry.ActionRegistered.handler(
  async ({ event, context }: ActionRegistry_ActionRegistered_handlerArgs<void>) => {
    // Create unique ID by combining chainId and actionUID to prevent cross-chain collisions
    const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
    const capitals = event.params.capitals.map(mapCapitalType);

    // Update or create a new Action entity
    const actionEntity: Action = {
      id: actionId,
      chainId: event.chainId,
      ownerAddress: event.params.owner,
      startTime: event.params.startTime,
      endTime: event.params.endTime,
      title: event.params.title,
      instructions: event.params.instructions,
      capitals,
      media: event.params.media,
      createdAt: event.block.timestamp,
    };

    context.Action.set(actionEntity);
  }
);

// Handler for the ActionStartTimeUpdated event
ActionRegistry.ActionStartTimeUpdated.handler(
  async ({ event, context }: ActionRegistry_ActionStartTimeUpdated_handlerArgs<void>) => {
    const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
    const existingAction = await context.Action.get(actionId);

    if (existingAction) {
      const updatedAction: Action = {
        ...existingAction,
        startTime: event.params.startTime,
      };

      context.Action.set(updatedAction);
    }
  }
);

// Handler for the ActionEndTimeUpdated event
ActionRegistry.ActionEndTimeUpdated.handler(
  async ({ event, context }: ActionRegistry_ActionEndTimeUpdated_handlerArgs<void>) => {
    const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
    const existingAction = await context.Action.get(actionId);

    if (existingAction) {
      const updatedAction: Action = {
        ...existingAction,
        endTime: event.params.endTime,
      };

      context.Action.set(updatedAction);
    }
  }
);

// Handler for the ActionTitleUpdated event
ActionRegistry.ActionTitleUpdated.handler(
  async ({ event, context }: ActionRegistry_ActionTitleUpdated_handlerArgs<void>) => {
    const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
    const existingAction = await context.Action.get(actionId);

    if (existingAction) {
      const updatedAction: Action = {
        ...existingAction,
        title: event.params.title,
      };

      context.Action.set(updatedAction);
    }
  }
);

// Handler for the ActionInstructionsUpdated event
ActionRegistry.ActionInstructionsUpdated.handler(
  async ({ event, context }: ActionRegistry_ActionInstructionsUpdated_handlerArgs<void>) => {
    const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
    const existingAction = await context.Action.get(actionId);

    if (existingAction) {
      const updatedAction: Action = {
        ...existingAction,
        instructions: event.params.instructions,
      };

      context.Action.set(updatedAction);
    }
  }
);

// Handler for the ActionMediaUpdated event
ActionRegistry.ActionMediaUpdated.handler(
  async ({ event, context }: ActionRegistry_ActionMediaUpdated_handlerArgs<void>) => {
    const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
    const existingAction = await context.Action.get(actionId);

    if (existingAction) {
      const updatedAction: Action = {
        ...existingAction,
        media: event.params.media,
      };

      context.Action.set(updatedAction);
    }
  }
);

// ============================================================================
// GARDEN TOKEN EVENT HANDLERS
// ============================================================================

// Register new GardenAccount contracts when gardens are minted
GardenToken.GardenMinted.contractRegister(
  ({
    event,
    context,
  }: HandlerTypes_contractRegisterArgs<GardenToken_GardenMinted_eventArgs> & {
    context: contractRegistrations;
  }) => {
    // Register the newly created garden account contract for event listening
    context.addGardenAccount(event.params.account);

    context.log.info(
      `Registered new GardenAccount at ${event.params.account} (tokenId: ${event.params.tokenId})`
    );
  }
);

// Handler for the GardenMinted event
GardenToken.GardenMinted.handler(
  async ({ event, context }: GardenToken_GardenMinted_handlerArgs<void>) => {
    const gardenId = event.params.account;

    // Merge operators into gardeners list (operators are also gardeners by contract design)
    // Note: The contract's initialize() should set gardeners[op] = true for all operators,
    // but we ensure consistency here by merging the lists.
    const allMemberAddresses = [...new Set([...event.params.gardeners, ...event.params.operators])];

    // 1. Create Garden Entity
    const gardenEntity: Garden = {
      id: gardenId,
      chainId: event.chainId,
      name: event.params.name,
      description: event.params.description,
      location: event.params.location,
      bannerImage: event.params.bannerImage,
      openJoining: event.params.openJoining,
      gardeners: allMemberAddresses, // Operators are also gardeners
      operators: event.params.operators,
      tokenAddress: event.srcAddress,
      tokenID: event.params.tokenId,
      createdAt: event.block.timestamp,
      gapProjectUID: undefined,
    };
    context.Garden.set(gardenEntity);

    // 2. Create/Update Gardener Entities for all members (gardeners + operators)
    for (const memberAddress of allMemberAddresses) {
      const gardenerId = `${event.chainId}-${memberAddress}`;
      const existingGardener = await context.Gardener.get(gardenerId);

      if (existingGardener) {
        const updatedGardens = [...new Set([...existingGardener.gardens, gardenId])];
        context.Gardener.set({ ...existingGardener, gardens: updatedGardens });
      } else {
        const newGardener: Gardener = {
          id: gardenerId,
          chainId: event.chainId,
          createdAt: event.block.timestamp,
          firstGarden: gardenId,
          gardens: [gardenId],
          owner: undefined,
          ensName: undefined,
          passkeyCredentialId: undefined,
          claimedAt: undefined,
          ensAvatar: undefined,
          ensDescription: undefined,
          ensTwitter: undefined,
          ensGithub: undefined,
          ensEmail: undefined,
        };
        context.Gardener.set(newGardener);
      }
    }
  }
);

// ============================================================================
// GARDEN ACCOUNT EVENT HANDLERS
// ============================================================================

// Handler for the NameUpdated event
GardenAccount.NameUpdated.handler(
  async ({ event, context }: GardenAccount_NameUpdated_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      // Create minimal garden if it doesn't exist yet
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden: Garden = {
      ...existingGarden,
      name: event.params.newName,
    };

    context.Garden.set(updatedGarden);
  }
);

// Handler for the DescriptionUpdated event
GardenAccount.DescriptionUpdated.handler(
  async ({ event, context }: GardenAccount_DescriptionUpdated_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden: Garden = {
      ...existingGarden,
      description: event.params.newDescription,
    };

    context.Garden.set(updatedGarden);
  }
);

// Handler for the LocationUpdated event
GardenAccount.LocationUpdated.handler(
  async ({ event, context }: GardenAccount_LocationUpdated_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden: Garden = {
      ...existingGarden,
      location: event.params.newLocation,
    };

    context.Garden.set(updatedGarden);
  }
);

// Handler for the BannerImageUpdated event
GardenAccount.BannerImageUpdated.handler(
  async ({ event, context }: GardenAccount_BannerImageUpdated_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden: Garden = {
      ...existingGarden,
      bannerImage: event.params.newBannerImage,
    };

    context.Garden.set(updatedGarden);
  }
);

// Handler for the GardenerAdded event
GardenAccount.GardenerAdded.handler(
  async ({ event, context }: GardenAccount_GardenerAdded_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    const gardenerAddress = event.params.gardener;

    // Create unique gardener ID with chain prefix
    const gardenerId = `${event.chainId}-${gardenerAddress}`;

    // Check if gardener entity already exists
    const existingGardener = await context.Gardener.get(gardenerId);

    if (existingGardener) {
      // Update existing gardener with new garden
      const updatedGardens = [...new Set([...existingGardener.gardens, gardenId])];
      const updatedGardener: Gardener = {
        ...existingGardener,
        gardens: updatedGardens,
      };
      context.Gardener.set(updatedGardener);
    } else {
      // Create new gardener entity
      const newGardener: Gardener = {
        id: gardenerId,
        chainId: event.chainId,
        createdAt: event.block.timestamp,
        firstGarden: gardenId,
        gardens: [gardenId],
        owner: undefined,
        ensName: undefined,
        passkeyCredentialId: undefined,
        claimedAt: undefined,
        ensAvatar: undefined,
        ensDescription: undefined,
        ensTwitter: undefined,
        ensGithub: undefined,
        ensEmail: undefined,
      };
      context.Gardener.set(newGardener);
    }

    // Update garden entity
    const existingGarden = await context.Garden.get(gardenId);
    if (existingGarden) {
      const updatedGardeners = [...existingGarden.gardeners, gardenerAddress];
      const updatedGarden: Garden = {
        ...existingGarden,
        gardeners: updatedGardeners,
      };
      context.Garden.set(updatedGarden);
    }
  }
);

// Handler for the GardenerRemoved event
GardenAccount.GardenerRemoved.handler(
  async ({ event, context }: GardenAccount_GardenerRemoved_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    const gardenerAddress = event.params.gardener;
    const gardenerId = `${event.chainId}-${gardenerAddress}`;

    // Update gardener entity (remove garden from their list)
    const existingGardener = await context.Gardener.get(gardenerId);
    if (existingGardener) {
      const updatedGardens = existingGardener.gardens.filter((id) => id !== gardenId);
      const updatedGardener: Gardener = {
        ...existingGardener,
        gardens: updatedGardens,
      };
      context.Gardener.set(updatedGardener);
    }

    // Update garden entity
    const existingGarden = await context.Garden.get(gardenId);
    if (existingGarden) {
      const updatedGardeners = existingGarden.gardeners.filter(
        (gardener) => gardener !== gardenerAddress
      );
      const updatedGarden: Garden = {
        ...existingGarden,
        gardeners: updatedGardeners,
      };
      context.Garden.set(updatedGarden);
    }
  }
);

// Handler for the GardenOperatorAdded event
// Note: In the contract, operators are also added as gardeners (addGardenOperator sets both mappings).
// We mirror this behavior in the indexer for consistency.
GardenAccount.GardenOperatorAdded.handler(
  async ({ event, context }: GardenAccount_GardenOperatorAdded_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    const operatorAddress = event.params.operator;
    const existingGarden = await context.Garden.get(gardenId);

    if (existingGarden) {
      // Add to operators list
      const updatedOperators = [...existingGarden.operators, operatorAddress];

      // Also add to gardeners list for consistency with contract behavior
      // (GardenAccount.addGardenOperator sets both gardenOperators[op] = true AND gardeners[op] = true)
      const isAlreadyGardener = existingGarden.gardeners.some(
        (g) => g.toLowerCase() === operatorAddress.toLowerCase()
      );
      const updatedGardeners = isAlreadyGardener
        ? existingGarden.gardeners
        : [...existingGarden.gardeners, operatorAddress];

      const updatedGarden: Garden = {
        ...existingGarden,
        operators: updatedOperators,
        gardeners: updatedGardeners,
      };

      context.Garden.set(updatedGarden);
    }

    // Also update/create Gardener entity (since operators are gardeners)
    const gardenerId = `${event.chainId}-${operatorAddress}`;
    const existingGardener = await context.Gardener.get(gardenerId);

    if (existingGardener) {
      // Update existing gardener with new garden if not already present
      const hasGarden = existingGardener.gardens.includes(gardenId);
      if (!hasGarden) {
        const updatedGardens = [...existingGardener.gardens, gardenId];
        const updatedGardener: Gardener = {
          ...existingGardener,
          gardens: updatedGardens,
        };
        context.Gardener.set(updatedGardener);
      }
    } else {
      // Create new gardener entity
      const newGardener: Gardener = {
        id: gardenerId,
        chainId: event.chainId,
        createdAt: event.block.timestamp,
        firstGarden: gardenId,
        gardens: [gardenId],
        owner: undefined,
        ensName: undefined,
        passkeyCredentialId: undefined,
        claimedAt: undefined,
        ensAvatar: undefined,
        ensDescription: undefined,
        ensTwitter: undefined,
        ensGithub: undefined,
        ensEmail: undefined,
      };
      context.Gardener.set(newGardener);
    }
  }
);

// Handler for the GardenOperatorRemoved event
GardenAccount.GardenOperatorRemoved.handler(
  async ({ event, context }: GardenAccount_GardenOperatorRemoved_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    const existingGarden = await context.Garden.get(gardenId);

    if (existingGarden) {
      const updatedOperators = existingGarden.operators.filter(
        (operator) => operator !== event.params.operator
      );
      const updatedGarden: Garden = {
        ...existingGarden,
        operators: updatedOperators,
      };

      context.Garden.set(updatedGarden);
    }
  }
);

// Handler for the GAPProjectCreated event
GardenAccount.GAPProjectCreated.handler(
  async ({ event, context }: GardenAccount_GAPProjectCreated_handlerArgs<void>) => {
    const gardenId = event.params.gardenAddress;
    const existingGarden = await context.Garden.get(gardenId);

    if (existingGarden) {
      // Update the garden with the Karma GAP project UID
      const updatedGarden: Garden = {
        ...existingGarden,
        gapProjectUID: event.params.projectUID,
      };

      context.Garden.set(updatedGarden);

      context.log.info(
        `Updated Garden ${gardenId} with GAP project UID: ${event.params.projectUID}`
      );
    } else {
      context.log.warn(`Garden ${gardenId} not found when processing GAPProjectCreated event`);
    }
  }
);

// Handler for the OpenJoiningUpdated event
GardenAccount.OpenJoiningUpdated.handler(
  async ({ event, context }: GardenAccount_OpenJoiningUpdated_handlerArgs<void>) => {
    const gardenId = event.srcAddress;
    const existingGarden = await context.Garden.get(gardenId);

    if (existingGarden) {
      const updatedGarden: Garden = {
        ...existingGarden,
        openJoining: event.params.openJoining,
      };

      context.Garden.set(updatedGarden);

      context.log.info(`Updated Garden ${gardenId} openJoining to: ${event.params.openJoining}`);
    } else {
      context.log.warn(`Garden ${gardenId} not found when processing OpenJoiningUpdated event`);
    }
  }
);

// ============================================================================
// TODO: ENS & GARDENER IDENTITY EVENT HANDLERS
// ============================================================================
// These handlers are ready for implementation when ENSRegistrar and Gardener
// contracts are deployed. See GitHub issue for tracking:
// - ENSRegistrar.SubdomainRegistered: Handle ENS subdomain registration
// - GardenerContract.AccountDeployed: Handle gardener account deployment
//
// Implementation notes:
// 1. Uncomment the contracts in config.yaml when ready to deploy
// 2. Import ENSRegistrar and Gardener from generated module
// 3. Implement handlers following the same patterns as above

// ============================================================================
// HYPERCERT EVENT HANDLERS
// ============================================================================

// Note: These handlers require generated types from `bun run codegen` after
// schema.graphql and config.yaml updates. Uncomment when types are available.

/*
import {
  HypercertMinter,
  IntegrationRouter,
  HypercertStatus,
} from "../generated";

import type {
  Hypercert,
  HypercertClaim,
  WorkApproval,
  HypercertMinter_TransferSingle_handlerArgs,
  HypercertMinter_ClaimStored_handlerArgs,
  IntegrationRouter_HypercertMinted_handlerArgs,
  IntegrationRouter_HypercertClaimed_handlerArgs,
} from "../generated/src/Types.gen";

// Zero address constant for mint detection
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Helper to create default Hypercert entity
// Note: claims are stored as separate HypercertClaim entities (Envio doesn't support entity arrays)
function createDefaultHypercert(
  hypercertId: string,
  chainId: number,
  tokenId: bigint,
  timestamp: number
): Hypercert {
  return {
    id: hypercertId,
    chainId,
    tokenId,
    garden: "",
    metadataUri: "",
    mintedAt: timestamp,
    mintedBy: "",
    txHash: "",
    totalUnits: 0n,
    claimedUnits: 0n,
    attestationCount: 0,
    attestationUIDs: [],
    title: undefined,
    description: undefined,
    imageUri: undefined,
    workScopes: [],
    status: "ACTIVE" as HypercertStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// Handler for HypercertMinter TransferSingle event (detects mints)
// This fires for all ERC1155 transfers, we filter for mints (from = zero address)
HypercertMinter.TransferSingle.handler(
  async ({ event, context }: HypercertMinter_TransferSingle_handlerArgs<void>) => {
    // Only process mints (from zero address)
    if (event.params.from.toLowerCase() !== ZERO_ADDRESS) {
      return;
    }

    const tokenId = event.params.id;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    // Check if hypercert already exists (may be created by IntegrationRouter event first)
    let existingHypercert = await context.Hypercert.get(hypercertId);

    if (existingHypercert) {
      // Update with mint details
      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        totalUnits: event.params.value,
        mintedBy: event.params.operator,
        txHash: event.transaction.hash,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);
    } else {
      // Create new hypercert entity
      const newHypercert = createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp);
      newHypercert.totalUnits = event.params.value;
      newHypercert.mintedBy = event.params.operator;
      newHypercert.txHash = event.transaction.hash;
      context.Hypercert.set(newHypercert);
    }

    context.log.info(`Hypercert minted: ${hypercertId} with ${event.params.value} units`);
  }
);

// Handler for HypercertMinter ClaimStored event (stores metadata URI)
HypercertMinter.ClaimStored.handler(
  async ({ event, context }: HypercertMinter_ClaimStored_handlerArgs<void>) => {
    const tokenId = event.params.claimID;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    let existingHypercert = await context.Hypercert.get(hypercertId);

    if (existingHypercert) {
      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        metadataUri: event.params.uri,
        totalUnits: event.params.totalUnits,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);
    } else {
      const newHypercert = createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp);
      newHypercert.metadataUri = event.params.uri;
      newHypercert.totalUnits = event.params.totalUnits;
      context.Hypercert.set(newHypercert);
    }

    context.log.info(`Hypercert claim stored: ${hypercertId} with URI ${event.params.uri}`);
  }
);

// Handler for IntegrationRouter HypercertMinted event (Green Goods specific)
// This links hypercerts to gardens and work attestations
IntegrationRouter.HypercertMinted.handler(
  async ({ event, context }: IntegrationRouter_HypercertMinted_handlerArgs<void>) => {
    const tokenId = event.params.hypercertId;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    // Get or create hypercert
    let existingHypercert = await context.Hypercert.get(hypercertId);

    const attestationUIDs = event.params.attestationUIDs.map((uid) => uid.toString());

    if (existingHypercert) {
      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        garden: event.params.garden,
        metadataUri: event.params.metadataUri,
        mintedBy: event.params.operator,
        attestationUIDs,
        attestationCount: attestationUIDs.length,
        txHash: event.transaction.hash,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);
    } else {
      const newHypercert = createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp);
      newHypercert.garden = event.params.garden;
      newHypercert.metadataUri = event.params.metadataUri;
      newHypercert.mintedBy = event.params.operator;
      newHypercert.attestationUIDs = attestationUIDs;
      newHypercert.attestationCount = attestationUIDs.length;
      newHypercert.txHash = event.transaction.hash;
      context.Hypercert.set(newHypercert);
    }

    // Update WorkApproval entities to link them to this hypercert
    for (const attestationUID of attestationUIDs) {
      const workApprovalId = `${event.chainId}-${attestationUID}`;
      const existingWorkApproval = await context.WorkApproval.get(workApprovalId);

      if (existingWorkApproval) {
        const updatedWorkApproval: WorkApproval = {
          ...existingWorkApproval,
          hypercertId,
          bundledAt: timestamp,
        };
        context.WorkApproval.set(updatedWorkApproval);
      }
      // Note: WorkApproval may not exist yet if indexed from EAS separately
    }

    context.log.info(
      `Hypercert minted for garden ${event.params.garden}: ${hypercertId} with ${attestationUIDs.length} attestations`
    );
  }
);

// Handler for IntegrationRouter HypercertClaimed event
// Tracks when users claim their share of a hypercert
IntegrationRouter.HypercertClaimed.handler(
  async ({ event, context }: IntegrationRouter_HypercertClaimed_handlerArgs<void>) => {
    const tokenId = event.params.hypercertId;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const claimant = event.params.claimant;
    const claimId = `${event.chainId}-${tokenId.toString()}-${claimant}`;
    const timestamp = event.block.timestamp;

    // Create claim entity
    const claim: HypercertClaim = {
      id: claimId,
      chainId: event.chainId,
      hypercertId,
      claimant,
      units: event.params.units,
      claimedAt: timestamp,
      txHash: event.transaction.hash,
    };
    context.HypercertClaim.set(claim);

    // Update hypercert with new claimed units
    // Note: Claims are stored as separate HypercertClaim entities, not in an array
    const existingHypercert = await context.Hypercert.get(hypercertId);
    if (existingHypercert) {
      const newClaimedUnits = existingHypercert.claimedUnits + event.params.units;

      // Update status if fully claimed
      const isFullyClaimed = newClaimedUnits >= existingHypercert.totalUnits;
      const newStatus: HypercertStatus = isFullyClaimed ? "CLAIMED" : existingHypercert.status;

      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        claimedUnits: newClaimedUnits,
        status: newStatus,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);
    }

    context.log.info(`Hypercert claimed: ${hypercertId} by ${claimant} for ${event.params.units} units`);
  }
);
*/
