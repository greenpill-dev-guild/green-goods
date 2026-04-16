/**
 * Upload Metadata Service
 *
 * XState actor that validates and uploads hypercert metadata to IPFS.
 *
 * @module hooks/hypercerts/services/upload-metadata
 */

import { fromPromise } from "xstate";

import { validateMetadata } from "../../../lib/hypercerts";
import { uploadJSONToIPFS } from "../../../modules";
import { logger } from "../../../modules/app/logger";
import type { MintHypercertInput } from "../../../workflows/mintHypercert";
import type { MintServiceDeps } from "./types";

/**
 * Creates the uploadMetadata actor for the mint hypercert machine.
 *
 * Validates metadata fields, then uploads the JSON blob to IPFS via Storacha.
 */
export function createUploadMetadataActor(deps: MintServiceDeps) {
  return fromPromise(async ({ input }: { input: MintHypercertInput }) => {
    logger.debug("[useMintHypercert] uploadMetadata actor starting", { hasInput: !!input });
    const validation = validateMetadata(input.metadata);
    if (!validation.valid) {
      const message = Object.values(validation.errors ?? {}).join(", ") || "Invalid metadata";
      throw new Error(message);
    }

    const result = await uploadJSONToIPFS(input.metadata as unknown as Record<string, unknown>, {
      source: "hypercert-minting-metadata",
      gardenAddress: input.gardenAddress,
      authMode: deps.authModeRef.current,
      metadataType: "hypercert",
    });

    return { cid: result.cid };
  });
}
