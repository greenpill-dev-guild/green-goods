import type { Address } from "../../types/domain";
import { deserializeFile, serializeFile } from "../../utils/storage/file-serialization";
import { draftDB } from "../job-queue/draft-db";
import { readAvatarDraft, writeAvatarDraft } from "../job-queue/draft-avatars";
import type { ProfileAvatarDraft, ProfileAvatarPublishInput } from "./types";

export async function saveProfileAvatarDraft(
  chainId: number,
  address: Address,
  input: ProfileAvatarPublishInput
): Promise<void> {
  const fileData = input.file ? await serializeFile(input.file) : null;
  await writeAvatarDraft(await draftDB.init(), {
    chainId,
    address,
    fileData,
    action: input.action,
    ...(input.cid ? { cid: input.cid } : {}),
    updatedAt: Date.now(),
  });
}

export async function loadProfileAvatarDraft(
  chainId: number,
  address: Address
): Promise<(ProfileAvatarDraft & { file: File | null }) | null> {
  const draft = await readAvatarDraft(await draftDB.init(), chainId, address);
  if (!draft) return null;
  return {
    ...draft,
    file: draft.fileData
      ? deserializeFile({ fileData: draft.fileData }, "profile-avatar", address)
      : null,
  };
}

export async function clearProfileAvatarDraft(chainId: number, address: Address): Promise<void> {
  await writeAvatarDraft(
    await draftDB.init(),
    { chainId, address, fileData: null, action: "clear", updatedAt: Date.now() },
    true
  );
}
