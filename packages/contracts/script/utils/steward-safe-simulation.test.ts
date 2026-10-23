import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import draft from "../../config/steward-safe-release.json";
import { createIsolatedSeed } from "./isolated-fork.fixtures";
import { CONTRACTS_ROOT, getFoundryOutDir } from "./paths";
import { buildStewardPlan, loadStewardArtifacts, type StewardManifest } from "./steward-safe-release";
import { simulateStewardNetwork } from "./steward-safe-simulation";

const address = (n: number) => `0x${(n + 0x10000).toString(16).padStart(40, "0")}`;
const manifest: StewardManifest = {
  ...draft,
  schemaVersion: 1,
  threshold: 2,
  garden: address(10),
  hatsModule: address(11),
  stewardHat: "2",
  expectedTopHat: String(1n << 224n),
  networks: {
    arbitrum: { chainId: 42161, router: address(12), deployer: address(13), nonce: 1 },
    gnosis: { chainId: 100, router: address(14), deployer: address(15), nonce: 2 },
  },
};
let seed: Awaited<ReturnType<typeof createIsolatedSeed>>;
let artifacts: ReturnType<typeof loadStewardArtifacts>;
beforeAll(async () => {
  const result = execFileSync(
    "bun",
    ["--no-env-file", "run", "contracts", "--", "release", "steward-safe", "--mode", "preflight"],
    { cwd: CONTRACTS_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  expect(JSON.parse(result)).toMatchObject({
    state: "preflight",
    buildProfile: "production",
    authorityEnabled: false,
    liveBroadcast: false,
  });
  artifacts = loadStewardArtifacts(getFoundryOutDir("production"));
  seed = await createIsolatedSeed(42161);
  await seed.client.send("anvil_setNonce", [manifest.networks.arbitrum.deployer, "0x1"]);
  await seed.client.send("anvil_setCode", [manifest.networks.arbitrum.router, "0x600160005260206000f3"]);
  // Synthetic canonical role configuration: word1=steward Hat 2, word7=configured.
  await seed.client.send("anvil_setCode", [manifest.hatsModule, "0x6002602052600160e0526101006000f3"]);
  await seed.client.send("evm_mine", []);
}, 120000);
afterAll(async () => {
  await seed?.stop();
});
describe("production steward publisher deployment on a process-owned fork", () => {
  it("deploys the exact bound publisher and leaves the synthetic upstream untouched", async () => {
    const plan = buildStewardPlan(manifest, artifacts, "a".repeat(40));
    const result = await simulateStewardNetwork(plan, manifest, artifacts, "arbitrum", seed.url);
    expect(result.activationIncluded).toBe(false);
    expect(result.observerRegistered).toBe(false);
    expect(result.transportDelivered).toBe(false);
    expect(await seed.client.getCode(plan.transactions[0].address)).toBe("0x");
    expect(Number(await seed.client.getTransactionCount(manifest.networks.arbitrum.deployer!))).toBe(1);
  }, 30000);
  it("rejects stale nonces before deployment", async () => {
    const m = structuredClone(manifest);
    m.networks.arbitrum.nonce = 2;
    await expect(
      simulateStewardNetwork(buildStewardPlan(m, artifacts, "a".repeat(40)), m, artifacts, "arbitrum", seed.url),
    ).rejects.toThrow("latest mismatch");
  });
  it("rejects a different source steward Hat", async () => {
    const m = structuredClone(manifest);
    m.stewardHat = "3";
    await expect(
      simulateStewardNetwork(buildStewardPlan(m, artifacts, "a".repeat(40)), m, artifacts, "arbitrum", seed.url),
    ).rejects.toThrow("canonical steward Hat mismatch");
  });
});
