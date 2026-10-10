import { indexer, type Garden } from "envio";

import { createDefaultGarden } from "./shared";

function markKarmaDetailsPending(garden: Garden, timestamp: number): Garden {
  return {
    ...garden,
    karmaDetailsState: "PENDING",
    karmaDetailsReason: "garden_metadata_changed",
    karmaDetailsUpdatedAt: timestamp,
  };
}

// ============================================================================
// GARDEN TOKEN EVENT HANDLERS
// ============================================================================

// Register new GardenAccount contracts when gardens are minted
indexer.contractRegister(
  { contract: "GardenToken", event: "GardenMinted" },
  async ({ event, context }) => {
    // Register the newly created garden account contract for event listening
    context.chain.GardenAccount.add(event.params.account);

    context.log.info(
      `Registered new GardenAccount at ${event.params.account} (tokenId: ${event.params.tokenId})`
    );
  }
);

// Handler for the GardenMinted event
indexer.onEvent({ contract: "GardenToken", event: "GardenMinted" }, async ({ event, context }) => {
  const gardenId = event.params.account;
  const existingGarden =
    (await context.Garden.get(gardenId)) ??
    createDefaultGarden(gardenId, event.chainId, event.block.timestamp);

  // Preserve any earlier module/role projections if logs are delivered out of their usual order.
  const gardenEntity: Garden = {
    ...existingGarden,
    id: gardenId,
    chainId: event.chainId,
    name: event.params.name,
    description: event.params.description,
    location: event.params.location,
    bannerImage: event.params.bannerImage,
    openJoining: event.params.openJoining,
    initialized: true,
    tokenAddress: event.srcAddress,
    tokenID: event.params.tokenId,
    createdAt: event.block.timestamp,
  };
  context.Garden.set(gardenEntity);
});

// ============================================================================
// GARDEN ACCOUNT EVENT HANDLERS
// ============================================================================

// Handler for the NameUpdated event
indexer.onEvent({ contract: "GardenAccount", event: "NameUpdated" }, async ({ event, context }) => {
  const gardenId = event.srcAddress;
  let existingGarden = await context.Garden.get(gardenId);

  if (!existingGarden) {
    // Create minimal garden if it doesn't exist yet
    existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
  }

  const updatedGarden = markKarmaDetailsPending(
    { ...existingGarden, name: event.params.newName },
    event.block.timestamp
  );

  context.Garden.set(updatedGarden);
});

// Handler for the DescriptionUpdated event
indexer.onEvent(
  { contract: "GardenAccount", event: "DescriptionUpdated" },
  async ({ event, context }) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden = markKarmaDetailsPending(
      { ...existingGarden, description: event.params.newDescription },
      event.block.timestamp
    );

    context.Garden.set(updatedGarden);
  }
);

// Handler for the LocationUpdated event
indexer.onEvent(
  { contract: "GardenAccount", event: "LocationUpdated" },
  async ({ event, context }) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden = markKarmaDetailsPending(
      { ...existingGarden, location: event.params.newLocation },
      event.block.timestamp
    );

    context.Garden.set(updatedGarden);
  }
);

// Handler for the BannerImageUpdated event
indexer.onEvent(
  { contract: "GardenAccount", event: "BannerImageUpdated" },
  async ({ event, context }) => {
    const gardenId = event.srcAddress;
    let existingGarden = await context.Garden.get(gardenId);

    if (!existingGarden) {
      existingGarden = createDefaultGarden(gardenId, event.chainId, event.block.timestamp);
    }

    const updatedGarden = markKarmaDetailsPending(
      { ...existingGarden, bannerImage: event.params.newBannerImage },
      event.block.timestamp
    );

    context.Garden.set(updatedGarden);
  }
);

// Handler for the OpenJoiningUpdated event
indexer.onEvent(
  { contract: "GardenAccount", event: "OpenJoiningUpdated" },
  async ({ event, context }) => {
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
