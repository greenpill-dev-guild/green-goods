import { GreenWill } from "../../generated";

import type {
  GreenWillBadgeDefinition,
  GreenWillBadgeGrant,
  GreenWillBadgeOwnership,
  GreenWill_BadgeClassConfigured_handlerArgs,
  GreenWill_BadgeIssued_handlerArgs,
} from "../../generated/src/Types.gen";

import {
  getGreenWillBadgeDefinitionId,
  getGreenWillBadgeOwnershipId,
  getTxHash,
  getVaultEventId,
  normalizeAddress,
  ZERO_ADDRESS,
} from "./shared";

function normalizeOptionalAddress(address: string): string | undefined {
  const normalized = normalizeAddress(address);
  return normalized === ZERO_ADDRESS ? undefined : normalized;
}

function normalizeBytes32(value: string): string {
  return value.toLowerCase();
}

GreenWill.BadgeClassConfigured.handler(
  async ({ event, context }: GreenWill_BadgeClassConfigured_handlerArgs<void>) => {
    const badgeId = normalizeBytes32(event.params.badgeId);
    const definitionId = getGreenWillBadgeDefinitionId(event.chainId, badgeId);
    const existingDefinition = await context.GreenWillBadgeDefinition.get(definitionId);

    const definition: GreenWillBadgeDefinition = {
      id: definitionId,
      chainId: event.chainId,
      badgeId,
      slug: event.params.slug,
      metadataURI: event.params.metadataURI,
      validator: normalizeOptionalAddress(event.params.validator),
      authorizedIssuer: normalizeOptionalAddress(event.params.authorizedIssuer),
      unlockLock: normalizeOptionalAddress(event.params.unlockLock),
      claimable: event.params.claimable,
      active: event.params.active,
      holderCount: existingDefinition?.holderCount ?? 0,
      grantCount: existingDefinition?.grantCount ?? 0,
      updatedAt: event.block.timestamp,
    };

    context.GreenWillBadgeDefinition.set(definition);
  }
);

GreenWill.BadgeIssued.handler(
  async ({ event, context }: GreenWill_BadgeIssued_handlerArgs<void>) => {
    const badgeId = normalizeBytes32(event.params.badgeId);
    const owner = normalizeAddress(event.params.account);
    const issuer = normalizeAddress(event.params.issuer);
    const sourceRef = normalizeBytes32(event.params.sourceRef);
    const txHash = getTxHash(event.transaction);
    const definitionId = getGreenWillBadgeDefinitionId(event.chainId, badgeId);
    const ownershipId = getGreenWillBadgeOwnershipId(event.chainId, badgeId, owner);
    const grantId = getVaultEventId(event.chainId, txHash, event.logIndex);

    const existingDefinition = await context.GreenWillBadgeDefinition.get(definitionId);
    const existingOwnership = await context.GreenWillBadgeOwnership.get(ownershipId);

    const definition: GreenWillBadgeDefinition = {
      id: definitionId,
      chainId: event.chainId,
      badgeId,
      slug: existingDefinition?.slug ?? "",
      metadataURI: existingDefinition?.metadataURI ?? "",
      validator: existingDefinition?.validator,
      authorizedIssuer: existingDefinition?.authorizedIssuer,
      unlockLock: existingDefinition?.unlockLock,
      claimable: existingDefinition?.claimable ?? false,
      active: existingDefinition?.active ?? true,
      holderCount: existingDefinition
        ? existingOwnership
          ? existingDefinition.holderCount
          : existingDefinition.holderCount + 1
        : 1,
      grantCount: (existingDefinition?.grantCount ?? 0) + 1,
      updatedAt: event.block.timestamp,
    };
    context.GreenWillBadgeDefinition.set(definition);

    const grant: GreenWillBadgeGrant = {
      id: grantId,
      chainId: event.chainId,
      badgeId,
      owner,
      sourceRef,
      issuer,
      unlockTokenId: event.params.unlockTokenId,
      txHash,
      timestamp: event.block.timestamp,
    };
    context.GreenWillBadgeGrant.set(grant);

    const ownership: GreenWillBadgeOwnership = {
      id: ownershipId,
      chainId: event.chainId,
      badgeId,
      owner,
      sourceRef,
      issuer,
      unlockTokenId: event.params.unlockTokenId,
      issuedAt: event.block.timestamp,
      definitionId,
      lastGrantId: grantId,
    };
    context.GreenWillBadgeOwnership.set(ownership);
  }
);
