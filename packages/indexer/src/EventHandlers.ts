// @ts-nocheck

import { ActionRegistry, type Capital, GardenAccount, GardenToken } from "generated";

type Action = {
  id: string;
  chainId: number;
  ownerAddress: string;
  startTime: bigint;
  endTime: bigint;
  title: string;
  instructions: string;
  capitals: Capital[];
  media: string[];
  createdAt: number;
};

type Garden = {
  id: string;
  chainId: number;
  tokenAddress: string;
  tokenID: bigint;
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  createdAt: number;
  gardeners: string[];
  operators: string[];
  gapProjectUID?: string; // Karma GAP project attestation UID
};

type GardenInvite = {
  id: string;
  garden: string;
  creator: string;
  expiry: bigint;
  used: boolean;
  usedBy?: string;
  createdAt: number;
  usedAt?: number;
  chainId: number;
};

type Gardener = {
  id: string;
  chainId: number;
  createdAt: number;
  firstGarden?: string;
  joinedVia?: string;
};

// Handler for the ActionRegistered event
ActionRegistry.ActionRegistered.handler(async ({ event, context }) => {
  // Create unique ID by combining chainId and actionUID to prevent cross-chain collisions
  const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
  const capitals: Capital[] = event.params.capitals.map((capital) => {
    const number = Number(capital);
    if (number === 0) {
      return "SOCIAL";
    }
    if (number === 1) {
      return "MATERIAL";
    }
    if (number === 2) {
      return "FINANCIAL";
    }
    if (number === 3) {
      return "LIVING";
    }
    if (number === 4) {
      return "INTELLECTUAL";
    }
    if (number === 5) {
      return "EXPERIENTIAL";
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
});

// Handler for the ActionStartTimeUpdated event
ActionRegistry.ActionStartTimeUpdated.handler(async ({ event, context }) => {
  const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
  const existingAction = await context.Action.get(actionId);

  if (existingAction) {
    const updatedAction: Action = {
      ...existingAction,
      startTime: event.params.startTime,
    };

    context.Action.set(updatedAction);
  }
});

// Handler for the ActionEndTimeUpdated event
ActionRegistry.ActionEndTimeUpdated.handler(async ({ event, context }) => {
  const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
  const existingAction = await context.Action.get(actionId);

  if (existingAction) {
    const updatedAction: Action = {
      ...existingAction,
      endTime: event.params.endTime,
    };

    context.Action.set(updatedAction);
  }
});

// Handler for the ActionTitleUpdated event
ActionRegistry.ActionTitleUpdated.handler(async ({ event, context }) => {
  const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
  const existingAction = await context.Action.get(actionId);

  if (existingAction) {
    const updatedAction: Action = {
      ...existingAction,
      title: event.params.title,
    };

    context.Action.set(updatedAction);
  }
});

// Handler for the ActionInstructionsUpdated event
ActionRegistry.ActionInstructionsUpdated.handler(async ({ event, context }) => {
  const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
  const existingAction = await context.Action.get(actionId);

  if (existingAction) {
    const updatedAction: Action = {
      ...existingAction,
      instructions: event.params.instructions,
    };

    context.Action.set(updatedAction);
  }
});

// Handler for the ActionMediaUpdated event
ActionRegistry.ActionMediaUpdated.handler(async ({ event, context }) => {
  const actionId = `${event.chainId}-${event.params.actionUID.toString()}`;
  const existingAction = await context.Action.get(actionId);

  if (existingAction) {
    const updatedAction: Action = {
      ...existingAction,
      media: event.params.media,
    };

    context.Action.set(updatedAction);
  }
});

// Register new GardenAccount contracts when gardens are minted
GardenToken.GardenMinted.contractRegister(({ event, context }) => {
  // Register the newly created garden account contract for event listening
  context.addGardenAccount(event.params.account);

  context.log.info(
    `Registered new GardenAccount at ${event.params.account} for garden ${event.params.name}`
  );
});

// Handler for the GardenMinted event
GardenToken.GardenMinted.handler(async ({ event, context }) => {
  // create a new Garden entity
  const gardenEntity: Garden = {
    id: event.params.account,
    chainId: event.chainId,
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

// Handler for the NameUpdated event
GardenAccount.NameUpdated.handler(async ({ event, context }) => {
  const gardenId = event.srcAddress;
  const existingGarden = await context.Garden.get(gardenId);

  if (existingGarden) {
    const updatedGarden: Garden = {
      ...existingGarden,
      name: event.params.newName,
    };

    context.Garden.set(updatedGarden);
  }
});

// Handler for the DescriptionUpdated event
GardenAccount.DescriptionUpdated.handler(async ({ event, context }) => {
  const gardenId = event.srcAddress;
  const existingGarden = await context.Garden.get(gardenId);

  if (existingGarden) {
    const updatedGarden: Garden = {
      ...existingGarden,
      description: event.params.newDescription,
    };

    context.Garden.set(updatedGarden);
  }
});

// Handler for the GardenerAdded event
GardenAccount.GardenerAdded.handler(async ({ event, context }) => {
  const gardenId = event.srcAddress;
  const existingGarden = await context.Garden.get(gardenId);

  if (existingGarden) {
    const updatedGardeners = [...existingGarden.gardeners, event.params.gardener];
    const updatedGarden: Garden = {
      ...existingGarden,
      gardeners: updatedGardeners,
    };

    context.Garden.set(updatedGarden);
  }
});

// Handler for the GardenerRemoved event
GardenAccount.GardenerRemoved.handler(async ({ event, context }) => {
  const gardenId = event.srcAddress;
  const existingGarden = await context.Garden.get(gardenId);

  if (existingGarden) {
    const updatedGardeners = existingGarden.gardeners.filter(
      (gardener) => gardener !== event.params.gardener
    );
    const updatedGarden: Garden = {
      ...existingGarden,
      gardeners: updatedGardeners,
    };

    context.Garden.set(updatedGarden);
  }
});

// Handler for the GardenOperatorAdded event
GardenAccount.GardenOperatorAdded.handler(async ({ event, context }) => {
  const gardenId = event.srcAddress;
  const existingGarden = await context.Garden.get(gardenId);

  if (existingGarden) {
    const updatedOperators = [...existingGarden.operators, event.params.operator];
    const updatedGarden: Garden = {
      ...existingGarden,
      operators: updatedOperators,
    };

    context.Garden.set(updatedGarden);
  }
});

// Handler for the GardenOperatorRemoved event
GardenAccount.GardenOperatorRemoved.handler(async ({ event, context }) => {
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
});

// Handler for the InviteCreated event
GardenAccount.InviteCreated.handler(async ({ event, context }) => {
  const inviteId = event.params.inviteCode;

  const inviteEntity: GardenInvite = {
    id: inviteId,
    garden: event.params.garden,
    creator: event.params.creator,
    expiry: event.params.expiry,
    used: false,
    createdAt: event.block.timestamp,
    chainId: event.chainId,
  };

  context.GardenInvite.set(inviteEntity);
});

// Handler for the InviteUsed event
GardenAccount.InviteUsed.handler(async ({ event, context }) => {
  const inviteId = event.params.inviteCode;
  const userAddress = event.params.user;

  // Update invite status
  const existingInvite = await context.GardenInvite.get(inviteId);
  if (existingInvite) {
    const updatedInvite: GardenInvite = {
      ...existingInvite,
      used: true,
      usedBy: userAddress,
      usedAt: event.block.timestamp,
    };

    context.GardenInvite.set(updatedInvite);
  }

  // Create or update Gardener entity
  const existingGardener = await context.Gardener.get(userAddress);
  if (!existingGardener) {
    // New gardener - track their first garden and invite
    const gardenerEntity: Gardener = {
      id: userAddress,
      chainId: event.chainId,
      createdAt: event.block.timestamp,
      firstGarden: event.params.garden,
      joinedVia: inviteId,
    };

    context.Gardener.set(gardenerEntity);
  }
});

// Handler for the InviteRevoked event
GardenAccount.InviteRevoked.handler(async ({ event, context }) => {
  const inviteId = event.params.inviteCode;

  // Delete the invite from the database
  context.GardenInvite.deleteUnsafe(inviteId);
});

// Handler for the GAPProjectCreated event
GardenAccount.GAPProjectCreated.handler(async ({ event, context }) => {
  const gardenId = event.params.gardenAddress;
  const existingGarden = await context.Garden.get(gardenId);

  if (existingGarden) {
    // Update the garden with the Karma GAP project UID
    const updatedGarden: Garden = {
      ...existingGarden,
      gapProjectUID: event.params.projectUID,
    };

    context.Garden.set(updatedGarden);

    context.log.info(`Updated Garden ${gardenId} with GAP project UID: ${event.params.projectUID}`);
  } else {
    context.log.warn(`Garden ${gardenId} not found when processing GAPProjectCreated event`);
  }
});
