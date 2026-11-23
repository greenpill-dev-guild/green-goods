import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AbiCoder, Interface, keccak256 } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import { standaloneDeploymentPlan, verifyStandaloneDeployment } from "../utils/standalone-deployment";
import {
  beginStandaloneBroadcast,
  promoteStandaloneDeployment,
  recordStandaloneDeployment,
  standaloneForgeCommand,
  standalonePaths,
  standaloneReceiptHash,
  standaloneSources,
} from "../utils/standalone-operation";
import { REWARD_PAYER } from "./reward-payer";

const roots: string[] = [];
const root = () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "reward-payer-operation-"));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => fs.rmSync(r, { recursive: true, force: true })));
const bytecode = { creationCode: "0x60006000", runtimeCode: "0x6000" };
const sender = "0x00000000000000000000000000000000000000A1";
const plan = (network = "arbitrum", chainId = 42161) =>
  standaloneDeploymentPlan(REWARD_PAYER, { ...bytecode, network, chainId, sender, nonce: 7, commit: "a".repeat(40) });
const hash = `0x${"b".repeat(64)}`;
const payer = new Interface([
  "function shareIdOf((uint256,address,uint256,address,address,uint256)) pure returns (bytes32)",
]);
/** Answers shareIdOf the way the contract does: the hash of the abi-encoded share. */
const honestCall = async ({ data }: { data: string }) => {
  const [share] = payer.decodeFunctionData("shareIdOf", data);
  const id = keccak256(
    AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256", "address", "address", "uint256"], share),
  );
  return payer.encodeFunctionResult("shareIdOf", [id]);
};
function deployed(call = honestCall) {
  const p = plan();
  return {
    getNetwork: async () => ({ chainId: 42161n }),
    getTransaction: async () => ({
      hash,
      from: p.deployer,
      nonce: 7,
      to: null,
      value: 0n,
      data: bytecode.creationCode,
    }),
    getTransactionReceipt: async () => ({
      hash,
      status: 1,
      contractAddress: p.address,
      blockNumber: 1,
      blockHash: hash,
    }),
    getCode: async () => bytecode.runtimeCode,
    call,
  } as unknown as Parameters<typeof verifyStandaloneDeployment>[1];
}

describe("standalone reward payer deployment", () => {
  it("verifies the CREATE receipt and runtime, then proves the live code hashes a share as the app does", async () => {
    const artifact = await verifyStandaloneDeployment(REWARD_PAYER, deployed(), plan(), hash);
    expect(artifact.kind).toBe("REWARD_PAYER_DEPLOYMENT");
    expect(artifact.address).toBe(plan().address);
    await expect(
      verifyStandaloneDeployment(
        REWARD_PAYER,
        deployed(async () => payer.encodeFunctionResult("shareIdOf", [hash])),
        plan(),
        hash,
      ),
    ).rejects.toThrow("Deployed reward payer ABI is incompatible");
  });

  it("pins REWARD_PAYER_* inputs, signs live broadcasts only with the keystore and localhost through the node", () => {
    const before = process.env.ETH_PASSWORD;
    process.env.ETH_PASSWORD = "/fixture/password-path";
    try {
      const simulated = standaloneForgeCommand(REWARD_PAYER, plan(), "https://rpc.invalid", false);
      expect(simulated.args.slice(0, 2)).toEqual(["script", "script/DeployRewardPayer.s.sol:DeployRewardPayer"]);
      expect(simulated.args).not.toContain("--broadcast");
      expect(simulated.env.ETH_PASSWORD).toBeUndefined();
      expect(simulated.env).toMatchObject({
        REWARD_PAYER_SENDER: plan().deployer,
        REWARD_PAYER_CHAIN_ID: "42161",
        REWARD_PAYER_NONCE: "7",
        REWARD_PAYER_ADDRESS: plan().address,
        REWARD_PAYER_RUNTIME_HASH: plan().runtimeCodeHash,
      });
      const live = standaloneForgeCommand(REWARD_PAYER, plan(), "https://rpc.invalid", true);
      expect(live.args.slice(-3)).toEqual(["--broadcast", "--account", "green-goods-deployer"]);
      const local = standaloneForgeCommand(REWARD_PAYER, plan("localhost", 31337), "http://127.0.0.1:1", true);
      expect(local.args.slice(-2)).toEqual(["--broadcast", "--unlocked"]);
      expect(local.args).not.toContain("--account");
      expect(local.env.ETH_PASSWORD).toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.ETH_PASSWORD;
      else process.env.ETH_PASSWORD = before;
    }
  });

  it("selects only a RewardPayer CREATE and requires its own sources committed", () => {
    const p = plan();
    const tx = {
      hash,
      transactionType: "CREATE",
      contractName: "RewardPayer",
      contractAddress: p.address,
      transaction: { from: p.deployer, nonce: "0x7", input: p.creationCode, value: "0x0", to: null },
    };
    expect(standaloneReceiptHash(REWARD_PAYER, { transactions: [tx] }, p)).toBe(hash);
    expect(() =>
      standaloneReceiptHash(REWARD_PAYER, { transactions: [{ ...tx, contractName: "SingleAttestationPolicy" }] }, p),
    ).toThrow("No unique reviewed reward payer CREATE receipt");
    expect(standaloneSources(REWARD_PAYER)).toEqual(
      expect.arrayContaining([
        "src/modules/RewardPayer.sol",
        "script/DeployRewardPayer.s.sol",
        "script/deploy/reward-payer.ts",
        "script/utils/standalone-contract.ts",
      ]),
    );
  });

  it("records the standalone artifact and promotes only the address and CREATE block into the canonical artifact", async () => {
    const r = root();
    const paths = standalonePaths(REWARD_PAYER, r, "arbitrum");
    expect(path.relative(r, paths.artifact)).toBe("deployments/42161-reward-payer.json");
    expect(path.relative(r, paths.latest!)).toBe("deployments/42161-latest.json");
    const canonical = `${JSON.stringify({ gardenToken: `0x${"1".repeat(40)}`, schemas: { a: "0x01" } }, null, 2)}\n`;
    fs.mkdirSync(path.dirname(paths.latest!), { recursive: true });
    fs.writeFileSync(paths.latest!, canonical);
    const p = plan();
    beginStandaloneBroadcast(REWARD_PAYER, r, paths, p);
    expect(fs.readFileSync(paths.latest!, "utf8")).toBe(canonical);
    const artifact = await verifyStandaloneDeployment(REWARD_PAYER, deployed(), p, hash);
    const promoted = { rewardPayer: p.address, rewardPayerDeployBlock: 1 };
    expect(recordStandaloneDeployment(REWARD_PAYER, r, paths, p, artifact)).toEqual({
      file: "deployments/42161-latest.json",
      promoted,
      changed: true,
    });
    expect(JSON.parse(fs.readFileSync(paths.artifact, "utf8")).address).toBe(p.address);
    expect(JSON.parse(fs.readFileSync(paths.latest!, "utf8"))).toEqual({ ...JSON.parse(canonical), ...promoted });
    expect(fs.existsSync(paths.promotion!)).toBe(false);
    expect(promoteStandaloneDeployment(REWARD_PAYER, r, paths, artifact)?.changed).toBe(false);
    for (const other of [
      { address: sender, blockNumber: 1 },
      { address: p.address, blockNumber: 2 },
    ])
      expect(() => promoteStandaloneDeployment(REWARD_PAYER, r, paths, other)).toThrow("refuse to overwrite");
  });
});
