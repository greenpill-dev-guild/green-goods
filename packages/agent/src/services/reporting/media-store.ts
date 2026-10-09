import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReportingKeyring } from "./keyring";

/**
 * Private media on the attached volume, outside SQLite. Object names are random and never taken
 * from a client or provider; bytes are sealed with a context-bound key and written atomically
 * (temporary file, then rename) so a crash never leaves a readable partial object. Digests are
 * over the plaintext so they match what a signature or manifest refers to.
 */
export interface PrivateMediaStore {
  put(bytes: Uint8Array, context: string): Promise<{ key: string; digest: string; size: number }>;
  get(key: string, context: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-f0-9]{32}$/;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createFilesystemMediaStore(
  root: string,
  keyring: ReportingKeyring
): PrivateMediaStore {
  const pathFor = (key: string) => {
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid private media key");
    return join(root, key.slice(0, 2), key);
  };
  return {
    async put(bytes, context) {
      const key = randomBytes(16).toString("hex");
      const path = pathFor(key);
      await mkdir(join(root, key.slice(0, 2)), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${randomBytes(4).toString("hex")}.tmp`;
      try {
        await writeFile(temporary, keyring.sealBytes(bytes, `${context}:${key}`), { mode: 0o600 });
        await rename(temporary, path);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
      return { key, digest: sha256Hex(bytes), size: bytes.byteLength };
    },
    async get(key, context) {
      return keyring.openBytes(await readFile(pathFor(key)), `${context}:${key}`);
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}
