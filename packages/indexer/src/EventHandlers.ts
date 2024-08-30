import {
  ActionRegistry,
  GardenToken,
  GardenAccount,
  Capital,
  Action,
  Garden,
} from "generated";

// Handler for the ActionRegistered event
ActionRegistry.ActionRegistered.handler(async ({ event, context }) => {
  const actionId = event.params.actionUID.toString();

  const capitals: Capital[] = event.params.action[4].map((capital) => {
    const number = Number(capital);
    if (number === 1) {
      return "SOCIAL";
    } else if (number === 2) {
      return "MATERIAL";
    } else if (number === 3) {
      return "FINANCIAL";
    } else if (number === 4) {
      return "LIVING";
    } else if (number === 5) {
      return "INTELLECTUAL";
    } else if (number === 6) {
      return "SPIRITUAL";
    } else if (number === 7) {
      return "CULTURAL";
    } else {
      return "UNKNOWN";
    }
  });

  // // Update or create a new Action entity
  const actionEntity: Action = {
    id: actionId,
    ownerAddress: event.params.owner,
    startTime: event.params.action[0],
    endTime: event.params.action[1],
    title: event.params.action[2],
    instructions: event.params.action[3],
    capitals,
    media: event.params.action[5],
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
    name: "",
    description: "",
    gardeners: [],
    operators: [],
    tokenAddress: event.srcAddress,
    tokenID: event.params.tokenId,
    createdAt: event.block.timestamp,
  };

  context.Garden.set(gardenEntity);
});

GardenToken.GardenMinted.contractRegister(({ event, context }) => {
  context.addGardenAccount(event.params.account);
});

// Handler for the GardenNameUpdated event
GardenAccount.NameUpdated.handler(async ({ event, context }) => {
  const gardenAccount = event.srcAddress;
  const gardenAccountEntity = await context.Garden.get(gardenAccount);

  if (gardenAccountEntity) {
    context.Garden.set({
      ...gardenAccountEntity,
      name: event.params.newName,
    });
  }
});

// Handler for the GardenDescriptionUpdated event
GardenAccount.DescriptionUpdated.handler(async ({ event, context }) => {
  const gardenAccount = event.srcAddress;
  const gardenAccountEntity = await context.Garden.get(gardenAccount);

  if (gardenAccountEntity) {
    context.Garden.set({
      ...gardenAccountEntity,
      description: event.params.newDescription,
    });
  }
});

// Handler for the GardenerAdded event
GardenAccount.GardenerAdded.handler(async ({ event, context }) => {
  const gardenAccount = event.srcAddress;
  const gardenAccountEntity = await context.Garden.get(gardenAccount);

  if (gardenAccountEntity) {
    context.Garden.set({
      ...gardenAccountEntity,
      gardeners: [...gardenAccountEntity.gardeners, event.params.gardener],
    });
  }
});

// Handler for the GardenerRemoved event
GardenAccount.GardenerRemoved.handler(async ({ event, context }) => {
  const gardenAccount = event.srcAddress;
  const gardenAccountEntity = await context.Garden.get(gardenAccount);

  if (gardenAccountEntity) {
    context.Garden.set({
      ...gardenAccountEntity,
      gardeners: gardenAccountEntity.gardeners.filter(
        (g) => g !== event.params.gardener
      ),
    });
  }
});

// Handler for the GardenOperatorAdded event
GardenAccount.GardenOperatorAdded.handler(async ({ event, context }) => {
  const gardenAccount = event.srcAddress;
  const gardenAccountEntity = await context.Garden.get(gardenAccount);

  if (gardenAccountEntity) {
    context.Garden.set({
      ...gardenAccountEntity,
      operators: [...gardenAccountEntity.operators, event.params.operator],
    });
  }
});

// Handler for the GardenAccount GardenOperatorRemoved event
GardenAccount.GardenOperatorRemoved.handler(async ({ event, context }) => {
  const gardenAccount = event.srcAddress;
  const gardenAccountEntity = await context.Garden.get(gardenAccount);

  if (gardenAccountEntity) {
    context.Garden.set({
      ...gardenAccountEntity,
      operators: gardenAccountEntity.operators.filter(
        (g) => g !== event.params.operator
      ),
    });
  }
});
