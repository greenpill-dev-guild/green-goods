import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { policyDeploymentPlan, type PolicyDeploymentArtifact } from "./single-attestation-deployment";
import {
  beginPolicyBroadcast,
  parsePolicyOptions,
  policyForgeCommand,
  policyPaths,
  policyReceiptHash,
  policySourceCommand,
  readPolicyJson,
  recordPolicyDeployment,
  redactExplorerKey,
  writePolicyJson,
} from "./single-attestation-operation";

const roots: string[] = [];
const root = () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "policy-operation-"));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => fs.rmSync(r, { recursive: true, force: true })));
const plan = () =>
  policyDeploymentPlan({
    creationCode: "0x60006000",
    runtimeCode: "0x6000",
    network: "arbitrum",
    chainId: 42161,
    sender: "0x00000000000000000000000000000000000000A1",
    nonce: 7,
    commit: "a".repeat(40),
  });
const hash = `0x${"b".repeat(64)}`;

describe("standalone policy operation boundaries", () => {
  it("requires an exact single mode and explicit public planning inputs", () => {
    expect(parsePolicyOptions(["deploy", "--network", "arbitrum", "--preflight"]).mode).toBe("preflight");
    expect(
      parsePolicyOptions([
        "deploy",
        "--network",
        "arbitrum",
        "--plan-only",
        "--sender",
        plan().deployer,
        "--expected-nonce",
        "0",
      ]).nonce,
    ).toBe(0);
    for (const args of [
      [],
      ["--simulate", "--broadcast"],
      ["--plan-only"],
      ["--broadcast"],
      ["--broadcast", "--expected-nonce", "-1"],
      ["--preflight", "--private-key", "secret"],
    ]) {
      expect(() => parsePolicyOptions(["deploy", "--network", "arbitrum", ...args])).toThrow();
    }
    expect(() => parsePolicyOptions(["verify", "--network", "arbitrum", "--broadcast"])).toThrow();
  });
  it("simulation has no signer/password while broadcast uses only the established keystore", () => {
    const before = process.env.ETH_PASSWORD;
    process.env.ETH_PASSWORD = "/fixture/password-path";
    try {
      const simulated = policyForgeCommand(plan(), "https://rpc.invalid", false);
      expect(simulated.args).not.toContain("--broadcast");
      expect(simulated.args).not.toContain("--account");
      expect(simulated.env.ETH_PASSWORD).toBeUndefined();
      const live = policyForgeCommand(plan(), "https://rpc.invalid", true);
      expect(live.args.slice(-3)).toEqual(["--broadcast", "--account", "green-goods-deployer"]);
      expect(live.env.SINGLE_ATTESTATION_POLICY_NONCE).toBe("7");
      expect(live.env.PINATA_JWT_OP_REF).toBe("");
    } finally {
      if (before === undefined) delete process.env.ETH_PASSWORD;
      else process.env.ETH_PASSWORD = before;
    }
  });
  it("publishes source only with verification, with no signer and no explorer key in the arguments or logs", () => {
    expect(parsePolicyOptions(["verify", "--network", "arbitrum", "--publish-source"]).publishSource).toBe(true);
    expect(parsePolicyOptions(["verify", "--network", "arbitrum"]).publishSource).toBe(false);
    expect(() => parsePolicyOptions(["verify", "--network", "localhost", "--publish-source"])).toThrow("explorer");
    expect(() => parsePolicyOptions(["deploy", "--network", "arbitrum", "--preflight", "--publish-source"])).toThrow(
      "explorer",
    );
    const before = { key: process.env.ETHERSCAN_API_KEY, password: process.env.ETH_PASSWORD };
    process.env.ETHERSCAN_API_KEY = "fixture-explorer-key";
    process.env.ETH_PASSWORD = "/fixture/password-path";
    try {
      const command = policySourceCommand({ address: plan().address, chainId: 42161 }, "https://explorer.invalid/api");
      expect(command.args).toEqual([
        "verify-contract",
        plan().address,
        "src/modules/SingleAttestationPolicy.sol:SingleAttestationPolicy",
        "--chain",
        "42161",
        "--verifier",
        "etherscan",
        "--verifier-url",
        "https://explorer.invalid/api",
        "--watch",
      ]);
      expect(command.args.join(" ")).not.toContain("fixture-explorer-key");
      expect(command.env.FOUNDRY_PROFILE).toBe("production");
      expect(command.env.ETH_PASSWORD).toBeUndefined();
      const echoed =
        "GET https://api.invalid/v2/api?chainid=42161&apikey=fixture-explorer-key failed (fixture-explorer-key)";
      expect(redactExplorerKey(echoed, "fixture-explorer-key")).not.toContain("fixture-explorer-key");
      expect(redactExplorerKey("apikey=another-secret&module=contract", undefined)).toBe(
        "apikey=[REDACTED]&module=contract",
      );
    } finally {
      for (const [name, value] of [
        ["ETHERSCAN_API_KEY", before.key],
        ["ETH_PASSWORD", before.password],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
  it("rejects escaped or symlinked evidence paths", () => {
    const r = root();
    expect(() => policyPaths(r, "arbitrum", "../escaped.json")).toThrow("runtime");
    fs.mkdirSync(path.join(r, ".generated"));
    fs.symlinkSync(root(), path.join(r, ".generated/runtime"));
    expect(() => policyPaths(r, "arbitrum")).toThrow("symlink");
  });
  it("preserves a pending journal to stop duplicate sends and publishes only complete verified evidence", () => {
    const r = root(),
      paths = policyPaths(r, "arbitrum"),
      p = plan();
    beginPolicyBroadcast(r, paths, p);
    expect(readPolicyJson<{ state: string }>(r, paths.journal).state).toBe("pending");
    expect(fs.existsSync(paths.artifact)).toBe(false);
    expect(() => beginPolicyBroadcast(r, paths, p)).toThrow();
    const artifact = {
      schemaVersion: 1,
      kind: "SINGLE_ATTESTATION_POLICY_DEPLOYMENT",
      network: p.network,
      chainId: p.chainId,
      address: p.address,
      runtimeCodeHash: p.runtimeCodeHash,
      creationCodeHash: p.creationCodeHash,
      transactionHash: hash,
      blockNumber: 1,
      blockHash: hash,
      deployer: p.deployer,
      nonce: p.nonce,
      commit: p.commit,
      verifiedAt: new Date().toISOString(),
    } satisfies PolicyDeploymentArtifact;
    recordPolicyDeployment(r, paths, p, artifact);
    expect(readPolicyJson(r, paths.artifact)).toEqual(artifact);
    expect(readPolicyJson<{ state: string }>(r, paths.journal).state).toBe("verified");
    expect(() => recordPolicyDeployment(r, paths, p, artifact)).toThrow();
    expect(() => beginPolicyBroadcast(r, paths, p)).toThrow("already recorded");
    expect(fs.existsSync(path.join(r, "deployments/42161-latest.json"))).toBe(false);
  });
  it("only selects a unique matching CREATE receipt; stale or ambiguous Forge artifacts fail closed", () => {
    const p = plan();
    const tx = {
      hash,
      transactionType: "CREATE",
      contractName: "SingleAttestationPolicy",
      contractAddress: p.address,
      transaction: { from: p.deployer, nonce: "0x7", input: p.creationCode, value: "0x0", to: null },
    };
    expect(policyReceiptHash({ transactions: [tx] }, p)).toBe(hash);
    expect(() => policyReceiptHash({ transactions: [tx, tx] }, p)).toThrow("unique");
    expect(() =>
      policyReceiptHash({ transactions: [{ ...tx, transaction: { ...tx.transaction, nonce: "0x8" } }] }, p),
    ).toThrow("unique");
    expect(() =>
      policyReceiptHash({ transactions: [{ ...tx, transaction: { ...tx.transaction, input: "0x6001" } }] }, p),
    ).toThrow("unique");
  });
  it("writes plans atomically and refuses evidence overwrite", () => {
    const r = root(),
      paths = policyPaths(r, "arbitrum");
    writePolicyJson(r, paths.plan, plan());
    expect(readPolicyJson(r, paths.plan)).toEqual(expect.objectContaining({ authorityEnabled: false }));
    expect(fs.readdirSync(paths.runtime)).toEqual([path.basename(paths.plan)]);
    expect(() => writePolicyJson(r, paths.plan, {}, true)).toThrow();
  });
});
