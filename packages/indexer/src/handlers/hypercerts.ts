import { HypercertMinter, HypercertStatus } from "../../generated";

import type {
  Hypercert,
  HypercertClaim,
  HypercertMinter_TransferSingle_handlerArgs,
  HypercertMinter_ClaimStored_handlerArgs,
} from "../../generated/src/Types.gen";

import {
  getTxHash,
  fetchJson,
  parseHypercertMetadata,
  createDefaultHypercert,
  ZERO_ADDRESS,
} from "./shared";

// ============================================================================
// HYPERCERT EVENT HANDLERS
// ============================================================================

// Handler for HypercertMinter TransferSingle event (detects mints)
// This fires for all ERC1155 transfers, we filter for mints (from = zero address)
HypercertMinter.TransferSingle.handler(
  async ({ event, context }: HypercertMinter_TransferSingle_handlerArgs<void>) => {
    // Only process mints (from zero address)
    if (event.params.from.toLowerCase() !== ZERO_ADDRESS) {
      return;
    }

    const tokenId = event.params.id;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    // Check if hypercert already exists (may be created by ClaimStored event first)
    const existingHypercert = await context.Hypercert.get(hypercertId);

    if (existingHypercert) {
      // Idempotency: skip if this is the same transaction replaying
      if (existingHypercert.txHash === getTxHash(event.transaction)) {
        return;
      }

      const hasMintedBy = Boolean(existingHypercert.mintedBy);

      if (!hasMintedBy) {
        // Update with mint details
        const updatedHypercert: Hypercert = {
          ...existingHypercert,
          totalUnits: existingHypercert.totalUnits || event.params.value,
          mintedBy: event.params.operator,
          mintedAt: timestamp,
          txHash: getTxHash(event.transaction),
          updatedAt: timestamp,
        };
        context.Hypercert.set(updatedHypercert);
        context.log.info("Hypercert minted", {
          hypercertId,
          units: event.params.value,
          chainId: event.chainId,
          blockNumber: event.block.number,
          txHash: getTxHash(event.transaction),
        });
        return;
      }

      // Treat subsequent mint-from-zero transfers as claims
      const claimant = event.params.to;
      const claimId = `${event.chainId}-${tokenId.toString()}-${claimant}`;

      // Idempotency: check if claim already exists
      const existingClaim = await context.HypercertClaim.get(claimId);
      if (existingClaim) {
        return;
      }

      const claim: HypercertClaim = {
        id: claimId,
        chainId: event.chainId,
        hypercertId,
        claimant,
        units: event.params.value,
        claimedAt: timestamp,
        txHash: getTxHash(event.transaction),
      };
      context.HypercertClaim.set(claim);

      const newClaimedUnits = existingHypercert.claimedUnits + event.params.value;
      const isFullyClaimed = newClaimedUnits >= existingHypercert.totalUnits;
      const newStatus: HypercertStatus = isFullyClaimed ? "CLAIMED" : existingHypercert.status;

      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        claimedUnits: newClaimedUnits,
        status: newStatus,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);

      context.log.info("Hypercert claimed", {
        hypercertId,
        claimant,
        units: event.params.value,
        chainId: event.chainId,
        blockNumber: event.block.number,
        correlationId: getTxHash(event.transaction),
      });
      return;
    }

    // Create new hypercert entity
    const newHypercert: Hypercert = {
      ...createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp),
      totalUnits: event.params.value,
      mintedBy: event.params.operator,
      txHash: getTxHash(event.transaction),
    };
    context.Hypercert.set(newHypercert);

    context.log.info("Hypercert minted", {
      hypercertId,
      units: event.params.value,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: getTxHash(event.transaction),
    });
  }
);

// Handler for HypercertMinter ClaimStored event (stores metadata URI)
HypercertMinter.ClaimStored.handler(
  async ({ event, context }: HypercertMinter_ClaimStored_handlerArgs<void>) => {
    const tokenId = event.params.claimID;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    const existingHypercert = await context.Hypercert.get(hypercertId);

    const baseHypercert =
      existingHypercert ?? createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp);

    const metadata = await fetchJson(event.params.uri, {
      eventType: "ClaimStored",
      chainId: event.chainId,
      blockNumber: event.block.number,
      txHash: getTxHash(event.transaction),
      log: context.log,
    });

    const parsedMetadata = metadata ? parseHypercertMetadata(metadata) : {};
    const parsedAttestationUIDs = parsedMetadata.attestationUIDs;

    const updatedHypercert: Hypercert = {
      ...baseHypercert,
      metadataUri: event.params.uri,
      totalUnits: event.params.totalUnits,
      updatedAt: timestamp,
      ...(parsedMetadata.gardenId ? { garden: parsedMetadata.gardenId } : {}),
      ...(parsedAttestationUIDs
        ? {
            attestationUIDs: parsedAttestationUIDs,
            attestationCount: parsedAttestationUIDs.length,
          }
        : {}),
    };

    context.Hypercert.set(updatedHypercert);

    context.log.info("Hypercert claim stored", {
      hypercertId,
      uri: event.params.uri,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: getTxHash(event.transaction),
    });
  }
);
