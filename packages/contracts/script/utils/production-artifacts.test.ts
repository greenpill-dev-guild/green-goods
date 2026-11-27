import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CONTRACTS_ROOT, GENERATED_FOUNDRY_ROOT, getFoundryOutDir } from "./paths";
import { withProductionArtifacts } from "./production-artifacts.fixtures";
import { loadStewardArtifacts, STEWARD_CONTRACTS } from "./steward-safe-release";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function artifactFiles(out: string) {
  return STEWARD_CONTRACTS.map((name) => {
    const file = path.join(out, `${name}.sol`, `${name}.json`);
    mkdirSync(path.dirname(file), { recursive: true });
    return file;
  });
}

describe("owned production compiler outputs", () => {
  it("keeps default output paths and resolves the same explicit override as Forge", () => {
    expect(getFoundryOutDir("production", {})).toBe(path.join(GENERATED_FOUNDRY_ROOT, "out/production"));
    expect(getFoundryOutDir("test", {})).toBe(path.join(GENERATED_FOUNDRY_ROOT, "out/test"));
    expect(getFoundryOutDir("production", { FOUNDRY_OUT: "owned/out" })).toBe(path.join(CONTRACTS_ROOT, "owned/out"));
    expect(getFoundryOutDir("production", { FOUNDRY_OUT: path.join(tmpdir(), "owned/out") })).toBe(
      path.join(tmpdir(), "owned/out"),
    );
  });

  it("keeps canonical JSON unchanged while two private writers hold incomplete artifacts", async () => {
    const canonical = mkdtempSync(path.join(tmpdir(), "gg-canonical-artifacts-test-"));
    directories.push(canonical);
    const original = JSON.stringify({ bytecode: { object: "0xcafe" } });
    const canonicalFiles = artifactFiles(canonical);
    canonicalFiles.forEach((file) => writeFileSync(file, original));
    const bothWriting = Promise.withResolvers<void>();
    const owners: Array<{ out: string; cache: string }> = [];

    await Promise.all(
      ["0x01", "0x02"].map((bytecode) =>
        withProductionArtifacts(async ({ out, env }) => {
          expect(env.FOUNDRY_PROFILE).toBe("production");
          expect(getFoundryOutDir("production", env)).toBe(out);
          expect(out).not.toBe(getFoundryOutDir("production", {}));
          const files = artifactFiles(out);
          files.forEach((file) => writeFileSync(file, '{"bytecode":'));
          owners.push({ out, cache: env.FOUNDRY_CACHE_PATH! });
          if (owners.length === 2) bothWriting.resolve();
          await bothWriting.promise;

          // The barrier guarantees both output owners are active and each private file is partial.
          expect(() => loadStewardArtifacts(out)).toThrow(SyntaxError);
          expect(loadStewardArtifacts(canonical).StewardRolePublisher.bytecode.object).toBe("0xcafe");
          canonicalFiles.forEach((file) => expect(readFileSync(file, "utf8")).toBe(original));
          const completed = JSON.stringify({ bytecode: { object: bytecode } });
          files.forEach((file) => writeFileSync(file, completed));
          const loaded = loadStewardArtifacts(getFoundryOutDir("production", env));
          for (const name of STEWARD_CONTRACTS) expect(loaded[name].bytecode.object).toBe(bytecode);
        }),
      ),
    );

    expect(new Set(owners.map(({ out }) => out)).size).toBe(2);
    expect(new Set(owners.map(({ cache }) => cache)).size).toBe(2);
    owners.forEach(({ out, cache }) => {
      expect(existsSync(path.dirname(out))).toBe(false);
      expect(existsSync(cache)).toBe(false);
    });
    canonicalFiles.forEach((file) => expect(readFileSync(file, "utf8")).toBe(original));
  });

  it("removes failed output and cache without removing another active owner's files", async () => {
    let failedRoot = "";
    await withProductionArtifacts(async (survivor) => {
      const survivorFile = artifactFiles(survivor.out)[0];
      writeFileSync(survivorFile, "{}");
      await expect(
        withProductionArtifacts(async ({ out, env }) => {
          failedRoot = path.dirname(out);
          writeFileSync(artifactFiles(out)[0], '{"bytecode":');
          mkdirSync(env.FOUNDRY_CACHE_PATH!, { recursive: true });
          writeFileSync(path.join(env.FOUNDRY_CACHE_PATH!, "partial-cache.json"), "{");
          await Promise.resolve();
          throw new Error("compiler failed before artifact completion");
        }),
      ).rejects.toThrow("compiler failed before artifact completion");
      expect(existsSync(failedRoot)).toBe(false);
      expect(readFileSync(survivorFile, "utf8")).toBe("{}");
    });
  });

  it("cleans completed artifacts after their contents have been loaded", async () => {
    let root = "";
    const artifact = await withProductionArtifacts(({ out, env }) => {
      root = path.dirname(out);
      artifactFiles(out).forEach((file) => writeFileSync(file, JSON.stringify({ bytecode: { object: "0x42" } })));
      mkdirSync(env.FOUNDRY_CACHE_PATH!, { recursive: true });
      return loadStewardArtifacts(out);
    });
    expect(artifact.StewardSafeReceiver.bytecode.object).toBe("0x42");
    expect(existsSync(root)).toBe(false);
  });
});
