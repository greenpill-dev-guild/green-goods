import * as path from "node:path";
import { readFileSync } from "node:fs";

/** Load exactly Shared's declared, pinned SDK dependencies for this package integration gate. */
export async function loadReportingCompatibilitySdk(repository: string) {
  const shared = path.join(repository, "packages/shared");
  const locate = (specifier: string) => Bun.resolveSync(specifier, shared);
  const sdkPath = locate("@zerodev/sdk");
  const permissionsPath = locate("@zerodev/permissions");
  const sdkVersion = JSON.parse(readFileSync(path.resolve(path.dirname(sdkPath), "../package.json"), "utf8"))
    .version as string;
  const permissionsVersion = JSON.parse(
    readFileSync(path.resolve(path.dirname(permissionsPath), "../package.json"), "utf8"),
  ).version as string;
  if (sdkVersion !== "5.5.10" || permissionsVersion !== "5.6.3")
    throw new Error("Reporting gate requires the reviewed pinned SDK versions");
  return {
    sdk: await import(sdkPath),
    constants: await import(locate("@zerodev/sdk/constants")),
    permissions: await import(permissionsPath),
    signers: await import(locate("@zerodev/permissions/signers")),
    reporting: await import(locate("@green-goods/shared/modules/agent-reporting/kernel-permissions")),
    domain: await import(locate("@green-goods/shared/modules/agent-reporting")),
    versions: { sdk: sdkVersion, permissions: permissionsVersion },
  };
}
