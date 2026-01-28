import {
  ActionRegistry,
  GardenAccount,
  GardenToken,
  Capital,
  HypercertMinter,
  HypercertStatus,
} from "../generated";

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
  Hypercert,
  HypercertClaim,
  HypercertMinter_TransferSingle_handlerArgs,
  HypercertMinter_ClaimStored_handlerArgs,
  HandlerTypes_contractRegisterArgs,
  GardenToken_GardenMinted_eventArgs,
  contractRegistrations,
} from "../generated/src/Types.gen";

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Utility type that removes readonly modifier from all properties.
 * Used to work around readonly entity types when building update objects.
 */
type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Extended transaction type that includes the hash field.
 * The generated Transaction_t is empty, but the runtime object includes hash.
 */
type TransactionWithHash = { hash: string };

/**
 * Helper to safely access transaction hash from event.transaction.
 * Works around the empty Transaction_t type in generated code.
 */
function getTxHash(transaction: unknown): string {
  if (
    typeof transaction !== "object" ||
    transaction === null ||
    !("hash" in transaction) ||
    typeof (transaction as TransactionWithHash).hash !== "string"
  ) {
    throw new Error(
      `Invalid transaction object: expected { hash: string }, got ${JSON.stringify(transaction)}`
    );
  }
  return (transaction as TransactionWithHash).hash;
}

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

// Zero address constant for mint detection
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_IPFS_GATEWAY = "https://w3s.link/ipfs/";

function resolveIpfsUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `${DEFAULT_IPFS_GATEWAY}${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry) => typeof entry === "string") as string[];
  return strings.length ? strings : undefined;
}

interface FetchJsonContext {
  eventType: string;
  chainId: number;
  blockNumber: number;
  txHash: string;
  log: { warn: (message: string, context?: Record<string, unknown>) => void };
}

async function fetchJson(
  uri: string,
  fetchContext?: FetchJsonContext,
  timeoutMs = 10_000
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resolveIpfsUri(uri), { signal: controller.signal });
    if (!response.ok) {
      if (fetchContext) {
        fetchContext.log.warn("Metadata fetch returned non-OK status", {
          eventType: fetchContext.eventType,
          chainId: fetchContext.chainId,
          blockNumber: fetchContext.blockNumber,
          correlationId: fetchContext.txHash,
          uri,
          status: response.status,
        });
      }
      return null;
    }
    return await response.json();
  } catch (error) {
    if (fetchContext) {
      fetchContext.log.warn("Metadata fetch failed", {
        eventType: fetchContext.eventType,
        chainId: fetchContext.chainId,
        blockNumber: fetchContext.blockNumber,
        correlationId: fetchContext.txHash,
        uri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseHypercertMetadata(metadata: unknown): {
  title?: string;
  description?: string;
  imageUri?: string;
  workScopes?: string[];
  gardenId?: string;
  attestationUIDs?: string[];
} {
  if (!isRecord(metadata)) return {};

  const title = getString(metadata.name);
  const description = getString(metadata.description);
  const imageUri = getString(metadata.image);

  let workScopes: string[] | undefined;
  const hypercert = isRecord(metadata.hypercert) ? metadata.hypercert : undefined;
  if (hypercert) {
    const workScope = isRecord(hypercert.work_scope) ? hypercert.work_scope : undefined;
    if (workScope) {
      workScopes = getStringArray(workScope.value);
    }
  }

  let gardenId: string | undefined;
  let attestationUIDs: string[] | undefined;
  const hidden = isRecord(metadata.hidden_properties) ? metadata.hidden_properties : undefined;
  if (hidden) {
    gardenId = getString(hidden.gardenId);
    const refs = Array.isArray(hidden.attestationRefs)
      ? hidden.attestationRefs.filter(isRecord)
      : [];
    const uids = refs.map((ref) => getString(ref.uid)).filter((uid): uid is string => Boolean(uid));
    if (uids.length > 0) {
      attestationUIDs = uids;
    }
  }

  return {
    title,
    description,
    imageUri: imageUri ? resolveIpfsUri(imageUri) : undefined,
    workScopes,
    gardenId,
    attestationUIDs,
  };
}

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

    // Check if hypercert already exists (may be created by ClaimStored event first)
    let existingHypercert = await context.Hypercert.get(hypercertId);

    if (existingHypercert) {
      // Idempotency: skip if this is the same transaction replaying
      if (existingHypercert.txHash === getTxHash(event.transaction)) {
        return;
      }

      const hasMintedBy = Boolean(existingHypercert.mintedBy);

      if (!hasMintedBy) {
        // Update with mint details
        const updatedHypercert: Hypercert = {
          ...existingHypercert,
          totalUnits: existingHypercert.totalUnits || event.params.value,
          mintedBy: event.params.operator,
          mintedAt: timestamp,
          txHash: getTxHash(event.transaction),
          updatedAt: timestamp,
        };
        context.Hypercert.set(updatedHypercert);
        context.log.info("Hypercert minted", {
          hypercertId,
          units: event.params.value,
          chainId: event.chainId,
          blockNumber: event.block.number,
          txHash: getTxHash(event.transaction),
        });
        return;
      }

      // Treat subsequent mint-from-zero transfers as claims
      const claimant = event.params.to;
      const claimId = `${event.chainId}-${tokenId.toString()}-${claimant}`;

      // Idempotency: check if claim already exists
      const existingClaim = await context.HypercertClaim.get(claimId);
      if (existingClaim) {
        return;
      }

      const claim: HypercertClaim = {
        id: claimId,
        chainId: event.chainId,
        hypercertId,
        claimant,
        units: event.params.value,
        claimedAt: timestamp,
        txHash: getTxHash(event.transaction),
      };
      context.HypercertClaim.set(claim);

      const newClaimedUnits = existingHypercert.claimedUnits + event.params.value;
      const isFullyClaimed = newClaimedUnits >= existingHypercert.totalUnits;
      const newStatus: HypercertStatus = isFullyClaimed ? "CLAIMED" : existingHypercert.status;

      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        claimedUnits: newClaimedUnits,
        status: newStatus,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);

      context.log.info("Hypercert claimed", {
        hypercertId,
        claimant,
        units: event.params.value,
        chainId: event.chainId,
        blockNumber: event.block.number,
        correlationId: getTxHash(event.transaction),
      });
      return;
    }

    // Create new hypercert entity
    const newHypercert: Hypercert = {
      ...createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp),
      totalUnits: event.params.value,
      mintedBy: event.params.operator,
      txHash: getTxHash(event.transaction),
    };
    context.Hypercert.set(newHypercert);

    context.log.info("Hypercert minted", {
      hypercertId,
      units: event.params.value,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: getTxHash(event.transaction),
    });
  }
);

// Handler for HypercertMinter ClaimStored event (stores metadata URI)
HypercertMinter.ClaimStored.handler(
  async ({ event, context }: HypercertMinter_ClaimStored_handlerArgs<void>) => {
    const tokenId = event.params.claimID;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    let existingHypercert = await context.Hypercert.get(hypercertId);

    const baseHypercert =
      existingHypercert ?? createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp);

    const metadata = await fetchJson(event.params.uri, {
      eventType: "ClaimStored",
      chainId: event.chainId,
      blockNumber: event.block.number,
      txHash: getTxHash(event.transaction),
      log: context.log,
    });

    // Build metadata updates if available
    const metadataUpdates: Partial<Mutable<Hypercert>> = {};
    if (metadata) {
      const parsed = parseHypercertMetadata(metadata);
      if (parsed.title) metadataUpdates.title = parsed.title;
      if (parsed.description) metadataUpdates.description = parsed.description;
      if (parsed.imageUri) metadataUpdates.imageUri = parsed.imageUri;
      if (parsed.workScopes) metadataUpdates.workScopes = parsed.workScopes;
      if (parsed.gardenId) metadataUpdates.garden = parsed.gardenId;
      if (parsed.attestationUIDs) {
        metadataUpdates.attestationUIDs = parsed.attestationUIDs;
        metadataUpdates.attestationCount = parsed.attestationUIDs.length;
      }
    }

    const updatedHypercert: Hypercert = {
      ...baseHypercert,
      metadataUri: event.params.uri,
      totalUnits: event.params.totalUnits,
      updatedAt: timestamp,
      ...metadataUpdates,
    };

    context.Hypercert.set(updatedHypercert);

    context.log.info("Hypercert claim stored", {
      hypercertId,
      uri: event.params.uri,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: getTxHash(event.transaction),
    });
  }
);
