/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readyWalletClient: vi.fn() }));

// The guard needs a connected wallet. Its error and its retry stay real.
vi.mock("../../modules/transactions/chain-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/transactions/chain-guard")>()),
  ensureAppKitWalletChain: vi.fn(async () => undefined),
  readyWalletClient: mocks.readyWalletClient,
}));

// Every shared test gets a stand-in for the EAS SDK (a vitest alias keeps the
// real one from loading). This one does what the SDK's transaction does when it
// is waited on: it sends through the signer it was connected with.
vi.mock("@ethereum-attestation-service/eas-sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ethereum-attestation-service/eas-sdk")>()),
  EAS: class {
    private signer?: { sendTransaction(transaction: object): Promise<unknown> };
    constructor(private readonly address: string) {}
    connect(signer: { sendTransaction(transaction: object): Promise<unknown> }) {
      this.signer = signer;
      return this;
    }
    async attest() {
      return { wait: () => this.signer?.sendTransaction({ to: this.address, data: "0x1234" }) };
    }
  },
}));

import {
  createDefaultCreateAssessmentPorts,
  createAssessment,
  resolveAssessmentDomain,
  type CreateAssessmentCommand,
  type CreateAssessmentPorts,
} from "../../modules/assessment/create-assessment-command";
import type { AssessmentWorkflowParams } from "../../types/domain";

const gardenId = "0x1111111111111111111111111111111111111111" as const;
const attestationUid = `0x${"55".repeat(32)}`;

function params(overrides: Partial<AssessmentWorkflowParams> = {}): AssessmentWorkflowParams {
  return {
    gardenId,
    title: "Watershed restoration assessment",
    description: "Verified restoration outcomes",
    assessmentType: "domain-2",
    capitals: ["natural", "social"],
    metrics: { treesPlanted: 80 },
    evidenceMedia: [],
    reportDocuments: ["bafy-report", ""],
    impactAttestations: [`  0x${"AB".repeat(32)}  `],
    startDate: "2023-11-14T22:13:20.000Z",
    endDate: 1_700_086_400.9,
    location: "Portland, OR",
    tags: ["watershed"],
    ...overrides,
  };
}

function ports(events: string[] = []): CreateAssessmentPorts {
  let jsonUpload = 0;
  return {
    reader: {
      configuration: vi.fn(() => ({
        easAddress: "0x2222222222222222222222222222222222222222",
        schemaUid: `0x${"44".repeat(32)}`,
        schema: "assessment schema",
        schemaVersion: 2 as const,
      })),
      encode: vi.fn((_schema, values) => {
        events.push("encode");
        return JSON.stringify(values);
      }),
    },
    sender: {
      ensureChain: vi.fn(async () => {
        events.push("chain");
      }),
      connect: vi.fn(async () => {
        events.push("connect");
      }),
      attest: vi.fn(async () => {
        events.push("attest");
        return attestationUid;
      }),
    },
    documents: {
      uploadFile: vi.fn(async (file) => {
        events.push(`file:${file.name}`);
        if (file.name === "bad.jpg") throw new Error("pinning failed");
        return "bafy-evidence";
      }),
      uploadJson: vi.fn(async () => {
        jsonUpload += 1;
        events.push(`json:${jsonUpload}`);
        return jsonUpload === 1 ? "bafy-metrics" : "bafy-config";
      }),
      reportEvidenceFailures: vi.fn(),
      reportMetricsFailure: vi.fn(),
    },
    clock: {
      toUnixSeconds: (value) => {
        if (!value) return 0;
        return typeof value === "number"
          ? Math.floor(value)
          : Math.floor(new Date(value).getTime() / 1_000);
      },
    },
  };
}

function command(
  assessmentParams: AssessmentWorkflowParams,
  onReady: () => void
): CreateAssessmentCommand {
  return { params: assessmentParams, chainId: 11155111, onReady };
}

describe("createAssessment", () => {
  it("uploads normalized documents and attests through explicit ports", async () => {
    const events: string[] = [];
    const dependencies = ports(events);
    const good = new File(["good"], "good.jpg");
    const bad = new File(["bad"], "bad.jpg");
    const onReady = vi.fn(() => events.push("ready"));

    await expect(
      createAssessment(command(params({ evidenceMedia: [good, bad] }), onReady), dependencies)
    ).resolves.toBe(attestationUid);

    expect(events).toEqual([
      "chain",
      "ready",
      "connect",
      "file:good.jpg",
      "file:bad.jpg",
      "json:1",
      "json:2",
      "encode",
      "attest",
    ]);
    expect(dependencies.documents.reportEvidenceFailures).toHaveBeenCalledWith({
      failedCount: 1,
      totalCount: 2,
    });
    expect(dependencies.documents.uploadJson).toHaveBeenNthCalledWith(2, {
      assessmentType: "domain-2",
      capitals: ["natural", "social"],
      metricsCid: "bafy-metrics",
      evidenceMediaCids: ["bafy-evidence"],
      reportDocuments: ["bafy-report"],
      impactAttestations: [`0x${"ab".repeat(32)}`],
      tags: ["watershed"],
    });
    expect(dependencies.sender.attest).toHaveBeenCalledWith(
      expect.objectContaining({ gardenId, schemaUid: `0x${"44".repeat(32)}` })
    );
  });

  it.each([42161, 11155111])("writes the latest registered schema on chain %s", async (chainId) => {
    const { getEASConfig } = await import("../../config/blockchain");
    const config = getEASConfig(chainId);
    const defaultPorts = createDefaultCreateAssessmentPorts({
      account: "0x3333333333333333333333333333333333333333",
      reportEvidenceFailures: vi.fn(),
      reportMetricsFailure: vi.fn(),
    });
    const dependencies = ports();
    dependencies.reader = defaultPorts.reader;
    const encoded = vi.spyOn(dependencies.reader, "encode");
    await createAssessment({ params: params(), chainId, onReady: vi.fn() }, dependencies);
    const schema = chainId === 42161 ? config.ASSESSMENT_V3 : config.ASSESSMENT;
    expect(dependencies.sender.attest).toHaveBeenCalledWith(
      expect.objectContaining({ schemaUid: schema.uid })
    );
    expect(encoded.mock.calls[0][0]).toBe(schema.schema);
    const values = encoded.mock.calls[0][1];
    expect(values).toHaveLength(chainId === 42161 ? 10 : 7);
    if (chainId === 42161) {
      expect(values.slice(-3)).toEqual([
        { name: "assessmentKind", value: 0, type: "uint8" },
        { name: "cycleId", value: 0, type: "uint256" },
        { name: "baselineUID", value: `0x${"00".repeat(32)}`, type: "bytes32" },
      ]);
    }
  });

  it("rejects unknown domains before connecting or uploading documents", async () => {
    const dependencies = ports();
    const onReady = vi.fn();

    await expect(
      createAssessment(command(params({ assessmentType: "unknown" }), onReady), dependencies)
    ).rejects.toThrow("Unrecognized assessment domain");

    expect(dependencies.sender.ensureChain).toHaveBeenCalledOnce();
    expect(onReady).not.toHaveBeenCalled();
    expect(dependencies.sender.connect).not.toHaveBeenCalled();
    expect(dependencies.documents.uploadJson).not.toHaveBeenCalled();
  });

  it("reports a metrics upload failure and never attests", async () => {
    const dependencies = ports();
    const error = new Error("metrics upload unavailable");
    vi.mocked(dependencies.documents.uploadJson).mockRejectedValueOnce(error);

    await expect(createAssessment(command(params(), vi.fn()), dependencies)).rejects.toBe(error);
    expect(dependencies.documents.reportMetricsFailure).toHaveBeenCalledWith(error);
    expect(dependencies.sender.attest).not.toHaveBeenCalled();
  });
});

// ethers runs for real here, over a wallet that answers what it asks. Every
// other wallet write goes through viem, which asks the wallet its network right
// before it sends. These pin the same check for the one write that does not.
describe("the default sender", () => {
  const STEWARD = "0x3333333333333333333333333333333333333333";
  const SEPOLIA = 11155111;
  const CELO = 42220;

  /**
   * The steward's wallet as ethers reaches it. The guard leaves it on Sepolia;
   * `movesAway` says, per attempt, whether it is on Celo by the time ethers has
   * asked everything it asks before sending.
   */
  function stewardWallet(movesAway: (attempt: number) => boolean) {
    const asked: string[] = [];
    let attempt = 0;
    let onCelo = false;
    const request = async ({ method }: { method: string }) => {
      asked.push(method);
      if (method === "eth_chainId") return `0x${(onCelo ? CELO : SEPOLIA).toString(16)}`;
      if (method === "eth_accounts") return [STEWARD];
      if (method === "eth_blockNumber") return "0x1";
      if (method === "eth_estimateGas") {
        attempt += 1;
        onCelo = movesAway(attempt);
        return "0x5208";
      }
      // The person declines, so a send that reaches the wallet ends there.
      throw Object.assign(new Error("User rejected the request."), { code: 4001 });
    };
    mocks.readyWalletClient.mockReset().mockImplementation(async () => {
      onCelo = false;
      return { account: { address: STEWARD }, transport: { request } };
    });
    return asked;
  }

  async function attest() {
    const { sender } = createDefaultCreateAssessmentPorts({
      account: STEWARD,
      reportEvidenceFailures: vi.fn(),
      reportMetricsFailure: vi.fn(),
    });
    await sender.ensureChain(SEPOLIA);
    await sender.connect("0x2222222222222222222222222222222222222222");
    return sender.attest({ schemaUid: `0x${"44".repeat(32)}`, gardenId, encodedData: "0x1234" });
  }

  it("never asks a wallet on another network to send, and says which network it needs", async () => {
    const asked = stewardWallet(() => true);

    await expect(attest()).rejects.toMatchObject({
      name: "WalletChainMismatchError",
      targetChainId: SEPOLIA,
      walletChainId: CELO,
    });

    expect(asked).not.toContain("eth_sendTransaction");
    // Readied before the uploads, for the attestation, and once more for a second attempt.
    expect(mocks.readyWalletClient).toHaveBeenCalledTimes(3);
  });

  it("readies the wallet again and sends once when it had moved for the first attempt only", async () => {
    const asked = stewardWallet((attempt) => attempt === 1);

    // The wallet's own answer to the send: the check let the second attempt through.
    await expect(attest()).rejects.toMatchObject({ code: "ACTION_REJECTED" });

    expect(asked.filter((method) => method === "eth_sendTransaction")).toHaveLength(1);
    expect(asked.slice(-2)).toEqual(["eth_chainId", "eth_sendTransaction"]);
  });
});

describe("resolveAssessmentDomain", () => {
  it.each([
    ["solar", 0],
    ["WASTE", 3],
    ["domain-2", 2],
    ["domain-4", null],
  ])("maps %s to %s", (assessmentType, expected) => {
    expect(resolveAssessmentDomain(assessmentType)).toBe(expected);
  });
});
