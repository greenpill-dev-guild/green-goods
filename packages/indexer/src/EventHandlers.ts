import { type Action, ActionRegistry, type Capital, type Garden, GardenToken } from "generated";

// Handler for the ActionRegistered event
ActionRegistry.ActionRegistered.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();
  const capitals: Capital[] = event.params.capitals.map((capital) => {
    const number = Number(capital);
    if (number === 1) {
      return "SOCIAL";
    }
    if (number === 2) {
      return "MATERIAL";
    }
    if (number === 3) {
      return "FINANCIAL";
    }
    if (number === 4) {
      return "LIVING";
    }
    if (number === 5) {
      return "INTELLECTUAL";
    }
    if (number === 6) {
      return "SPIRITUAL";
    }
    if (number === 7) {
      return "CULTURAL";
    }
    return "UNKNOWN";
  });

  // Update or create a new Action entity
  const actionEntity: Action = {
    id: actionId,
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
});

// Handler for the ActionStartTimeUpdated event
ActionRegistry.ActionStartTimeUpdated.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();

  const currentActionEntity = await context.Action.get(actionId);

  if (currentActionEntity) {
    // Clear the latestGreeting
    context.Action.set({
      ...currentActionEntity,
      startTime: event.params.startTime,
    });
  }
});

// Handler for the ActionEndTimeUpdated event
ActionRegistry.ActionEndTimeUpdated.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();

  const currentActionEntity = await context.Action.get(actionId);

  if (currentActionEntity) {
    // Clear the latestGreeting
    context.Action.set({
      ...currentActionEntity,
      endTime: event.params.endTime,
    });
  }
});

// Handler for the ActionTitleUpdated event
ActionRegistry.ActionTitleUpdated.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();

  const currentActionEntity = await context.Action.get(actionId);

  if (currentActionEntity) {
    // Clear the latestGreeting
    context.Action.set({
      ...currentActionEntity,
      title: event.params.title,
    });
  }
});

// Handler for the ActionInstructionsUpdated event
ActionRegistry.ActionInstructionsUpdated.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();

  const currentActionEntity = await context.Action.get(actionId);

  if (currentActionEntity) {
    // Clear the latestGreeting
    context.Action.set({
      ...currentActionEntity,
      instructions: event.params.instructions,
    });
  }
});

// Handler for the ActionMediaUpdated event
ActionRegistry.ActionMediaUpdated.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();

  const currentActionEntity = await context.Action.get(actionId);

  if (currentActionEntity) {
    // Clear the latestGreeting
    context.Action.set({
      ...currentActionEntity,
      media: event.params.media,
    });
  }
});

// Handler for the GardenMinted event
GardenToken.GardenMinted.handler(async ({ event, context }) => {
  // create a new Garden entity
  const gardenEntity: Garden = {
    id: event.params.account,
    name: event.params.name,
    description: event.params.description,
    bannerImage: event.params.bannerImage,
    location: event.params.location,
    gardeners: event.params.gardeners,
    operators: event.params.gardenOperators,
    tokenAddress: event.srcAddress,
    tokenID: event.params.tokenId,
    createdAt: event.block.timestamp,
  };

  context.Garden.set(gardenEntity);
});

// Note: GardenAccount event handlers removed as GardenAccount contract is not deployed
