import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type FoundryProfile = "default" | "core" | "lite" | "production" | "test" | "ci" | "e2e" | "fork";

const UTILS_DIR = path.dirname(fileURLToPath(import.meta.url));

export const CONTRACTS_ROOT = path.resolve(UTILS_DIR, "../..");
export const GENERATED_ROOT = path.join(CONTRACTS_ROOT, ".generated");
export const GENERATED_FOUNDRY_ROOT = path.join(GENERATED_ROOT, "foundry");
export const GENERATED_RUNTIME_ROOT = path.join(GENERATED_ROOT, "runtime");

export const ABI_ROOT = path.join(CONTRACTS_ROOT, "abis");
export const CONFIG_ROOT = path.join(CONTRACTS_ROOT, "config");
export const DEPLOYMENTS_ROOT = path.join(CONTRACTS_ROOT, "deployments");

export const LOCALHOST_CONFIG_PATH = path.join(GENERATED_RUNTIME_ROOT, "localhost.json");
export const IPFS_CACHE_PATH = path.join(GENERATED_RUNTIME_ROOT, "ipfs-cache.json");
export const IPFS_MEDIA_CACHE_PATH = path.join(GENERATED_RUNTIME_ROOT, "ipfs-media-cache.json");
export const ACTION_IMAGES_CACHE_PATH = path.join(GENERATED_RUNTIME_ROOT, "action-images-cache.json");

export function getFoundryOutDir(profile: FoundryProfile): string {
  return path.join(GENERATED_FOUNDRY_ROOT, "out", profile);
}

export function getFoundryCacheDir(profile: FoundryProfile): string {
  return path.join(GENERATED_FOUNDRY_ROOT, "cache", profile);
}

export function getFoundryBroadcastPath(...segments: string[]): string {
  return path.join(GENERATED_FOUNDRY_ROOT, "broadcast", ...segments);
}

export function ensureDir(dirPath: string): string {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function ensureParentDir(filePath: string): string {
  ensureDir(path.dirname(filePath));
  return filePath;
}
