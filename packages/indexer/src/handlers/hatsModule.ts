import { HatsModule } from "../../generated";

import type { HandlerTypes_handlerArgs } from "../../generated/src/Types.gen";

import {
  addUniqueAddress,
  createDefaultGarden,
  GARDEN_ROLE,
  type HatsModule_RoleGranted_eventArgs,
  type HatsModule_RoleRevoked_eventArgs,
  normalizeAddress,
  removeAddress,
} from "./shared";

// ============================================================================
// HATS MODULE EVENT HANDLERS
// ============================================================================

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
