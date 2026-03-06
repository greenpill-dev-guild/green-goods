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
ActionRegistry.GardenDomainsUpdated.handler(
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
