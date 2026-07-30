import { resolveAvatarUrl } from "../data/ipfs";
import type { ProfileAvatarResolution } from "./types";

export function resolveProfileAvatar(
  appAvatarUri: string | null | undefined,
  ensAvatarUri: string | null | undefined,
  fallbackAvatarUri: string | null | undefined
): ProfileAvatarResolution {
  if (appAvatarUri) return { avatarUri: resolveAvatarUrl(appAvatarUri), source: "app" };
  if (ensAvatarUri) return { avatarUri: ensAvatarUri, source: "ens" };
  if (fallbackAvatarUri) return { avatarUri: fallbackAvatarUri, source: "fallback" };
  return { avatarUri: null, source: null };
}
