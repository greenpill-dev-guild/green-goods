import { Interface, zeroPadValue } from "ethers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import draft from "../../config/clc-pilot-release.json";
import { buildCLCPilotPlan, CLC_TIMELOCK_SOURCE, type CLCPilotManifest } from "./clc-release";
import { simulateCLCPilotPlan, verifyTechSunAuthority } from "./clc-release-simulation";
import { createIsolatedSeed } from "./isolated-fork.fixtures";
import type { VoucherArtifact } from "./voucher-release";

const observed = vi.hoisted(() => ({ forks: [] as Array<{ stopped: boolean; exited: boolean }> }));
vi.mock("./isolated-fork", async (importOriginal) => {
  const original = await importOriginal<typeof import("./isolated-fork")>();
  return {
    ...original,
    async startIsolatedFork(...args: Parameters<typeof original.startIsolatedFork>) {
      const fork = await original.startIsolatedFork(...args);
      const record = { stopped: false, exited: false };
      observed.forks.push(record);
      return {
        ...fork,
        async stop() {
          await fork.stop();
          record.stopped = true;
          record.exited = fork.process.exitCode !== null || fork.process.signalCode !== null;
        },
      };
    },
  };
});

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const deployer = address(42);
const manifest: CLCPilotManifest = {
  ...structuredClone(draft),
  schemaVersion: 1,
  chainId: 100,
  deployer,
  nonce: 3,
  techAndSunSafe: address(43),
  decimals: 6,
  expiresAt: 0,
  minimumUpgradeDelay: 0,
  pool: { ...draft.pool, feesDecoupled: true },
};
// A synthetic artifact is sufficient for pre-deployment refusal tests. It is never deployed.
const artifact: VoucherArtifact = {
  abi: ["constructor(uint256,address[],address[],address)"],
  bytecode: { object: "0x60006000f3" },
  deployedBytecode: { object: "0x6000" },
  metadata: {
    compiler: { version: "0.8.28+commit.fixture" },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      evmVersion: "cancun",
      compilationTarget: { [CLC_TIMELOCK_SOURCE]: "TimelockController" },
    },
  },
};
const commit = "a".repeat(40);
// Read-only negative fixtures, not real Safes or integration substitutes.
function ordinarySafeRuntime() {
  const abi = new Interface([
    "function getThreshold() view returns(uint256)",
    "function getOwners() view returns(address[])",
  ]);
  const responses = [
    [abi.encodeFunctionData("getThreshold").slice(2, 10), abi.encodeFunctionResult("getThreshold", [2]).slice(2)],
    [
      abi.encodeFunctionData("getOwners").slice(2, 10),
      abi.encodeFunctionResult("getOwners", [[address(51), address(52)]]).slice(2),
    ],
  ];
  let code = "60003560e01c";
  const jumps: Array<{ position: number; data: string }> = [];
  for (const [selector, data] of responses) {
    code += `8063${selector}1461`;
    jumps.push({ position: code.length, data });
    code += "000057";
  }
  code += "60006000fd";
  for (const { position, data } of jumps) {
    const target = (code.length / 2).toString(16).padStart(4, "0");
    code = code.slice(0, position) + target + code.slice(position + 4);
    const length = (data.length / 2).toString(16).padStart(4, "0");
    const dataOffset = (code.length / 2 + 16).toString(16).padStart(4, "0");
    code += `5b61${length}61${dataOffset}60003961${length}6000f3${data}`;
  }
  return `0x${code}`;
}
let seed: Awaited<ReturnType<typeof createIsolatedSeed>>;
beforeAll(async () => {
  seed = await createIsolatedSeed(100);
  await seed.client.send("anvil_setNonce", [manifest.deployer, "0x3"]);
  await seed.client.send("evm_mine", []);
});
afterAll(async () => {
  await seed?.stop();
});

describe("CLC owned-fork deployment refusal and cleanup", () => {
  it.each([1, 172800])("rejects a mandatory %s-second delay before starting a fork", async (delay) => {
    const plan = buildCLCPilotPlan(manifest, artifact, commit);
    const changed = structuredClone(manifest);
    Reflect.set(changed, "minimumUpgradeDelay", delay);
    const before = observed.forks.length;
    await expect(simulateCLCPilotPlan(plan, changed, artifact, seed.url)).rejects.toThrow("identity or policy");
    expect(observed.forks).toHaveLength(before);
    expect(await seed.client.getTransactionCount(deployer)).toBe(3);
  });
  it("rejects a changed transaction before starting any fork", async () => {
    const plan = buildCLCPilotPlan(manifest, artifact, commit);
    plan.transactions[2].data += "00";
    const before = observed.forks.length;
    await expect(simulateCLCPilotPlan(plan, manifest, artifact, seed.url)).rejects.toThrow("plan mismatch");
    expect(observed.forks).toHaveLength(before);
    expect(await seed.client.getTransactionCount(deployer)).toBe(3);
  });
  it("rejects stale nonces and stops the process-owned fork without changing its upstream", async () => {
    const changed = { ...manifest, nonce: 4 };
    const before = observed.forks.length;
    await expect(
      simulateCLCPilotPlan(buildCLCPilotPlan(changed, artifact, commit), changed, artifact, seed.url),
    ).rejects.toThrow("latest nonce mismatch");
    expect(observed.forks).toHaveLength(before + 1);
    expect(observed.forks.at(-1)).toEqual({ stopped: true, exited: true });
    expect(await seed.client.getTransactionCount(deployer)).toBe(3);
    expect(await seed.client.getBalance(deployer)).toBe(0n);
  });
  it("rejects an unreviewed dependency before funding or deployment and closes its fork", async () => {
    const plan = buildCLCPilotPlan(manifest, artifact, commit);
    await expect(simulateCLCPilotPlan(plan, manifest, artifact, seed.url)).rejects.toThrow(
      "factory dependency runtime hash mismatch",
    );
    expect(observed.forks.at(-1)).toEqual({ stopped: true, exited: true });
    for (const tx of plan.transactions) expect(await seed.client.getCode(tx.address)).toBe("0x");
    expect(await seed.client.getTransactionCount(deployer)).toBe(3);
    expect(await seed.client.getBalance(deployer)).toBe(0n);
  });
  it("refuses a contract-code sender before funding or deployment and preserves the upstream", async () => {
    const codedSender = await createIsolatedSeed(100);
    const plan = buildCLCPilotPlan(manifest, artifact, commit);
    try {
      await codedSender.client.send("anvil_setCode", [deployer, "0x60006000f3"]);
      await codedSender.client.send("anvil_setNonce", [deployer, "0x3"]);
      await codedSender.client.send("evm_mine", []);
      const beforeBlock = await codedSender.client.getBlockNumber();
      await expect(simulateCLCPilotPlan(plan, manifest, artifact, codedSender.url)).rejects.toThrow(
        "dedicated EOA deployer without contract code",
      );
      expect(observed.forks.at(-1)).toEqual({ stopped: true, exited: true });
      expect(await codedSender.client.getCode(deployer)).toBe("0x60006000f3");
      expect(await codedSender.client.getTransactionCount(deployer)).toBe(3);
      expect(await codedSender.client.getBalance(deployer)).toBe(0n);
      expect(await codedSender.client.getBlockNumber()).toBe(beforeBlock);
      for (const tx of plan.transactions) expect(await codedSender.client.getCode(tx.address)).toBe("0x");
    } finally {
      await codedSender.stop();
    }
  });
  it("rejects an upstream on the wrong chain before creating a fork", async () => {
    const wrongChain = await createIsolatedSeed(42161);
    const before = observed.forks.length;
    try {
      await expect(
        simulateCLCPilotPlan(buildCLCPilotPlan(manifest, artifact, commit), manifest, artifact, wrongChain.url),
      ).rejects.toThrow("upstream chain mismatch");
      expect(observed.forks).toHaveLength(before);
      expect(await wrongChain.client.getTransactionCount(deployer)).toBe(0);
    } finally {
      await wrongChain.stop();
    }
  });
  it("refuses an ordinary threshold-two Safe without the steward gate", async () => {
    const safe = address(60);
    await seed.client.send("anvil_setCode", [safe, ordinarySafeRuntime()]);
    await expect(verifyTechSunAuthority(seed.client, safe)).rejects.toThrow("reviewed HSG guard");
  });
  it("refuses an active threshold-two roster whose guard is an unreviewed contract", async () => {
    const safe = address(61);
    const guard = address(62);
    await seed.client.send("anvil_setCode", [safe, ordinarySafeRuntime()]);
    await seed.client.send("anvil_setCode", [guard, "0x60006000f3"]);
    await seed.client.send("anvil_setStorageAt", [
      safe,
      "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8",
      zeroPadValue(guard, 32),
    ]);
    await expect(verifyTechSunAuthority(seed.client, safe)).rejects.toThrow("reviewed HSG module proxy");
  });
});
