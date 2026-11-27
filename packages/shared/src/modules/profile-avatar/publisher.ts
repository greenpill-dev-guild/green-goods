import type { AccountFactoryArgs } from "../auth/account-message-signer";
import type { Address } from "../../types/domain";
import {
  buildProfileAvatarMessage,
  type ProfileAvatarMutation,
  type ProfileAvatarRecord,
} from "../../public-contracts/profile-avatar";
import { logger } from "../app/logger";
import {
  ProfileAvatarTransportError,
  type ProfileAvatarPublishDependencies,
  type ProfileAvatarPublishInput,
} from "./types";

function targetUri(input: ProfileAvatarPublishInput): string | null {
  return input.action === "clear" ? null : input.cid ? `ipfs://${input.cid}` : null;
}

function mutationFor(
  avatarUri: string | null,
  expectedVersion: number,
  signature: `0x${string}`,
  issuedAt: number,
  factoryArgs?: AccountFactoryArgs
): ProfileAvatarMutation {
  return {
    avatarUri,
    expectedVersion,
    issuedAt,
    signature,
    ...(factoryArgs?.factory && factoryArgs.factoryData
      ? { factory: factoryArgs.factory as `0x${string}`, factoryData: factoryArgs.factoryData }
      : {}),
  };
}

async function signedMutation(
  dependencies: ProfileAvatarPublishDependencies,
  chainId: number,
  address: Address,
  avatarUri: string | null,
  expectedVersion: number
): Promise<ProfileAvatarMutation> {
  dependencies.onStage?.("signing");
  const factoryArgs = await dependencies.getFactoryArgs?.();
  const issuedAt = Math.floor((dependencies.now?.() ?? Date.now()) / 1000);
  const signature = await dependencies.sign(
    buildProfileAvatarMessage({ chainId, address, avatarUri, expectedVersion, issuedAt })
  );
  return mutationFor(avatarUri, expectedVersion, signature, issuedAt, factoryArgs);
}

/**
 * Runs one explicit publish/continue action. Draft restoration deliberately only
 * reads state; no signing, upload, or POST can happen until this function is called.
 */
export async function publishProfileAvatar(
  chainId: number,
  address: Address,
  initialInput: ProfileAvatarPublishInput,
  dependencies: ProfileAvatarPublishDependencies
): Promise<ProfileAvatarRecord> {
  let input = initialInput;
  if (input.action === "set" && !input.cid) {
    if (!input.file) throw new Error("Choose a profile photo first.");
    dependencies.onStage?.("normalizing");
    const file = await dependencies.normalize(input.file);
    input = { action: "set", file };
  }
  await dependencies.saveDraft(input);

  const current = await dependencies.get(chainId, address);
  if (input.action === "set" && !input.cid) {
    dependencies.onStage?.("uploading");
    const { cid } = await dependencies.upload(input.file!);
    input = { ...input, cid };
    await dependencies.saveDraft(input);
  }
  const avatarUri = targetUri(input);
  if (input.action === "set" && !avatarUri)
    throw new Error("Profile image upload did not return a CID.");
  // A prior request may have completed after the client timed out.
  if (current.avatarUri === avatarUri) {
    await clearDraftAfterSave(dependencies);
    return current;
  }
  // Only the signature and the save are the send: a photo already in place sent nothing above.
  const recordSend = dependencies.recordSend ?? ((run) => run());
  const saved = await recordSend(async () => {
    const mutation = await signedMutation(
      dependencies,
      chainId,
      address,
      avatarUri,
      current.version
    );
    dependencies.onStage?.("saving");
    try {
      return await dependencies.save(chainId, address, mutation);
    } catch (error) {
      if (!(error instanceof ProfileAvatarTransportError)) throw error;
      const isVersionConflict = error.errorCode === "version_conflict";
      if (!error.isAmbiguous && !isVersionConflict) throw error;
      const refreshed = await dependencies.get(chainId, address);
      if (refreshed.avatarUri === avatarUri) return refreshed;
      // Another signature requires another explicit action from the gardener.
      throw error;
    }
  });
  await clearDraftAfterSave(dependencies);
  return saved;
}

/**
 * The server holds the photo now. Clearing the local draft is cleanup outside the recorded send,
 * so a failed cleanup never turns a saved photo into a failed act (PRD-1561); a draft left behind
 * matches the saved photo, and the next publish clears it without sending.
 */
async function clearDraftAfterSave(dependencies: ProfileAvatarPublishDependencies): Promise<void> {
  try {
    await dependencies.clearDraft();
  } catch (error) {
    logger.warn("Profile photo saved, but its local draft could not be cleared", { error });
  }
}
