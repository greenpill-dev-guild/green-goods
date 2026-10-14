import { chmod, mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReportingKeyring } from "../../services/reporting/keyring";
import { createGrantSignerCustody } from "../../services/reporting/signer-custody";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});
const OLD = `old:${Buffer.alloc(32, 9).toString("base64")}`;
const CURRENT = `current:${Buffer.alloc(32, 8).toString("base64")}`;
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "gg-signer-custody-"));
  directories.push(directory);
  return { directory, custody: createGrantSignerCustody(directory, createReportingKeyring(OLD)) };
}
const pathFor = (directory: string, ref: string) => join(directory, `${ref.slice(13)}.sealed`);

describe("per-grant encrypted signer custody", () => {
  it("persists only encrypted key bytes with private modes, and rejects substituted symlinks", async () => {
    const { directory, custody } = await setup();
    const grant = await custody.create();
    const path = join(directory, `${grant.signerKeyRef.slice(13)}.sealed`);
    expect((await stat(directory)).mode & 0o077).toBe(0);
    expect((await stat(path)).mode & 0o077).toBe(0);
    expect(await readFile(path, "utf8")).not.toMatch(/^0x[0-9a-f]{64}$/);
    expect((await custody.account(grant.signerKeyRef)).address).toBe(grant.signerAddress);
    await expect(custody.account("grant-signer:../outside")).rejects.toThrow();
    await unlink(path);
    await symlink(join(directory, "outside"), path);
    await expect(custody.account(grant.signerKeyRef)).rejects.toThrow();
  });
  it("binds each encrypted file to its grant reference and rejects swapped ciphertext", async () => {
    const { directory, custody } = await setup();
    const first = await custody.create();
    const second = await custody.create();
    expect(first.signerAddress).not.toBe(second.signerAddress);
    await writeFile(
      pathFor(directory, second.signerKeyRef),
      await readFile(pathFor(directory, first.signerKeyRef))
    );
    await expect(custody.account(second.signerKeyRef)).rejects.toThrow();
    expect((await custody.account(first.signerKeyRef)).address).toBe(first.signerAddress);
  });
  it("retains older grants after wrapping-key rotation and fails closed without the older key", async () => {
    const { directory, custody } = await setup();
    const older = await custody.create();
    const rotated = createGrantSignerCustody(
      directory,
      createReportingKeyring(`${CURRENT},${OLD}`)
    );
    const newer = await rotated.create();
    expect((await rotated.account(older.signerKeyRef)).address).toBe(older.signerAddress);
    expect(await readFile(pathFor(directory, newer.signerKeyRef), "utf8")).toMatch(/^current\./);
    await expect(
      createGrantSignerCustody(directory, createReportingKeyring(CURRENT)).account(
        older.signerKeyRef
      )
    ).rejects.toThrow();
  });
  it("rejects readable-by-others files, missing records and a symlink custody directory", async () => {
    const { directory, custody } = await setup();
    const grant = await custody.create();
    const path = pathFor(directory, grant.signerKeyRef);
    await chmod(path, 0o644);
    await expect(custody.account(grant.signerKeyRef)).rejects.toThrow("Unsafe signer custody file");
    await unlink(path);
    await expect(custody.account(grant.signerKeyRef)).rejects.toThrow();
    const substituted = join(directory, "substituted");
    await symlink(directory, substituted);
    await expect(
      createGrantSignerCustody(substituted, createReportingKeyring(OLD)).create()
    ).rejects.toThrow("Unsafe signer custody directory");
  });
});
