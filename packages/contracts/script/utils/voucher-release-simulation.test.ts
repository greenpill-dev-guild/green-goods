import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { JsonRpcProvider } from "ethers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CONTRACTS_ROOT, getFoundryOutDir } from "./paths";
import { fixtureManifest } from "./voucher-release.fixtures";
import { buildVoucherPlan, loadVoucherArtifacts } from "./voucher-release";
import { simulateVoucherNetwork } from "./voucher-release-simulation";

const children: ChildProcess[] = [];
const clients: JsonRpcProvider[] = [];
async function seed(chainId: number) {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const child = spawn(
    "anvil",
    ["--host", "127.0.0.1", "--port", String(port), "--chain-id", String(chainId), "--silent"],
    { stdio: "ignore" },
  );
  children.push(child);
  let spawnError: Error | undefined;
  child.once("error", (e) => {
    spawnError = e;
  });
  const client = new JsonRpcProvider(`http://127.0.0.1:${port}`, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  clients.push(client);
  for (let i = 0; i < 100; i++) {
    if (spawnError || child.exitCode !== null) throw new Error("Synthetic seed Anvil unavailable");
    try {
      await client.send("anvil_nodeInfo", []);
      return { client, url: `http://127.0.0.1:${port}` };
    } catch {
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw new Error("Synthetic seed startup timed out");
}
const manifest = fixtureManifest();
let arb: Awaited<ReturnType<typeof seed>>, gnosis: Awaited<ReturnType<typeof seed>>;
let artifacts: ReturnType<typeof loadVoucherArtifacts>;
let plan: ReturnType<typeof buildVoucherPlan>;
beforeAll(async () => {
  // Exercise the public preflight entrypoint and real production compiler, never a fake runtime.
  const preflight = execFileSync(
    "bun",
    ["--no-env-file", "run", "contracts", "--", "release", "vouchers", "--mode", "preflight"],
    { cwd: CONTRACTS_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  expect(JSON.parse(preflight).deploymentInputs).toBe("pending");
  artifacts = loadVoucherArtifacts(getFoundryOutDir("production"));
  plan = buildVoucherPlan(manifest, artifacts, "a".repeat(40));
  arb = await seed(42161);
  gnosis = await seed(100);
  for (const [network, { client }] of [
    ["arbitrum", arb],
    ["gnosis", gnosis],
  ] as const) {
    const c = manifest.networks[network];
    await client.send("anvil_setNonce", [c.deployer, `0x${c.nonce.toString(16)}`]);
    await client.send("anvil_setCode", [c.router, "0x600160005260206000f3"]);
    // Synthetic upstream dependencies: version-one pooling, an existing Hats address and
    // threshold-two Safe response. This proves deployment mechanics, not real governance.
    await client.send("anvil_setCode", [c.owner, "0x600260005260206000f3"]);
    if (network === "arbitrum") {
      await client.send("anvil_setCode", [manifest.networks.arbitrum.commitmentPooling, "0x600160005260206000f3"]);
      await client.send("anvil_setCode", [manifest.networks.arbitrum.hatsModule, "0x00"]);
    }
    await client.send("evm_mine", []);
  }
}, 120_000);
afterAll(async () => {
  for (const client of clients) client.destroy();
  for (const child of children)
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 2000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
});
describe("real production paused voucher deployment on isolated synthetic forks", () => {
  it("executes all eleven CREATE boundaries with a pending receipt, atomic initializers and readback without touching upstream", async () => {
    const receipt = vi.spyOn(JsonRpcProvider.prototype, "getTransactionReceipt").mockResolvedValueOnce(null);
    try {
      const a = await simulateVoucherNetwork(plan, manifest, "arbitrum", arb.url);
      const g = await simulateVoucherNetwork(plan, manifest, "gnosis", gnosis.url);
      expect(a.rows).toHaveLength(6);
      expect(g.rows).toHaveLength(5);
      expect(a.paused).toBe(true);
      expect(g.authorityEnabled).toBe(false);
      for (const [name, { client }] of [
        ["arbitrum", arb],
        ["gnosis", gnosis],
      ] as const) {
        expect(Number(await client.send("eth_getTransactionCount", [manifest.networks[name].deployer, "latest"]))).toBe(
          manifest.networks[name].nonce,
        );
        for (const tx of plan.transactions.filter((t) => t.network === name))
          expect(await client.getCode(tx.address)).toBe("0x");
      }
    } finally {
      receipt.mockRestore();
    }
  }, 120_000);
  it("rejects wrong chain and stale pending nonce before any deployment", async () => {
    await expect(simulateVoucherNetwork(plan, manifest, "arbitrum", gnosis.url)).rejects.toThrow("chain mismatch");
    const stale = structuredClone(manifest);
    stale.networks.arbitrum.nonce++;
    await expect(
      simulateVoucherNetwork(buildVoucherPlan(stale, artifacts, "a".repeat(40)), stale, "arbitrum", arb.url),
    ).rejects.toThrow("pending nonce");
  });
  it("rejects a router that does not admit the selected peer chain", async () => {
    await arb.client.send("anvil_setCode", [manifest.networks.arbitrum.router, "0x600060005260206000f3"]);
    await arb.client.send("evm_mine", []);
    try {
      await expect(simulateVoucherNetwork(plan, manifest, "arbitrum", arb.url)).rejects.toThrow(
        "does not support the peer selector",
      );
    } finally {
      await arb.client.send("anvil_setCode", [manifest.networks.arbitrum.router, "0x600160005260206000f3"]);
      await arb.client.send("evm_mine", []);
    }
  });
  it("rejects a missing Safe or threshold-one owner while preserving the upstream", async () => {
    const missing = structuredClone(manifest);
    missing.networks.arbitrum.owner = "0x0000000000000000000000000000000000000099";
    await expect(
      simulateVoucherNetwork(buildVoucherPlan(missing, artifacts, "a".repeat(40)), missing, "arbitrum", arb.url),
    ).rejects.toThrow("owner code");
    await arb.client.send("anvil_setCode", [manifest.networks.arbitrum.owner, "0x600160005260206000f3"]);
    await arb.client.send("evm_mine", []);
    try {
      await expect(simulateVoucherNetwork(plan, manifest, "arbitrum", arb.url)).rejects.toThrow(
        "threshold is below two",
      );
    } finally {
      await arb.client.send("anvil_setCode", [manifest.networks.arbitrum.owner, "0x600260005260206000f3"]);
      await arb.client.send("evm_mine", []);
    }
  });
});
