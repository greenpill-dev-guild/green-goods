/**
 * Forge utility tests — artifact parsing, network/sender normalization, request parsing
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeNetwork,
  normalizeSender,
  getChainId,
  parseDeployRequest,
  parseUpgradeRequest,
  parseRunScriptRequest,
  findForgeArtifact,
  readForgeArtifact,
  persistTxPlan,
  readLatestPlan,
  redactArg,
  toSerializableJob,
} from "../forge";
import { NETWORK_CHAIN_IDS, UPGRADE_CONTRACTS, SCRIPT_DEFINITIONS, type OpsJob } from "../types";

describe("normalizeNetwork", () => {
  it("returns valid network names", () => {
    expect(normalizeNetwork("sepolia")).toBe("sepolia");
    expect(normalizeNetwork("mainnet")).toBe("mainnet");
    expect(normalizeNetwork("localhost")).toBe("localhost");
    expect(normalizeNetwork("arbitrum")).toBe("arbitrum");
    expect(normalizeNetwork("celo")).toBe("celo");
  });

  it("throws for non-string input", () => {
    expect(() => normalizeNetwork(undefined)).toThrow("network is required");
    expect(() => normalizeNetwork(null)).toThrow("network is required");
    expect(() => normalizeNetwork(42)).toThrow("network is required");
  });

  it("throws for unsupported network", () => {
    expect(() => normalizeNetwork("polygon")).toThrow("Unsupported network: polygon");
    expect(() => normalizeNetwork("")).toThrow("Unsupported network: ");
  });
});

describe("normalizeSender", () => {
  it("returns undefined for empty/null/undefined input", () => {
    expect(normalizeSender(undefined)).toBeUndefined();
    expect(normalizeSender(null)).toBeUndefined();
    expect(normalizeSender("")).toBeUndefined();
  });

  it("returns checksummed address for valid address", () => {
    // Lowercase address should be checksummed
    const result = normalizeSender("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  });

  it("throws for non-string input", () => {
    expect(() => normalizeSender(42)).toThrow("sender must be a valid 0x address");
  });

  it("throws for invalid address string", () => {
    expect(() => normalizeSender("not-an-address")).toThrow("sender must be a valid 0x address");
    expect(() => normalizeSender("0x123")).toThrow("sender must be a valid 0x address");
  });
});

describe("getChainId", () => {
  it("maps network names to chain ids", () => {
    expect(getChainId("localhost")).toBe(31337);
    expect(getChainId("mainnet")).toBe(1);
    expect(getChainId("sepolia")).toBe(11155111);
    expect(getChainId("arbitrum")).toBe(42161);
    expect(getChainId("celo")).toBe(42220);
  });
});

describe("NETWORK_CHAIN_IDS", () => {
  it("contains all expected networks", () => {
    expect(Object.keys(NETWORK_CHAIN_IDS)).toEqual(
      expect.arrayContaining(["localhost", "mainnet", "sepolia", "arbitrum", "celo"])
    );
  });
});

describe("UPGRADE_CONTRACTS", () => {
  it("contains expected contract names plus 'all'", () => {
    expect(UPGRADE_CONTRACTS.has("action-registry")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("garden-token")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("gardener-account")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("octant-module")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("work-resolver")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("work-approval-resolver")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("assessment-resolver")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("deployment-registry")).toBe(true);
    expect(UPGRADE_CONTRACTS.has("all")).toBe(true);
  });
});

describe("SCRIPT_DEFINITIONS", () => {
  it("has expected script ids", () => {
    expect(SCRIPT_DEFINITIONS["upload-action-images"]).toBeDefined();
    expect(SCRIPT_DEFINITIONS["upload-action-images:dry-run"]).toBeDefined();
    expect(SCRIPT_DEFINITIONS["envio-update"]).toBeDefined();
    expect(SCRIPT_DEFINITIONS["deploy-status"]).toBeDefined();
  });

  it("scripts have required fields", () => {
    for (const [id, script] of Object.entries(SCRIPT_DEFINITIONS)) {
      expect(script.id).toBe(id);
      expect(script.description).toBeTruthy();
      expect(["root", "contracts"]).toContain(script.cwd);
      expect(script.command).toBeTruthy();
      expect(Array.isArray(script.args)).toBe(true);
    }
  });
});

describe("parseDeployRequest", () => {
  it("parses a minimal valid request", () => {
    const result = parseDeployRequest({ network: "sepolia" });
    expect(result.network).toBe("sepolia");
    expect(result.sender).toBeUndefined();
    expect(result.updateSchemasOnly).toBe(false);
    expect(result.force).toBe(false);
    expect(result.deploymentSalt).toBeUndefined();
    expect(result.syncEnvio).toBe(true);
  });

  it("parses all optional fields", () => {
    const result = parseDeployRequest({
      network: "arbitrum",
      sender: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      updateSchemasOnly: true,
      force: true,
      deploymentSalt: "my-salt",
      syncEnvio: false,
    });

    expect(result.network).toBe("arbitrum");
    expect(result.sender).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.updateSchemasOnly).toBe(true);
    expect(result.force).toBe(true);
    expect(result.deploymentSalt).toBe("my-salt");
    expect(result.syncEnvio).toBe(false);
  });

  it("throws for null/undefined body", () => {
    expect(() => parseDeployRequest(null)).toThrow("Invalid request body");
    expect(() => parseDeployRequest(undefined)).toThrow("Invalid request body");
    expect(() => parseDeployRequest("string")).toThrow("Invalid request body");
  });

  it("throws for missing network", () => {
    expect(() => parseDeployRequest({})).toThrow("network is required");
  });

  it("throws for invalid network", () => {
    expect(() => parseDeployRequest({ network: "polygon" })).toThrow("Unsupported network");
  });

  it("defaults syncEnvio to true when undefined", () => {
    const result = parseDeployRequest({ network: "sepolia" });
    expect(result.syncEnvio).toBe(true);
  });

  it("accepts syncEnvio as string 'true'", () => {
    const result = parseDeployRequest({ network: "sepolia", syncEnvio: "true" });
    expect(result.syncEnvio).toBe(true);
  });
});

describe("parseUpgradeRequest", () => {
  it("parses a valid request", () => {
    const result = parseUpgradeRequest({ network: "sepolia", contract: "garden-token" });
    expect(result.network).toBe("sepolia");
    expect(result.contract).toBe("garden-token");
    expect(result.sender).toBeUndefined();
  });

  it("parses with sender", () => {
    const result = parseUpgradeRequest({
      network: "arbitrum",
      contract: "all",
      sender: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    });
    expect(result.sender).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  });

  it("throws for null/undefined body", () => {
    expect(() => parseUpgradeRequest(null)).toThrow("Invalid request body");
    expect(() => parseUpgradeRequest(undefined)).toThrow("Invalid request body");
  });

  it("throws for unsupported contract name", () => {
    expect(() => parseUpgradeRequest({ network: "sepolia", contract: "unknown-contract" })).toThrow(
      "Unsupported contract for upgrade"
    );
  });

  it("throws for missing contract", () => {
    expect(() => parseUpgradeRequest({ network: "sepolia" })).toThrow("Unsupported contract for upgrade");
  });
});

describe("parseRunScriptRequest", () => {
  it("parses a valid request without network", () => {
    const result = parseRunScriptRequest({ scriptId: "upload-action-images" });
    expect(result.scriptId).toBe("upload-action-images");
    expect(result.network).toBeUndefined();
  });

  it("parses with network", () => {
    const result = parseRunScriptRequest({ scriptId: "deploy-status", network: "sepolia" });
    expect(result.scriptId).toBe("deploy-status");
    expect(result.network).toBe("sepolia");
  });

  it("throws for null/undefined body", () => {
    expect(() => parseRunScriptRequest(null)).toThrow("Invalid request body");
    expect(() => parseRunScriptRequest(undefined)).toThrow("Invalid request body");
  });

  it("throws for unsupported script id", () => {
    expect(() => parseRunScriptRequest({ scriptId: "nonexistent-script" })).toThrow("Unsupported script id");
  });

  it("throws for missing script id", () => {
    expect(() => parseRunScriptRequest({})).toThrow("Unsupported script id");
  });
});

describe("redactArg", () => {
  it("redacts long hex strings (likely private keys)", () => {
    const longHex = "0x" + "a".repeat(64);
    expect(redactArg(longHex)).toBe("[REDACTED]");
  });

  it("does not redact normal addresses (42 chars)", () => {
    const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    expect(redactArg(address)).toBe(address);
  });

  it("does not redact non-hex arguments", () => {
    expect(redactArg("--network")).toBe("--network");
    expect(redactArg("sepolia")).toBe("sepolia");
  });

  it("does not redact short hex strings", () => {
    expect(redactArg("0x1234")).toBe("0x1234");
  });
});

describe("toSerializableJob", () => {
  const makeJob = (): OpsJob => ({
    id: "job-1",
    type: "deploy-plan",
    status: "succeeded",
    requestedBy: "0xUser",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    payload: { network: "sepolia" },
    result: { chainId: 11155111 },
    error: null,
    logs: [
      { id: 1, at: "2026-01-01T00:00:30.000Z", stream: "stdout", message: "Building..." },
    ],
  });

  it("includes all fields except logs when includeLogs is false", () => {
    const serialized = toSerializableJob(makeJob(), false);

    expect(serialized.id).toBe("job-1");
    expect(serialized.type).toBe("deploy-plan");
    expect(serialized.status).toBe("succeeded");
    expect(serialized.requestedBy).toBe("0xUser");
    expect(serialized.payload).toEqual({ network: "sepolia" });
    expect(serialized.result).toEqual({ chainId: 11155111 });
    expect(serialized.error).toBeNull();
    expect(serialized).not.toHaveProperty("logs");
  });

  it("includes logs when includeLogs is true", () => {
    const serialized = toSerializableJob(makeJob(), true);

    expect(serialized).toHaveProperty("logs");
    const logs = serialized.logs as Array<Record<string, unknown>>;
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("Building...");
  });
});

describe("findForgeArtifact", () => {
  const tmpDir = path.join(__dirname, "_test-artifacts");

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when no artifact found", () => {
    // findForgeArtifact uses CONTRACTS_DIR internally, which won't have test files
    // We test the error path by calling with a chain ID that won't have artifacts
    expect(() => findForgeArtifact("NonExistent.s.sol", 99999, false)).toThrow(
      "Forge artifact not found"
    );
  });
});

describe("readForgeArtifact", () => {
  const tmpFile = path.join(__dirname, "_test-read-artifact.json");

  afterEach(() => {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  it("parses a valid forge broadcast artifact", () => {
    const artifact = {
      transactions: [
        {
          hash: "0xabc123",
          transactionType: "CREATE",
          contractName: "GardenToken",
          transaction: {
            from: "0xSender",
            to: null,
            gas: "0x100000",
            value: "0x0",
          },
        },
      ],
    };
    fs.writeFileSync(tmpFile, JSON.stringify(artifact));

    const result = readForgeArtifact(tmpFile);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions![0].hash).toBe("0xabc123");
    expect(result.transactions![0].contractName).toBe("GardenToken");
  });

  it("handles artifact with no transactions", () => {
    fs.writeFileSync(tmpFile, JSON.stringify({}));

    const result = readForgeArtifact(tmpFile);
    expect(result.transactions).toBeUndefined();
  });
});

describe("persistTxPlan", () => {
  const tmpDir = path.join(__dirname, "_test-persist");

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a tx plan JSON file from a forge artifact", () => {
    // Create a source artifact
    const sourceArtifact = path.join(tmpDir, "source.json");
    fs.writeFileSync(
      sourceArtifact,
      JSON.stringify({
        transactions: [
          {
            hash: "0xabc",
            transactionType: "CREATE",
            contractName: "GardenToken",
            transaction: {
              from: "0xSender",
              to: null,
              gas: "0x100000",
              value: "0x0",
              nonce: "0x1",
              input: "0x6080...",
              chainId: "11155111",
            },
          },
        ],
      })
    );

    // Monkey-patch: persistTxPlan uses ARTIFACT_OUTPUT_DIR internally.
    // Instead, let's test the function directly by creating the necessary directory structure.
    // The function writes to ARTIFACT_OUTPUT_DIR/tx-plans/
    // Since we can't easily override the constant, we'll validate the return value.

    // This will write to the actual ARTIFACT_OUTPUT_DIR — verify it doesn't throw
    const planPath = persistTxPlan({
      kind: "deploy",
      network: "sepolia",
      chainId: 11155111,
      label: "core",
      sender: "0xSender",
      sourceArtifact,
    });

    expect(planPath).toContain("11155111-deploy-core-");
    expect(planPath).toContain("-plan.json");
    expect(fs.existsSync(planPath)).toBe(true);

    const planData = JSON.parse(fs.readFileSync(planPath, "utf8"));
    expect(planData.network).toBe("sepolia");
    expect(planData.chainId).toBe(11155111);
    expect(planData.kind).toBe("deploy");
    expect(planData.label).toBe("core");
    expect(planData.sender).toBe("0xSender");
    expect(planData.transactionCount).toBe(1);
    expect(planData.transactions).toHaveLength(1);
    expect(planData.transactions[0].contractName).toBe("GardenToken");

    // Cleanup the generated file
    fs.unlinkSync(planPath);
  });
});

describe("readLatestPlan", () => {
  it("throws when tx plan directory does not exist", () => {
    // Uses ARTIFACT_OUTPUT_DIR which might not have matching plans
    expect(() => readLatestPlan(99999, "garden-token")).toThrow();
  });
});
