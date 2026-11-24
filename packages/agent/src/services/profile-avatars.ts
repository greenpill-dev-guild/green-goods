import type { ProfileAvatarRecord } from "@green-goods/shared/profile-avatar/protocol";
import type { Address } from "@green-goods/shared/types";
import * as db from "./db";

export type ProfileAvatarStore = {
  get(chainId: number, address: Address): Promise<ProfileAvatarRecord | undefined>;
  compareAndSwap(input: {
    chainId: number;
    address: Address;
    avatarUri: string | null;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    { ok: true; record: ProfileAvatarRecord } | { ok: false; record?: ProfileAvatarRecord }
  >;
};

export class MemoryProfileAvatarStore implements ProfileAvatarStore {
  private records = new Map<string, ProfileAvatarRecord>();

  async get(chainId: number, address: Address): Promise<ProfileAvatarRecord | undefined> {
    return this.records.get(key(chainId, address));
  }

  async compareAndSwap(input: {
    chainId: number;
    address: Address;
    avatarUri: string | null;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    { ok: true; record: ProfileAvatarRecord } | { ok: false; record?: ProfileAvatarRecord }
  > {
    const existing = this.records.get(key(input.chainId, input.address));
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== input.expectedVersion) return { ok: false, record: existing };

    const record: ProfileAvatarRecord = {
      chainId: input.chainId,
      address: input.address as ProfileAvatarRecord["address"],
      avatarUri: input.avatarUri,
      version: currentVersion + 1,
      updatedAt: input.updatedAt,
    };
    this.records.set(key(input.chainId, input.address), record);
    return { ok: true, record };
  }
}

export function createSqliteProfileAvatarStore(): ProfileAvatarStore {
  return {
    get: (chainId, address) => db.getProfileAvatar(chainId, address),
    compareAndSwap: (input) => db.compareAndSwapProfileAvatar(input),
  };
}

function key(chainId: number, address: Address): string {
  return `${chainId}:${address}`;
}
