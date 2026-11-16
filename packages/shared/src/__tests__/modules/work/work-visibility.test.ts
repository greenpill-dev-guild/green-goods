import { describe, expect, it, vi } from "vitest";
import { isWorkVisible, readWorkVisibility } from "../../../modules/work/work-visibility";
import type { PublicReportingRead } from "../../../modules/commitment-pooling/public-record-exclusions";
import type { GraphQLReader } from "../../../modules/data/graphql-client";

const uid = (value: number) => `0x${value.toString(16).padStart(64, "0")}`;
const address = (value: number) => `0x${value.toString(16).padStart(40, "0")}`;
const reporting = () => ({
  commitments: vi.fn(),
  links: vi.fn(async () => ({
    workUIDs: new Set([uid(1).toUpperCase()]),
    assessmentUIDs: new Set<string>(),
    commitmentEntityIds: [],
    attestationUIDs: [uid(1)],
  })),
});
const approval = (number: number, workUID = uid(1)) => ({
  id: uid(number),
  attester: address(2),
  recipient: address(3),
  timeCreated: 100,
  decodedDataJson: JSON.stringify([
    { name: "workUID", value: { value: workUID } },
    { name: "approved", value: { value: true } },
  ]),
});

describe("work presentation visibility", () => {
  it("does not read rehearsals or approvals on an unconfigured chain", async () => {
    const source = reporting();
    const query = vi.fn();
    const snapshot = await readWorkVisibility(11155111, {
      reporting: source as PublicReportingRead,
      reader: { query } as GraphQLReader,
    });
    expect(snapshot).toEqual({ chainId: 11155111, excludedWorkUIDs: [], excludedApprovalUIDs: [] });
    expect(source.links).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("reads every excluded review page and preserves unrelated text matches", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => approval(index + 10));
    rows.push(approval(200, uid(2)));
    const query = vi.fn(async (_document, variables) => ({
      data: { attestations: rows.slice(variables.skip, variables.skip + variables.take) },
    }));
    const snapshot = await readWorkVisibility(42161, {
      reporting: reporting() as PublicReportingRead,
      reader: { query } as GraphQLReader,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(snapshot.excludedApprovalUIDs).toHaveLength(101);
    expect(snapshot.excludedApprovalUIDs).not.toContain(uid(200));
    expect(isWorkVisible(uid(1).toUpperCase(), snapshot)).toBe(false);
    expect(isWorkVisible(uid(2), snapshot)).toBe(true);
    expect(isWorkVisible("local-unsent-work", snapshot)).toBe(true);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("rejects an unavailable cycle classification instead of exposing its work", async () => {
    const source = reporting();
    source.links.mockRejectedValue(new Error("indexer unavailable"));
    await expect(
      readWorkVisibility(42161, { reporting: source as PublicReportingRead })
    ).rejects.toThrow("indexer unavailable");
  });

  it("rejects a failed decision read instead of publishing incorrect counts", async () => {
    const query = vi.fn(async () => ({ error: new Error("EAS unavailable") }));
    await expect(
      readWorkVisibility(42161, {
        reporting: reporting() as PublicReportingRead,
        reader: { query } as GraphQLReader,
      })
    ).rejects.toThrow("Work visibility could not be read");
  });
});
