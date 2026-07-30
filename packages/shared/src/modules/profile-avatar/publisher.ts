import type { Address } from "../../types/domain";
import {
  buildProfileAvatarMessage,
  type ProfileAvatarMutation,
  type ProfileAvatarRecord,
} from "../../public-contracts/profile-avatar";
import {
  ProfileAvatarTransportError,
  type ProfileAvatarFactoryArgs,
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
  factoryArgs?: ProfileAvatarFactoryArgs
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
  let mutation = await signedMutation(dependencies, chainId, address, avatarUri, current.version);
  dependencies.onStage?.("saving");
  try {
    const record = await dependencies.save(chainId, address, mutation);
    await dependencies.clearDraft();
    return record;
  } catch (error) {
    if (!(error instanceof ProfileAvatarTransportError)) throw error;
    const isVersionConflict = error.errorCode === "version_conflict";
    if (!error.isAmbiguous && !isVersionConflict) throw error;
    const refreshed = await dependencies.get(chainId, address);
    if (refreshed.avatarUri === avatarUri) {
      await dependencies.clearDraft();
      return refreshed;
    }
    if (isVersionConflict) throw error;
    mutation = await signedMutation(dependencies, chainId, address, avatarUri, refreshed.version);
    dependencies.onStage?.("saving");
    const record = await dependencies.save(chainId, address, mutation);
    await dependencies.clearDraft();
    return record;
  }
}
