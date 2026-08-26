import { indexer, type Garden, type KarmaProjectAccess } from "envio";

import {
  addUniqueAddress,
  createDefaultGarden,
  GARDEN_ROLE,
  normalizeAddress,
  removeAddress,
} from "./shared";
import { getKarmaProjectAccessId } from "./ids";

function markKarmaAccessPending(garden: Garden, account: string, role: number): Garden {
  if (role !== GARDEN_ROLE.Steward && role !== GARDEN_ROLE.Owner) return garden;

  return {
    ...garden,
    karmaMembershipState: "PENDING",
    karmaMembershipPendingAccounts: addUniqueAddress(
      garden.karmaMembershipPendingAccounts ?? [],
      account
    ),
    karmaAccessState: "PENDING",
    karmaAccessPendingAccounts: addUniqueAddress(garden.karmaAccessPendingAccounts ?? [], account),
  };
}

async function setPendingAccessAggregate(
  context: Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"],
  chainId: number,
  garden: string,
  account: string,
  timestamp: number,
  projectUID?: string
) {
  const id = getKarmaProjectAccessId(chainId, garden, account);
  const existing = await context.KarmaProjectAccess.get(id);
  const base: KarmaProjectAccess = existing ?? {
    id,
    chainId,
    garden: normalizeAddress(garden),
    account: normalizeAddress(account),
    projectUID,
    membershipState: "UNKNOWN",
    membershipOutcome: undefined,
    membershipReason: undefined,
    membershipUpdatedAt: undefined,
    accessState: "UNKNOWN",
    accessOutcome: undefined,
    accessReason: undefined,
    accessUpdatedAt: undefined,
  };

  context.KarmaProjectAccess.set({
    ...base,
    projectUID: projectUID ?? base.projectUID,
    membershipState: "PENDING",
    membershipUpdatedAt: timestamp,
    accessState: "PENDING",
    accessUpdatedAt: timestamp,
  });
}

// ============================================================================
// HATS MODULE EVENT HANDLERS
// ============================================================================

indexer.onEvent({ contract: "HatsModule", event: "RoleGranted" }, async ({ event, context }) => {
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
  } else if (role === GARDEN_ROLE.Steward) {
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
    const projectedGarden = markKarmaAccessPending(
      {
        ...existingGarden,
        gardeners: updatedGardeners,
        operators: updatedOperators,
        evaluators: updatedEvaluators,
        owners: updatedOwners,
        funders: updatedFunders,
        communities: updatedCommunities,
      },
      account,
      role
    );
    context.Garden.set(projectedGarden);

    if (role === GARDEN_ROLE.Steward || role === GARDEN_ROLE.Owner) {
      await setPendingAccessAggregate(
        context,
        event.chainId,
        gardenId,
        account,
        event.block.timestamp,
        existingGarden.gapProjectUID
      );
    }
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
});

indexer.onEvent({ contract: "HatsModule", event: "RoleRevoked" }, async ({ event, context }) => {
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

  if (role === GARDEN_ROLE.Steward) {
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
    const projectedGarden = markKarmaAccessPending(
      {
        ...existingGarden,
        gardeners: updatedGardeners,
        operators: updatedOperators,
        evaluators: updatedEvaluators,
        owners: updatedOwners,
        funders: updatedFunders,
        communities: updatedCommunities,
      },
      account,
      role
    );
    context.Garden.set(projectedGarden);

    if (role === GARDEN_ROLE.Steward || role === GARDEN_ROLE.Owner) {
      await setPendingAccessAggregate(
        context,
        event.chainId,
        gardenId,
        account,
        event.block.timestamp,
        existingGarden.gapProjectUID
      );
    }
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
});
