import {
  ActionRegistry,
  GardenAccount,
  GardensModule,
  HatsModule,
  GardenToken,
  OctantModule,
  OctantVault,
  Capital,
  HypercertMinter,
  HypercertStatus,
  PoolType,
  VaultEventType,
  WeightScheme,
  YieldSplitter,
} from "../generated";

import type {
  Action,
  Garden,
  GardenVault,
  GardenVaultIndex,
  VaultAddressIndex,
  VaultDeposit,
  VaultEvent,
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
  GardenAccount_GAPProjectCreated_handlerArgs,
  GardenAccount_OpenJoiningUpdated_handlerArgs,
  OctantModule_VaultCreated_handlerArgs,
  OctantModule_HarvestTriggered_handlerArgs,
  OctantModule_EmergencyPaused_handlerArgs,
  OctantModule_DonationAddressUpdated_handlerArgs,
  OctantModule_SupportedAssetUpdated_handlerArgs,
  OctantVault_Deposit_handlerArgs,
  OctantVault_Withdraw_handlerArgs,
  OctantModule_VaultCreated_eventArgs,
  GardenCommunity,
  GardenSignalPool,
  Hypercert,
  HypercertClaim,
  HypercertMinter_TransferSingle_handlerArgs,
  HypercertMinter_ClaimStored_handlerArgs,
  HandlerTypes_contractRegisterArgs,
  HandlerTypes_handlerArgs,
  GardenToken_GardenMinted_eventArgs,
  contractRegistrations,
  YieldAllocation,
  YieldAccumulation,
  YieldFractionPurchase,
} from "../generated/src/Types.gen";

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Utility type that removes readonly modifier from all properties.
 * Used to work around readonly entity types when building update objects.
 */
type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Local entity types for new schema entities (until codegen runs)
type GoodsAirdropEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly totalAmount: bigint;
  readonly txHash: string;
  readonly timestamp: number;
};

type YieldCookieJarTransferEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly jar: string;
  readonly txHash: string;
  readonly timestamp: number;
};

type YieldJuiceboxPaymentEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly projectId: bigint;
  readonly txHash: string;
  readonly timestamp: number;
};

type YieldStrandedEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly destination: string;
  readonly txHash: string;
  readonly timestamp: number;
};

type HatsModule_GardenHatTreeCreated_eventArgs = {
  readonly garden: string;
  readonly adminHatId: bigint;
};

type HatsModule_RoleGranted_eventArgs = {
  readonly garden: string;
  readonly account: string;
  readonly role: bigint;
};

type HatsModule_RoleRevoked_eventArgs = {
  readonly garden: string;
  readonly account: string;
  readonly role: bigint;
};

// GardensModule event arg types (local until codegen runs)
type GardensModule_CommunityCreated_eventArgs = {
  readonly garden: string;
  readonly community: string;
  readonly weightScheme: bigint;
  readonly goodsToken: string;
  readonly nftPowerRegistry: string;
};

type GardensModule_SignalPoolCreated_eventArgs = {
  readonly garden: string;
  readonly pool: string;
  readonly poolType: bigint;
  readonly community: string;
};

// YieldSplitter event arg types — aligned with generated types from codegen.
// NOTE: The generated types omit some Solidity event fields (totalYield, treasury, amount).
// Handlers compute derived values from available fields.
type YieldSplitter_YieldSplit_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly cookieJarAmount: bigint;
  readonly fractionsAmount: bigint;
  readonly juiceboxAmount: bigint;
};

// Codegen maps FractionPurchased → YieldAllocated with different fields.
// The Solidity event is named FractionPurchased but the Envio codegen renames it
// to YieldAllocated in the generated handler registry. Both refer to the same
// on-chain event and share the same topic hash.
// Solidity: event FractionPurchased(address indexed garden, uint256 indexed hypercertId, uint256 amount, uint256 fractionId, address treasury)
type YieldSplitter_YieldAllocated_eventArgs = {
  readonly garden: string;
  readonly hypercertId: bigint;
  readonly amount: bigint;
  readonly fractionId: bigint;
  readonly treasury: string;
};

// Solidity: event YieldAccumulated(address indexed garden, address indexed asset, uint256 amount, uint256 totalPending)
type YieldSplitter_YieldAccumulated_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly totalPending: bigint;
};

// GardensModule additional event arg types
// Solidity: event PowerRegistryDeployed(address indexed garden, address indexed registry, WeightScheme weightScheme)
type GardensModule_PowerRegistryDeployed_eventArgs = {
  readonly garden: string;
  readonly registry: string;
  readonly weightScheme: bigint;
};

// Solidity: event GoodsAirdropped(address indexed garden, uint256 totalAmount)
type GardensModule_GoodsAirdropped_eventArgs = {
  readonly garden: string;
  readonly totalAmount: bigint;
};

// YieldSplitter additional event arg types
// Solidity: event YieldToCookieJar(address indexed garden, address indexed asset, uint256 amount, address indexed jar)
type YieldSplitter_YieldToCookieJar_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly jar: string;
};

// Solidity: event YieldToJuicebox(address indexed garden, address indexed asset, uint256 amount, uint256 projectId)
type YieldSplitter_YieldToJuicebox_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly projectId: bigint;
};

// Solidity: event YieldStranded(address indexed garden, address indexed asset, uint256 amount, string destination)
type YieldSplitter_YieldStranded_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly destination: string;
};

type HatsModule_PartialGrantFailed_eventArgs = {
  readonly garden: string;
  readonly account: string;
  readonly role: bigint;
  readonly reason: string;
};

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
 * Maps numeric weight scheme values from the GardensModule contract to WeightScheme enum values.
 * These values correspond to the WeightScheme enum in IGardensModule.
 */
const WEIGHT_SCHEME_MAP: Record<number, WeightScheme> = {
  0: "LINEAR",
  1: "EXPONENTIAL",
  2: "POWER",
} as const;

/**
 * Maps numeric pool type values from the GardensModule contract to PoolType enum values.
 */
const POOL_TYPE_MAP: Record<number, PoolType> = {
  0: "HYPERCERT",
  1: "ACTION",
} as const;

/**
 * Garden role enum mapping (mirrors IHatsModule.GardenRole)
 */
const GARDEN_ROLE = {
  Gardener: 0,
  Evaluator: 1,
  Operator: 2,
  Owner: 3,
  Funder: 4,
  Community: 5,
} as const;

// Zero address constant used for guards and defaults.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Converts a numeric capital type from the blockchain to a Capital enum value.
 * Returns "UNKNOWN" for any unrecognized values.
 */
function mapCapitalType(value: bigint): Capital {
  const numValue = Number(value);
  return CAPITAL_TYPE_MAP[numValue] ?? "UNKNOWN";
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function addUniqueAddress(list: string[], address: string): string[] {
  const normalized = normalizeAddress(address);
  if (list.some((item) => normalizeAddress(item) === normalized)) {
    return list;
  }
  return [...list, normalized];
}

function removeAddress(list: string[], address: string): string[] {
  const normalized = normalizeAddress(address);
  return list.filter((item) => normalizeAddress(item) !== normalized);
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
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    createdAt: timestamp,
    gapProjectUID: undefined,
  };
}

function getGardenVaultId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

function getGardenVaultIndexId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

function getVaultDepositId(chainId: number, vaultAddress: string, depositor: string): string {
  return `${chainId}-${normalizeAddress(vaultAddress)}-${normalizeAddress(depositor)}`;
}

function getVaultAddressIndexId(chainId: number, vaultAddress: string): string {
  return `${chainId}-${normalizeAddress(vaultAddress)}`;
}

function getVaultEventId(chainId: number, txHash: string, logIndex: bigint | number): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

// ID helpers for Gardens Community entities
function getGardenCommunityId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

function getGardenSignalPoolId(chainId: number, garden: string, poolAddress: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(poolAddress)}`;
}

function getYieldAllocationId(chainId: number, txHash: string, logIndex: bigint | number): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

function getYieldAccumulationId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

function getYieldFractionPurchaseId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number,
  hypercertId: bigint
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}-${hypercertId.toString()}`;
}

// ID helper for yield routing event entities (txHash-based, same as getVaultEventId)
function getYieldEventId(chainId: number, txHash: string, logIndex: bigint | number): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

function mapWeightScheme(value: bigint): WeightScheme {
  return WEIGHT_SCHEME_MAP[Number(value)] ?? "LINEAR";
}

function mapPoolType(value: bigint): PoolType {
  return POOL_TYPE_MAP[Number(value)] ?? "HYPERCERT";
}

function createDefaultGardenVault(
  chainId: number,
  garden: string,
  asset: string,
  vaultAddress: string,
  timestamp: number
): GardenVault {
  return {
    id: getGardenVaultId(chainId, garden, asset),
    chainId,
    garden: normalizeAddress(garden),
    asset: normalizeAddress(asset),
    vaultAddress: normalizeAddress(vaultAddress),
    totalDeposited: 0n,
    totalWithdrawn: 0n,
    totalHarvestCount: 0,
    donationAddress: undefined,
    depositorCount: 0,
    paused: false,
    createdAt: timestamp,
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

    // Role arrays are derived from HatsModule RoleGranted/RoleRevoked events.
    const gardenEntity: Garden = {
      id: gardenId,
      chainId: event.chainId,
      name: event.params.name,
      description: event.params.description,
      location: event.params.location,
      bannerImage: event.params.bannerImage,
      openJoining: event.params.openJoining,
      gardeners: [],
      operators: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
      tokenAddress: event.srcAddress,
      tokenID: event.params.tokenId,
      createdAt: event.block.timestamp,
      gapProjectUID: undefined,
    };
    context.Garden.set(gardenEntity);
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
// HATS MODULE EVENT HANDLERS
// ============================================================================

HatsModule.GardenHatTreeCreated.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<HatsModule_GardenHatTreeCreated_eventArgs, void>) => {
    context.log.info(`Garden hat tree created`, {
      garden: event.params.garden,
      adminHatId: event.params.adminHatId.toString(),
      chainId: event.chainId,
      blockNumber: event.block.number,
    });
  }
);

HatsModule.RoleGranted.handler(
  async ({ event, context }: HandlerTypes_handlerArgs<HatsModule_RoleGranted_eventArgs, void>) => {
    const gardenId = event.params.garden;
    const account = event.params.account;
    const role = Number(event.params.role);

    let existingGarden = await context.Garden.get(gardenId);
    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    let updatedGardeners = existingGarden.gardeners;
    let updatedOperators = existingGarden.operators;
    let updatedEvaluators = existingGarden.evaluators;
    let updatedOwners = existingGarden.owners;
    let updatedFunders = existingGarden.funders;
    let updatedCommunities = existingGarden.communities;

    if (role === GARDEN_ROLE.Gardener) {
      updatedGardeners = addUniqueAddress(updatedGardeners, account);
    } else if (role === GARDEN_ROLE.Operator) {
      updatedOperators = addUniqueAddress(updatedOperators, account);
    } else if (role === GARDEN_ROLE.Evaluator) {
      updatedEvaluators = addUniqueAddress(updatedEvaluators, account);
    } else if (role === GARDEN_ROLE.Owner) {
      updatedOwners = addUniqueAddress(updatedOwners, account);
    } else if (role === GARDEN_ROLE.Funder) {
      updatedFunders = addUniqueAddress(updatedFunders, account);
    } else if (role === GARDEN_ROLE.Community) {
      updatedCommunities = addUniqueAddress(updatedCommunities, account);
    }

    if (
      updatedGardeners !== existingGarden.gardeners ||
      updatedOperators !== existingGarden.operators ||
      updatedEvaluators !== existingGarden.evaluators ||
      updatedOwners !== existingGarden.owners ||
      updatedFunders !== existingGarden.funders ||
      updatedCommunities !== existingGarden.communities
    ) {
      context.Garden.set({
        ...existingGarden,
        gardeners: updatedGardeners,
        operators: updatedOperators,
        evaluators: updatedEvaluators,
        owners: updatedOwners,
        funders: updatedFunders,
        communities: updatedCommunities,
      });
    }

    if (role === GARDEN_ROLE.Gardener) {
      const gardenerId = `${event.chainId}-${normalizeAddress(account)}`;
      const existingGardener = await context.Gardener.get(gardenerId);

      if (existingGardener) {
        if (!existingGardener.gardens.includes(gardenId)) {
          context.Gardener.set({
            ...existingGardener,
            gardens: [...existingGardener.gardens, gardenId],
          });
        }
      } else {
        context.Gardener.set({
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
        });
      }
    }
  }
);

HatsModule.RoleRevoked.handler(
  async ({ event, context }: HandlerTypes_handlerArgs<HatsModule_RoleRevoked_eventArgs, void>) => {
    const gardenId = event.params.garden;
    const account = event.params.account;
    const role = Number(event.params.role);

    const existingGarden = await context.Garden.get(gardenId);
    if (!existingGarden) return;

    let updatedGardeners = existingGarden.gardeners;
    let updatedOperators = existingGarden.operators;
    let updatedEvaluators = existingGarden.evaluators;
    let updatedOwners = existingGarden.owners;
    let updatedFunders = existingGarden.funders;
    let updatedCommunities = existingGarden.communities;

    if (role === GARDEN_ROLE.Operator) {
      updatedOperators = removeAddress(updatedOperators, account);
    }

    if (role === GARDEN_ROLE.Gardener) {
      updatedGardeners = removeAddress(updatedGardeners, account);
    }

    if (role === GARDEN_ROLE.Evaluator) {
      updatedEvaluators = removeAddress(updatedEvaluators, account);
    }

    if (role === GARDEN_ROLE.Owner) {
      updatedOwners = removeAddress(updatedOwners, account);
    }

    if (role === GARDEN_ROLE.Funder) {
      updatedFunders = removeAddress(updatedFunders, account);
    }

    if (role === GARDEN_ROLE.Community) {
      updatedCommunities = removeAddress(updatedCommunities, account);
    }

    if (
      updatedGardeners !== existingGarden.gardeners ||
      updatedOperators !== existingGarden.operators ||
      updatedEvaluators !== existingGarden.evaluators ||
      updatedOwners !== existingGarden.owners ||
      updatedFunders !== existingGarden.funders ||
      updatedCommunities !== existingGarden.communities
    ) {
      context.Garden.set({
        ...existingGarden,
        gardeners: updatedGardeners,
        operators: updatedOperators,
        evaluators: updatedEvaluators,
        owners: updatedOwners,
        funders: updatedFunders,
        communities: updatedCommunities,
      });
    }

    if (role === GARDEN_ROLE.Gardener) {
      const gardenerId = `${event.chainId}-${normalizeAddress(account)}`;
      const existingGardener = await context.Gardener.get(gardenerId);
      if (existingGardener) {
        context.Gardener.set({
          ...existingGardener,
          gardens: existingGardener.gardens.filter(
            (id) => normalizeAddress(id) !== normalizeAddress(gardenId)
          ),
        });
      }
    }
  }
);

HatsModule.PartialGrantFailed.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<HatsModule_PartialGrantFailed_eventArgs, void>) => {
    context.log.warn(`Partial hat grant failed`, {
      garden: event.params.garden,
      account: event.params.account,
      role: event.params.role.toString(),
      reason: event.params.reason,
      chainId: event.chainId,
      blockNumber: event.block.number,
    });
  }
);

// ============================================================================
// OCTANT MODULE & VAULT EVENT HANDLERS
// ============================================================================

OctantModule.VaultCreated.contractRegister(
  ({
    event,
    context,
  }: HandlerTypes_contractRegisterArgs<OctantModule_VaultCreated_eventArgs> & {
    context: contractRegistrations;
  }) => {
    context.addOctantVault(event.params.vault);
    context.log.info(`Registered new OctantVault at ${event.params.vault}`);
  }
);

OctantModule.VaultCreated.handler(
  async ({ event, context }: OctantModule_VaultCreated_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const vaultAddress = normalizeAddress(event.params.vault);
    const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);

    const existingGardenVault = await context.GardenVault.get(gardenVaultId);
    const nextGardenVault: GardenVault = {
      ...(existingGardenVault ??
        createDefaultGardenVault(
          event.chainId,
          garden,
          asset,
          vaultAddress,
          event.block.timestamp
        )),
      id: gardenVaultId,
      chainId: event.chainId,
      garden,
      asset,
      vaultAddress,
    };

    context.GardenVault.set(nextGardenVault);

    const gardenIndexId = getGardenVaultIndexId(event.chainId, garden);
    const existingGardenIndex = await context.GardenVaultIndex.get(gardenIndexId);
    const assets = existingGardenIndex?.assets ?? [];
    const normalizedAssets = assets.map((item) => normalizeAddress(item));
    const nextAssets = normalizedAssets.includes(asset) ? assets : [...assets, asset];

    const nextGardenIndex: GardenVaultIndex = {
      id: gardenIndexId,
      chainId: event.chainId,
      garden,
      assets: nextAssets,
    };
    context.GardenVaultIndex.set(nextGardenIndex);

    const vaultAddressIndexId = getVaultAddressIndexId(event.chainId, vaultAddress);
    const vaultAddressIndex: VaultAddressIndex = {
      id: vaultAddressIndexId,
      chainId: event.chainId,
      vaultAddress,
      garden,
      asset,
    };
    context.VaultAddressIndex.set(vaultAddressIndex);
  }
);

OctantModule.HarvestTriggered.handler(
  async ({ event, context }: OctantModule_HarvestTriggered_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
    const existingGardenVault = await context.GardenVault.get(gardenVaultId);

    const nextGardenVault: GardenVault = {
      ...(existingGardenVault ??
        createDefaultGardenVault(
          event.chainId,
          garden,
          asset,
          ZERO_ADDRESS,
          event.block.timestamp
        )),
      totalHarvestCount: (existingGardenVault?.totalHarvestCount ?? 0) + 1,
    };
    context.GardenVault.set(nextGardenVault);

    const txHash = getTxHash(event.transaction);
    const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
    const vaultEvent: VaultEvent = {
      id: vaultEventId,
      chainId: event.chainId,
      garden,
      asset,
      vaultAddress: nextGardenVault.vaultAddress,
      eventType: "HARVEST" as VaultEventType,
      actor: normalizeAddress(event.params.caller),
      amount: undefined,
      shares: undefined,
      txHash,
      timestamp: event.block.timestamp,
    };
    context.VaultEvent.set(vaultEvent);
  }
);

OctantModule.EmergencyPaused.handler(
  async ({ event, context }: OctantModule_EmergencyPaused_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
    const existingGardenVault = await context.GardenVault.get(gardenVaultId);

    const nextGardenVault: GardenVault = {
      ...(existingGardenVault ??
        createDefaultGardenVault(
          event.chainId,
          garden,
          asset,
          ZERO_ADDRESS,
          event.block.timestamp
        )),
      paused: true,
    };
    context.GardenVault.set(nextGardenVault);

    const txHash = getTxHash(event.transaction);
    const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
    const vaultEvent: VaultEvent = {
      id: vaultEventId,
      chainId: event.chainId,
      garden,
      asset,
      vaultAddress: nextGardenVault.vaultAddress,
      eventType: "EMERGENCY_PAUSED" as VaultEventType,
      actor: normalizeAddress(event.params.caller),
      amount: undefined,
      shares: undefined,
      txHash,
      timestamp: event.block.timestamp,
    };
    context.VaultEvent.set(vaultEvent);
  }
);

OctantModule.DonationAddressUpdated.handler(
  async ({ event, context }: OctantModule_DonationAddressUpdated_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const donationAddress = normalizeAddress(event.params.newAddress);
    const gardenIndexId = getGardenVaultIndexId(event.chainId, garden);
    const gardenVaultIndex = await context.GardenVaultIndex.get(gardenIndexId);

    if (!gardenVaultIndex) return;

    for (const asset of gardenVaultIndex.assets) {
      const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
      const existingGardenVault = await context.GardenVault.get(gardenVaultId);
      if (!existingGardenVault) continue;

      context.GardenVault.set({
        ...existingGardenVault,
        donationAddress,
      });
    }
  }
);

OctantModule.SupportedAssetUpdated.handler(
  async ({ event, context }: OctantModule_SupportedAssetUpdated_handlerArgs<void>) => {
    context.log.info(`SupportedAssetUpdated`, {
      chainId: event.chainId,
      asset: event.params.asset,
      strategy: event.params.strategy,
      txHash: getTxHash(event.transaction),
    });
  }
);

OctantVault.Deposit.handler(async ({ event, context }: OctantVault_Deposit_handlerArgs<void>) => {
  const vaultAddress = normalizeAddress(event.srcAddress);
  const vaultAddressIndexId = getVaultAddressIndexId(event.chainId, vaultAddress);
  const vaultAddressIndex = await context.VaultAddressIndex.get(vaultAddressIndexId);
  if (!vaultAddressIndex) return;

  const garden = normalizeAddress(vaultAddressIndex.garden);
  const asset = normalizeAddress(vaultAddressIndex.asset);
  const depositor = normalizeAddress(event.params.owner);
  const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
  const existingGardenVault = await context.GardenVault.get(gardenVaultId);
  if (!existingGardenVault) return;

  const depositId = getVaultDepositId(event.chainId, vaultAddress, depositor);
  const existingDeposit = await context.VaultDeposit.get(depositId);

  const nextDeposit: VaultDeposit = {
    id: depositId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    depositor,
    shares: (existingDeposit?.shares ?? 0n) + event.params.shares,
    totalDeposited: (existingDeposit?.totalDeposited ?? 0n) + event.params.assets,
    totalWithdrawn: existingDeposit?.totalWithdrawn ?? 0n,
  };
  context.VaultDeposit.set(nextDeposit);

  const existingDepositorCount = existingGardenVault.depositorCount ?? 0;
  const nextDepositorCount =
    existingDeposit || event.params.shares === 0n
      ? existingDepositorCount
      : existingDepositorCount + 1;

  context.GardenVault.set({
    ...existingGardenVault,
    totalDeposited: existingGardenVault.totalDeposited + event.params.assets,
    depositorCount: nextDepositorCount,
  });

  const txHash = getTxHash(event.transaction);
  const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
  const vaultEvent: VaultEvent = {
    id: vaultEventId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    eventType: "DEPOSIT" as VaultEventType,
    actor: normalizeAddress(event.params.sender),
    amount: event.params.assets,
    shares: event.params.shares,
    txHash,
    timestamp: event.block.timestamp,
  };
  context.VaultEvent.set(vaultEvent);
});

OctantVault.Withdraw.handler(async ({ event, context }: OctantVault_Withdraw_handlerArgs<void>) => {
  const vaultAddress = normalizeAddress(event.srcAddress);
  const vaultAddressIndexId = getVaultAddressIndexId(event.chainId, vaultAddress);
  const vaultAddressIndex = await context.VaultAddressIndex.get(vaultAddressIndexId);
  if (!vaultAddressIndex) return;

  const garden = normalizeAddress(vaultAddressIndex.garden);
  const asset = normalizeAddress(vaultAddressIndex.asset);
  const depositor = normalizeAddress(event.params.owner);
  const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
  const existingGardenVault = await context.GardenVault.get(gardenVaultId);
  if (!existingGardenVault) return;

  const depositId = getVaultDepositId(event.chainId, vaultAddress, depositor);
  const existingDeposit = await context.VaultDeposit.get(depositId);
  const nextShares = (existingDeposit?.shares ?? 0n) - event.params.shares;

  const nextDeposit: VaultDeposit = {
    id: depositId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    depositor,
    shares: nextShares > 0n ? nextShares : 0n,
    totalDeposited: existingDeposit?.totalDeposited ?? 0n,
    totalWithdrawn: (existingDeposit?.totalWithdrawn ?? 0n) + event.params.assets,
  };
  context.VaultDeposit.set(nextDeposit);

  context.GardenVault.set({
    ...existingGardenVault,
    totalWithdrawn: existingGardenVault.totalWithdrawn + event.params.assets,
  });

  const txHash = getTxHash(event.transaction);
  const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
  const vaultEvent: VaultEvent = {
    id: vaultEventId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    eventType: "WITHDRAW" as VaultEventType,
    actor: normalizeAddress(event.params.sender),
    amount: event.params.assets,
    shares: event.params.shares,
    txHash,
    timestamp: event.block.timestamp,
  };
  context.VaultEvent.set(vaultEvent);
});

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

// ============================================================================
// GARDENS MODULE EVENT HANDLERS
// ============================================================================

GardensModule.CommunityCreated.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<GardensModule_CommunityCreated_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const communityAddress = normalizeAddress(event.params.community);
    const communityId = getGardenCommunityId(event.chainId, garden);

    const existingCommunity = await context.GardenCommunity.get(communityId);
    if (existingCommunity) {
      // Idempotency: skip if community already exists for this garden
      return;
    }

    const communityEntity: GardenCommunity = {
      id: communityId,
      chainId: event.chainId,
      garden,
      communityAddress,
      weightScheme: mapWeightScheme(event.params.weightScheme),
      goodsToken: normalizeAddress(event.params.goodsToken),
      nftPowerRegistry: normalizeAddress(event.params.nftPowerRegistry),
      createdAt: event.block.timestamp,
    };

    context.GardenCommunity.set(communityEntity);

    context.log.info("Garden community created", {
      garden,
      communityAddress,
      weightScheme: communityEntity.weightScheme,
      chainId: event.chainId,
      blockNumber: event.block.number,
    });
  }
);

GardensModule.SignalPoolCreated.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<GardensModule_SignalPoolCreated_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const poolAddress = normalizeAddress(event.params.pool);
    const poolId = getGardenSignalPoolId(event.chainId, garden, poolAddress);

    const existingPool = await context.GardenSignalPool.get(poolId);
    if (existingPool) {
      return;
    }

    const poolEntity: GardenSignalPool = {
      id: poolId,
      chainId: event.chainId,
      garden,
      poolAddress,
      poolType: mapPoolType(event.params.poolType),
      communityAddress: normalizeAddress(event.params.community),
      createdAt: event.block.timestamp,
    };

    context.GardenSignalPool.set(poolEntity);

    context.log.info("Garden signal pool created", {
      garden,
      poolAddress,
      poolType: poolEntity.poolType,
      chainId: event.chainId,
      blockNumber: event.block.number,
    });
  }
);

GardensModule.PowerRegistryDeployed.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<GardensModule_PowerRegistryDeployed_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const registry = normalizeAddress(event.params.registry);
    const communityId = getGardenCommunityId(event.chainId, garden);

    const existingCommunity = await context.GardenCommunity.get(communityId);
    if (existingCommunity) {
      context.GardenCommunity.set({
        ...existingCommunity,
        powerRegistryAddress: registry,
      });
    }

    context.log.info("Power registry deployed", {
      garden,
      registry,
      weightScheme: mapWeightScheme(event.params.weightScheme),
      chainId: event.chainId,
      blockNumber: event.block.number,
    });
  }
);

GardensModule.GoodsAirdropped.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<GardensModule_GoodsAirdropped_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const txHash = getTxHash(event.transaction);
    const airdropId = getYieldEventId(event.chainId, txHash, event.logIndex);

    const airdropEntity: GoodsAirdropEntity = {
      id: airdropId,
      chainId: event.chainId,
      garden,
      totalAmount: event.params.totalAmount,
      txHash,
      timestamp: event.block.timestamp,
    };

    context.GoodsAirdrop.set(airdropEntity);

    context.log.info("GOODS tokens airdropped", {
      garden,
      totalAmount: event.params.totalAmount.toString(),
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: txHash,
    });
  }
);

// ============================================================================
// YIELD SPLITTER EVENT HANDLERS
// ============================================================================

YieldSplitter.YieldSplit.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<YieldSplitter_YieldSplit_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const txHash = getTxHash(event.transaction);
    const allocationId = getYieldAllocationId(event.chainId, txHash, event.logIndex);

    const allocationEntity: YieldAllocation = {
      id: allocationId,
      chainId: event.chainId,
      garden,
      asset,
      cookieJarAmount: event.params.cookieJarAmount,
      fractionsAmount: event.params.fractionsAmount,
      juiceboxAmount: event.params.juiceboxAmount,
      totalAmount:
        event.params.cookieJarAmount + event.params.fractionsAmount + event.params.juiceboxAmount,
      txHash,
      timestamp: event.block.timestamp,
    };

    context.YieldAllocation.set(allocationEntity);

    // Clear pending accumulation for this garden+asset after successful split
    const accumulationId = getYieldAccumulationId(event.chainId, garden, asset);
    const existingAccumulation = await context.YieldAccumulation.get(accumulationId);
    if (existingAccumulation && existingAccumulation.pendingAmount > 0n) {
      context.YieldAccumulation.set({
        ...existingAccumulation,
        pendingAmount: 0n,
        lastAccumulatedAt: event.block.timestamp,
      });
    }

    context.log.info("Yield split executed", {
      garden,
      asset,
      cookieJarAmount: event.params.cookieJarAmount.toString(),
      fractionsAmount: event.params.fractionsAmount.toString(),
      juiceboxAmount: event.params.juiceboxAmount.toString(),
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: txHash,
    });
  }
);

YieldSplitter.YieldAllocated.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<YieldSplitter_YieldAllocated_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const treasury = normalizeAddress(event.params.treasury);
    const txHash = getTxHash(event.transaction);
    const purchaseId = getYieldFractionPurchaseId(
      event.chainId,
      txHash,
      event.logIndex,
      event.params.hypercertId
    );

    // FractionPurchased event does not include asset address.
    // The asset can be derived from the garden's vault configuration if needed.
    const purchaseEntity: YieldFractionPurchase = {
      id: purchaseId,
      chainId: event.chainId,
      garden,
      hypercertId: event.params.hypercertId,
      amount: event.params.amount,
      fractionId: event.params.fractionId > 0n ? event.params.fractionId : undefined,
      treasury,
      txHash,
      timestamp: event.block.timestamp,
    };

    context.YieldFractionPurchase.set(purchaseEntity);

    context.log.info("Yield fraction purchased", {
      garden,
      treasury,
      hypercertId: event.params.hypercertId.toString(),
      amount: event.params.amount.toString(),
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: txHash,
    });
  }
);

YieldSplitter.YieldAccumulated.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<YieldSplitter_YieldAccumulated_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const accumulationId = getYieldAccumulationId(event.chainId, garden, asset);

    const accumulationEntity: YieldAccumulation = {
      id: accumulationId,
      chainId: event.chainId,
      garden,
      asset,
      pendingAmount: event.params.totalPending,
      lastAccumulatedAt: event.block.timestamp,
    };

    context.YieldAccumulation.set(accumulationEntity);

    context.log.info("Yield accumulated (below threshold)", {
      garden,
      asset,
      amount: event.params.amount.toString(),
      totalPending: event.params.totalPending.toString(),
      chainId: event.chainId,
      blockNumber: event.block.number,
    });
  }
);

YieldSplitter.YieldToCookieJar.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<YieldSplitter_YieldToCookieJar_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const jar = normalizeAddress(event.params.jar);
    const txHash = getTxHash(event.transaction);
    const transferId = getYieldEventId(event.chainId, txHash, event.logIndex);

    const transferEntity: YieldCookieJarTransferEntity = {
      id: transferId,
      chainId: event.chainId,
      garden,
      asset,
      amount: event.params.amount,
      jar,
      txHash,
      timestamp: event.block.timestamp,
    };

    context.YieldCookieJarTransfer.set(transferEntity);

    context.log.info("Yield routed to cookie jar", {
      garden,
      asset,
      amount: event.params.amount.toString(),
      jar,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: txHash,
    });
  }
);

YieldSplitter.YieldToJuicebox.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<YieldSplitter_YieldToJuicebox_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const txHash = getTxHash(event.transaction);
    const paymentId = getYieldEventId(event.chainId, txHash, event.logIndex);

    const paymentEntity: YieldJuiceboxPaymentEntity = {
      id: paymentId,
      chainId: event.chainId,
      garden,
      asset,
      amount: event.params.amount,
      projectId: event.params.projectId,
      txHash,
      timestamp: event.block.timestamp,
    };

    context.YieldJuiceboxPayment.set(paymentEntity);

    context.log.info("Yield routed to Juicebox", {
      garden,
      asset,
      amount: event.params.amount.toString(),
      projectId: event.params.projectId.toString(),
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: txHash,
    });
  }
);

YieldSplitter.YieldStranded.handler(
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<YieldSplitter_YieldStranded_eventArgs, void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const txHash = getTxHash(event.transaction);
    const strandedId = getYieldEventId(event.chainId, txHash, event.logIndex);

    const strandedEntity: YieldStrandedEntity = {
      id: strandedId,
      chainId: event.chainId,
      garden,
      asset,
      amount: event.params.amount,
      destination: event.params.destination,
      txHash,
      timestamp: event.block.timestamp,
    };

    context.YieldStranded.set(strandedEntity);

    context.log.warn("Yield stranded — no destination configured", {
      garden,
      asset,
      amount: event.params.amount.toString(),
      destination: event.params.destination,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: txHash,
    });
  }
);
