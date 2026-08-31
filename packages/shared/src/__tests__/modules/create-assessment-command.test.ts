/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import {
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
