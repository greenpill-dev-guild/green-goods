/**
 * How the release gas gate gets its production tree.
 *
 * `fresh`, the default, rebuilds the tree from scratch. `cached` reuses a tree that CI restored for
 * these exact inputs. The pull-request job caches the production output under a key hashed from
 * every file the build and the three boundary fixtures read, without partial restore keys. It
 * passes `cached` only on an exact hit for a pull request into develop. Pushes, release pull
 * requests, the local release gate and the nightly never set it.
 *
 * Any other value is an error, so a typo cannot skip the rebuild.
 */
export const RELEASE_GAS_BUILD_MODE_VARIABLE = "GG_RELEASE_GAS_GATE_BUILD";

export type ReleaseGasBuildMode = "fresh" | "cached";

export function releaseGasBuildMode(env: Record<string, string | undefined> = process.env): ReleaseGasBuildMode {
  const value = env[RELEASE_GAS_BUILD_MODE_VARIABLE];
  if (value === undefined || value === "" || value === "fresh") return "fresh";
  if (value === "cached") return "cached";
  throw new Error(`${RELEASE_GAS_BUILD_MODE_VARIABLE} must be "fresh" or "cached", got: ${value}`);
}
