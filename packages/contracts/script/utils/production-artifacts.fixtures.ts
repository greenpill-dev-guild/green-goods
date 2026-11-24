import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Own both compiler outputs until the caller has loaded its artifacts and compiler evidence. */
export async function withProductionArtifacts<T>(
  consume: (build: { out: string; env: NodeJS.ProcessEnv }) => T | Promise<T>,
): Promise<T> {
  const root = mkdtempSync(path.join(tmpdir(), "gg-production-artifacts-"));
  const out = path.join(root, "out");
  const env = {
    ...process.env,
    FOUNDRY_PROFILE: "production",
    FOUNDRY_OUT: out,
    FOUNDRY_CACHE_PATH: path.join(root, "cache"),
  };
  try {
    return await consume({ out, env });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
