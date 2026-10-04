import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ReportingKeyring } from "./keyring";

/** Encrypted software custody: separate wrapping key, private files, one key per grant.
 * The executor can decrypt, so a compromised executor is weaker than non-exportable KMS custody.
 * No general digest-signing API is exposed to chat/model/browser code.
 */
export function createGrantSignerCustody(directory: string, wrapping: ReportingKeyring) {
  let canonicalDirectory: string | null = null;
  async function privateDirectory() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(directory);
    const expected = join(await realpath(dirname(directory)), basename(directory));
    const canonical = await realpath(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      canonical !== expected ||
      (canonicalDirectory !== null && canonical !== canonicalDirectory)
    ) {
      throw new Error("Unsafe signer custody directory");
    }
    await chmod(directory, 0o700);
    canonicalDirectory = canonical;
  }
  const file = (ref: string) => {
    if (!/^grant-signer:[0-9a-f-]{36}$/.test(ref)) throw new Error("Invalid signer reference");
    if (!canonicalDirectory) throw new Error("Signer custody not initialized");
    return join(canonicalDirectory, `${ref.slice(13)}.sealed`);
  };
  return {
    async create() {
      await privateDirectory();
      const signerKeyRef = `grant-signer:${randomUUID()}`;
      const privateKey = generatePrivateKey();
      const signerAddress = privateKeyToAccount(privateKey).address as `0x${string}`;
      const handle = await open(
        file(signerKeyRef),
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o600
      );
      try {
        await handle.writeFile(wrapping.seal(privateKey, signerKeyRef));
        await handle.sync();
      } finally {
        await handle.close();
      }
      return { signerKeyRef, signerAddress };
    },
    async account(ref: string) {
      await privateDirectory();
      const handle = await open(file(ref), constants.O_RDONLY | constants.O_NOFOLLOW);
      let encrypted: string;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || (stat.mode & 0o077) !== 0)
          throw new Error("Unsafe signer custody file");
        encrypted = await handle.readFile("utf8");
      } finally {
        await handle.close();
      }
      const privateKey = wrapping.open(encrypted, ref);
      if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Invalid signer custody record");
      return privateKeyToAccount(privateKey as `0x${string}`);
    },
  };
}
