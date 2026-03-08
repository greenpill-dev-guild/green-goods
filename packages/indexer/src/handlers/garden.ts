import { GardenAccount, GardenToken } from "../../generated";

import type {
  contractRegistrations,
  Garden,
  GardenAccount_BannerImageUpdated_handlerArgs,
  GardenAccount_DescriptionUpdated_handlerArgs,
  GardenAccount_GAPProjectCreated_handlerArgs,
  GardenAccount_LocationUpdated_handlerArgs,
  GardenAccount_NameUpdated_handlerArgs,
  GardenAccount_OpenJoiningUpdated_handlerArgs,
  GardenToken_GardenMinted_eventArgs,
  GardenToken_GardenMinted_handlerArgs,
  HandlerTypes_contractRegisterArgs,
} from "../../generated/src/Types.gen";

import { createDefaultGarden } from "./shared";

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
      initialized: true,
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
