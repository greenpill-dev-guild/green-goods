import { openDB, type DBSchema } from "idb";
import type { Address } from "../../types/domain";
import { deserializeFile, serializeFile } from "../../utils/storage/file-serialization";
import type { ProfileAvatarDraft, ProfileAvatarPublishInput } from "./types";

interface ProfileAvatarDraftDB extends DBSchema {
  drafts: {
    key: string;
    value: ProfileAvatarDraft & { key: string };
  };
}

const DRAFT_DB_NAME = "green-goods-profile-avatar-drafts";
const DRAFT_KEY = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;

function openDraftDatabase() {
  return openDB<ProfileAvatarDraftDB>(DRAFT_DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("drafts")) {
        database.createObjectStore("drafts", { keyPath: "key" });
      }
    },
  });
}

export async function saveProfileAvatarDraft(
  chainId: number,
  address: Address,
  input: ProfileAvatarPublishInput
): Promise<void> {
  const db = await openDraftDatabase();
  const fileData = input.file ? await serializeFile(input.file) : null;
  await db.put("drafts", {
    key: DRAFT_KEY(chainId, address),
    chainId,
    address: address.toLowerCase() as Address,
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
  const db = await openDraftDatabase();
  const draft = await db.get("drafts", DRAFT_KEY(chainId, address));
  if (!draft) return null;
  return {
    ...draft,
    file: draft.fileData
      ? deserializeFile({ fileData: draft.fileData }, "profile-avatar", address)
      : null,
  };
}

export async function clearProfileAvatarDraft(chainId: number, address: Address): Promise<void> {
  const db = await openDraftDatabase();
  await db.delete("drafts", DRAFT_KEY(chainId, address));
}
