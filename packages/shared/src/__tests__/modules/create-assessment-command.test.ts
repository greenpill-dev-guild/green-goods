/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, zeroHash } from "viem";
import { sepolia } from "viem/chains";
import { createFakeSmartAccountClient } from "../test-utils/transaction-fakes";
import { PasskeySender } from "../../modules/transactions/passkey-sender";
import { EASABI } from "../../utils/blockchain/contracts";
import type { TransactionSender } from "../../modules/transactions/types";

const mocks = vi.hoisted(() => ({ readyWalletClient: vi.fn(), getReceipt: vi.fn() }));

vi.mock("../../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/blockchain/contracts")>()),
  createClients: () => ({ publicClient: { getTransactionReceipt: mocks.getReceipt } }),
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
      transactionSender: {
        authMode: "wallet",
        supportsBatching: false,
        supportsSponsorship: false,
        sendContractCall: vi.fn(),
      },
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

describe("the passkey assessment sender", () => {
  const ACCOUNT = "0x7777777777777777777777777777777777777777" as const;
  const EAS = "0x2222222222222222222222222222222222222222" as const;
  const SCHEMA = `0x${"44".repeat(32)}` as const;
  const HASH = `0x${"66".repeat(32)}` as const;
  function fixture(
    logOverrides: {
      address?: string;
      recipient?: string;
      attester?: string;
      schemaUID?: string;
      uid?: string;
    } = {},
    passkeySenderOverride?: TransactionSender,
    authMode: "wallet" | "passkey" = "passkey"
  ) {
    const assertOwnership = vi.fn(async () => undefined);
    const sendContractCall = vi.fn(async () => ({ hash: HASH, sponsored: true }));
    const transactionSender: TransactionSender = {
      authMode,
      supportsBatching: false,
      supportsSponsorship: true,
      assertOwnership,
      sendContractCall,
    };
    const log = {
      address: logOverrides.address ?? EAS,
      topics: encodeEventTopics({
        abi: EASABI,
        eventName: "Attested",
        args: {
          recipient: logOverrides.recipient ?? gardenId,
          attester: logOverrides.attester ?? ACCOUNT,
          schemaUID: logOverrides.schemaUID ?? SCHEMA,
        },
      }),
      data: encodeAbiParameters(
        [{ type: "bytes32" }],
        [(logOverrides.uid ?? attestationUid) as `0x${string}`]
      ),
    };
    mocks.getReceipt.mockReset().mockResolvedValue({ status: "success", logs: [log] });
    const dependencies = createDefaultCreateAssessmentPorts({
      account: ACCOUNT,
      transactionSender: passkeySenderOverride ?? transactionSender,
      reportEvidenceFailures: vi.fn(),
      reportMetricsFailure: vi.fn(),
    });
    const send = async () => {
      await dependencies.sender.ensureChain(11155111);
      await dependencies.sender.connect(EAS);
      return dependencies.sender.attest({ schemaUid: SCHEMA, gardenId, encodedData: "0x1234" });
    };
    return { send, assertOwnership, sendContractCall };
  }
  it.each([
    "wallet",
    "passkey",
  ] as const)("sends EAS through the %s account and returns its confirmed attestation UID", async (authMode) => {
    const f = fixture({}, undefined, authMode);
    await expect(f.send()).resolves.toBe(attestationUid);
    expect(f.sendContractCall).toHaveBeenCalledWith(
      {
        address: EAS,
        account: ACCOUNT,
        chainId: 11155111,
        abi: EASABI,
        functionName: "attest",
        args: [
          {
            schema: SCHEMA,
            data: {
              recipient: gardenId,
              expirationTime: 0n,
              revocable: false,
              refUID: zeroHash,
              data: "0x1234",
              value: 0n,
            },
          },
        ],
      },
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
    expect(mocks.getReceipt).toHaveBeenCalledWith({ hash: HASH });
    expect(f.assertOwnership).toHaveBeenCalledWith(ACCOUNT, 11155111);
  });
  it("encodes the EAS call through the real PasskeySender and confirmed UserOperation path", async () => {
    const client = createFakeSmartAccountClient({
      accountAddress: ACCOUNT,
      chain: sepolia,
      result: HASH,
    });
    const sender = new PasskeySender(client, {
      resolveSmartAccountClient: async () => client,
      assertWriteSafety: async () => {},
    });
    await expect(fixture({}, sender).send()).resolves.toBe(attestationUid);
    const request = client.sendUserOperation.mock.calls[0][0] as {
      calls: { to: `0x${string}`; data: `0x${string}` }[];
    };
    const call = request.calls[0];
    expect(call.to).toBe(EAS);
    const decoded = decodeFunctionData({ abi: EASABI, data: call.data });
    expect(decoded.functionName).toBe("attest");
    expect(decoded.args?.[0]).toMatchObject({
      schema: SCHEMA,
      data: { recipient: gardenId, refUID: zeroHash, data: "0x1234" },
    });
    expect(client.waitForUserOperationReceipt).toHaveBeenCalled();
  });
  it.each([
    { address: ACCOUNT },
    { recipient: ACCOUNT },
    { attester: gardenId },
    { schemaUID: zeroHash },
    { uid: zeroHash },
  ])("refuses a receipt from another contract/account/garden/schema or an empty UID: %j", async (override) => {
    await expect(fixture(override).send()).rejects.toThrow("no matching attestation");
  });
  it("refuses a reverted receipt", async () => {
    const f = fixture();
    mocks.getReceipt.mockResolvedValue({ status: "reverted", logs: [] });
    await expect(f.send()).rejects.toThrow("reverted");
  });
  it("does not expose the RPC request or claim the confirmed transaction failed when its receipt is unavailable", async () => {
    const f = fixture();
    mocks.getReceipt.mockRejectedValueOnce(new Error("RPC request details"));
    await expect(f.send()).rejects.toThrow("assessment-confirmation-unavailable");
    expect(f.sendContractCall).toHaveBeenCalledOnce();
  });
  it("checks session ownership again immediately before sending after uploads", async () => {
    const f = fixture();
    f.assertOwnership
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("submission-ownership-changed"));
    await expect(f.send()).rejects.toThrow("submission-ownership-changed");
    expect(f.sendContractCall).not.toHaveBeenCalled();
  });
  it("propagates a dismissed passkey prompt without reading or claiming a receipt", async () => {
    const f = fixture();
    f.sendContractCall.mockRejectedValueOnce(new Error("Passkey prompt cancelled"));
    await expect(f.send()).rejects.toThrow("cancelled");
    expect(mocks.getReceipt).not.toHaveBeenCalled();
  });
});
