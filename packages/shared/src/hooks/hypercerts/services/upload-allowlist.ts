/**
 * Upload Allowlist Service
 *
 * XState actor that validates an allowlist, generates a Merkle tree,
 * and uploads the serialized tree to IPFS.
 *
 * @module hooks/hypercerts/services/upload-allowlist
 */

import { validateAllowlist as sdkValidateAllowlist } from "@hypercerts-org/sdk";
import { fromPromise } from "xstate";

import { generateMerkleTree } from "../../../lib/hypercerts";
import { uploadJSONToIPFS } from "../../../modules";
import type { MintHypercertInput } from "../../../workflows/mintHypercert";
import { serializeAllowlistTree } from "../hypercert-utils";
import type { MintServiceDeps } from "./types";

/**
 * Creates the uploadAllowlist actor for the mint hypercert machine.
 *
 * Validates the allowlist via the Hypercerts SDK, generates a Merkle tree,
 * serializes it, and uploads to IPFS.
 */
export function createUploadAllowlistActor(deps: MintServiceDeps) {
  return fromPromise(async ({ input }: { input: MintHypercertInput }) => {
    const validation = sdkValidateAllowlist(input.allowlist, input.totalUnits);
    if (!validation.valid) {
      const message = Object.values(validation.errors ?? {}).join(", ") || "Invalid allowlist";
      throw new Error(message);
    }

    const tree = generateMerkleTree(input.allowlist);
    const payload = serializeAllowlistTree(tree.tree);

    const result = await uploadJSONToIPFS(payload as unknown as Record<string, unknown>, {
      source: "hypercert-minting-allowlist",
      gardenAddress: input.gardenAddress,
      authMode: deps.authModeRef.current,
      metadataType: "hypercert-allowlist",
    });

    return { cid: result.cid, merkleRoot: tree.root };
  });
}
