import { indexer } from "envio";
import { ActionRegistry } from "../../generated";

import type {
  Action,
  ActionRegistry_ActionEndTimeUpdated_handlerArgs,
  ActionRegistry_ActionInstructionsUpdated_handlerArgs,
  ActionRegistry_ActionMediaUpdated_handlerArgs,
  ActionRegistry_ActionRegistered_handlerArgs,
  ActionRegistry_ActionStartTimeUpdated_handlerArgs,
  ActionRegistry_ActionTitleUpdated_handlerArgs,
  HandlerTypes_handlerArgs,
} from "../../generated/src/Types.gen";

import {
  type ActionRegistry_GardenDomainsUpdated_eventArgs,
  expandDomainMask,
  type GardenDomainsEntity,
  mapCapitalType,
  mapDomainType,
  normalizeAddress,
} from "./shared";

// ============================================================================
// ACTION REGISTRY EVENT HANDLERS
// ============================================================================

// Handler for the ActionRegistered event
indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionRegistered" },
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
      slug: event.params.slug,
      instructions: event.params.instructions,
      capitals,
      media: event.params.media,
      domain: mapDomainType(event.params.domain),
      createdAt: event.block.timestamp,
    };

    context.Action.set(actionEntity);
  }
);

// Handler for the GardenDomainsUpdated event
indexer.onEvent(
  { contract: "ActionRegistry", event: "GardenDomainsUpdated" },
  async ({
    event,
    context,
  }: HandlerTypes_handlerArgs<ActionRegistry_GardenDomainsUpdated_eventArgs, void>) => {
    const gardenAddress = normalizeAddress(event.params.garden);
    const domainMask = Number(event.params.domainMask);
    const entityId = `${event.chainId}-${gardenAddress}`;

    const gardenDomainsEntity: GardenDomainsEntity = {
      id: entityId,
      chainId: event.chainId,
      garden: gardenAddress,
      domainMask,
      domains: expandDomainMask(domainMask),
      updatedAt: event.block.timestamp,
    };

    context.GardenDomains.set(gardenDomainsEntity);
  }
);

// Handler for the ActionStartTimeUpdated event
indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionStartTimeUpdated" },
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
indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionEndTimeUpdated" },
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
indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionTitleUpdated" },
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
indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionInstructionsUpdated" },
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
indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionMediaUpdated" },
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
