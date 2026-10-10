import type { AccountFactoryArgs } from "../auth/account-message-signer";
import type { Address } from "../../types/domain";
import type { SerializedFileData } from "../../types/job-queue";
import type {
  ProfileAvatarMutation,
  ProfileAvatarRecord,
} from "../../public-contracts/profile-avatar";

export type ProfileAvatarSource = "app" | "ens" | "fallback";

export type ProfileAvatarResolution = {
  avatarUri: string | null;
  source: ProfileAvatarSource | null;
};

export type ProfileAvatarDraft = {
  chainId: number;
  address: Address;
  fileData: SerializedFileData | null;
  action: "set" | "clear";
  cid?: string;
  updatedAt: number;
};

export type ProfileAvatarPublishInput = {
  file?: File | null;
  action: "set" | "clear";
  cid?: string;
};

export type ProfileAvatarPublishDependencies = {
  get: (chainId: number, address: Address) => Promise<ProfileAvatarRecord>;
  save: (
    chainId: number,
    address: Address,
    mutation: ProfileAvatarMutation
  ) => Promise<ProfileAvatarRecord>;
  normalize: (file: File) => Promise<File>;
  upload: (file: File) => Promise<{ cid: string }>;
  sign: (message: string) => Promise<`0x${string}`>;
  saveDraft: (input: ProfileAvatarPublishInput) => Promise<void>;
  clearDraft: () => Promise<void>;
  onStage?: (stage: "normalizing" | "uploading" | "signing" | "saving") => void;
  now?: () => number;
  getFactoryArgs?: () => Promise<AccountFactoryArgs | undefined>;
};

export class ProfileAvatarTransportError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errorCode?: string,
    public readonly isAmbiguous = false
  ) {
    super(message);
    this.name = "ProfileAvatarTransportError";
  }
}

export function classifyProfileAvatarFailure(
  error: unknown,
  isOnline = typeof navigator === "undefined" || navigator.onLine
): "offline" | "error" {
  if (!isOnline) return "offline";
  return error instanceof ProfileAvatarTransportError && error.isAmbiguous ? "offline" : "error";
}
