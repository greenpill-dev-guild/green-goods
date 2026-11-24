import { readFileSync } from "node:fs";
import * as path from "node:path";
import { startIsolatedFork } from "./isolated-fork";

export function reportingCompatibilityOptions(argv: string[]): void {
  if (argv.length !== 3 || argv[0] !== "--network" || argv[1] !== "arbitrum" || argv[2] !== "--simulate")
    throw new Error("Reporting Kernel verification supports only --network arbitrum --simulate");
}

export { assertIsolatedRpc as assertReportingFixtureRpc } from "./isolated-fork";
export async function startReportingFork(upstream: string) {
  return startIsolatedFork(upstream, 42161);
}

export function reportingFixtureArtifact(contractsRoot: string, name: string) {
  const directory =
    name === "SingleAttestationPolicy" ? "SingleAttestationPolicy.sol" : "ReportingKernelFixtures.s.sol";
  const file = path.join(contractsRoot, ".generated/foundry/out/production", directory, `${name}.json`);
  const artifact = JSON.parse(readFileSync(file, "utf8"));
  if (!artifact.abi || !/^0x(?:[0-9a-fA-F]{2})+$/u.test(artifact.bytecode?.object ?? ""))
    throw new Error("Invalid compiled reporting fixture");
  return { abi: artifact.abi, bytecode: artifact.bytecode.object as `0x${string}` };
}
