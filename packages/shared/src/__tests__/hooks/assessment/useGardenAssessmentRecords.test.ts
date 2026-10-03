/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const mockGetGardenAssessments = vi.fn();
const mockReadAssessmentDetail = vi.fn();

vi.mock("../../../modules/data/eas", () => ({
  getGardenAssessments: (...args: unknown[]) => mockGetGardenAssessments(...args),
}));

vi.mock("../../../modules/assessment/assessment-detail", () => ({
  readAssessmentDetail: (...args: unknown[]) => mockReadAssessmentDetail(...args),
}));

vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 11155111 }));

import { useGardenAssessmentRecords } from "../../../hooks/assessment/useGardenAssessmentRecords";

const GARDEN = "0x1234567890123456789012345678901234567890";
const CHAIN_ID = 42161;

function attested(id: string, createdAt: number, assessmentConfigCID = `config-${id}`) {
  return {
    id,
    authorAddress: "0x0000000000000000000000000000000000000002",
    gardenAddress: GARDEN,
    title: `Assessment ${id}`,
    description: "Where the garden stands",
    assessmentConfigCID,
    domain: 2,
    startDate: 1_782_864_000,
    endDate: 1_790_726_400,
    location: "Field A",
    createdAt,
  };
}

const detail = {
  diagnosis: "Compacted soil is limiting water retention.",
  smartOutcomes: [{ description: "Run soil workshops", metric: "sessionsDelivered", target: 6 }],
  cynefinPhase: 2,
  selectedActionUIDs: ["42161-15"],
  sdgTargets: [2],
  evidenceCids: [],
};

const render = (queryClient?: QueryClient) =>
  renderHookWithQueryClient(() => useGardenAssessmentRecords(GARDEN, CHAIN_ID), { queryClient });

/** A read that stays in flight until the test lets it finish. */
function heldRead() {
  let finish!: (value: typeof detail) => void;
  const read = new Promise<typeof detail>((resolve) => {
    finish = resolve;
  });
  return { read, finish };
}

describe("useGardenAssessmentRecords", () => {
  beforeEach(() => {
    mockGetGardenAssessments.mockReset();
    mockReadAssessmentDetail.mockReset();
  });

  it("pairs each assessment with its stored detail, newest first", async () => {
    mockGetGardenAssessments.mockResolvedValue([attested("older", 100), attested("newer", 200)]);
    mockReadAssessmentDetail.mockResolvedValue(detail);

    const { result } = render();
    expect(result.current.status).toBe("pending");

    await waitFor(() =>
      expect(result.current.records.map((record) => record.detail.status)).toEqual([
        "loaded",
        "loaded",
      ])
    );
    expect(result.current.status).toBe("success");
    expect(result.current.records.map((record) => record.summary.id)).toEqual(["newer", "older"]);
    expect(result.current.records[0].detail).toEqual({ status: "loaded", value: detail });
    expect(mockReadAssessmentDetail.mock.calls.map(([cid]) => cid).sort()).toEqual([
      "config-newer",
      "config-older",
    ]);
  });

  // A failed read of the stored files is not an empty assessment: the record
  // stays, and says its detail could not be loaded.
  it("keeps an assessment whose stored detail cannot be read and marks the detail unavailable", async () => {
    mockGetGardenAssessments.mockResolvedValue([attested("a", 100)]);
    mockReadAssessmentDetail.mockRejectedValue(new Error("gateway timed out"));

    const { result } = render();

    await waitFor(() => expect(result.current.records[0]?.detail.status).toBe("unavailable"));
    expect(result.current.status).toBe("success");
    expect(result.current.records[0].summary.title).toBe("Assessment a");
  });

  // A gateway asked for a file nobody pins hangs until the read times out. The
  // reader is told after the first read, not after every retry has also timed out.
  it("says the detail could not be loaded as soon as one read fails, while it is tried again", async () => {
    mockGetGardenAssessments.mockResolvedValue([attested("a", 100)]);
    const retry = heldRead();
    mockReadAssessmentDetail
      .mockRejectedValueOnce(new Error("IPFS request timed out"))
      .mockReturnValueOnce(retry.read);

    // The app retries a failed read; the test client does not unless told to.
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({
      queries: { ...queryClient.getDefaultOptions().queries, retry: 1, retryDelay: 0 },
    });

    const { result } = render(queryClient);

    await waitFor(() => expect(mockReadAssessmentDetail).toHaveBeenCalledTimes(2));
    expect(result.current.records[0].detail.status).toBe("unavailable");

    retry.finish(detail);
    await waitFor(() => expect(result.current.records[0].detail.status).toBe("loaded"));
  });

  // Coming back to the screen reads a failed detail again. A reader who was told
  // it is unavailable is not put back on a loading placeholder for that read.
  it("does not go back to loading when a detail that failed is read again", async () => {
    mockGetGardenAssessments.mockResolvedValue([attested("a", 100)]);
    const secondRead = heldRead();
    mockReadAssessmentDetail
      .mockRejectedValueOnce(new Error("IPFS request timed out"))
      .mockReturnValueOnce(secondRead.read);
    const queryClient = createTestQueryClient();

    const { result } = render(queryClient);
    await waitFor(() => expect(result.current.records[0]?.detail.status).toBe("unavailable"));

    void queryClient.refetchQueries({ queryKey: ["greengoods", "assessmentDetail"] });
    await waitFor(() => expect(mockReadAssessmentDetail).toHaveBeenCalledTimes(2));
    expect(result.current.records[0].detail.status).toBe("unavailable");

    secondRead.finish(detail);
    await waitFor(() => expect(result.current.records[0].detail.status).toBe("loaded"));
  });

  it("reads nothing more for an assessment that stored no config", async () => {
    mockGetGardenAssessments.mockResolvedValue([attested("bare", 100, "")]);

    const { result } = render();

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.records[0].detail).toEqual({
      status: "loaded",
      value: {
        diagnosis: "",
        smartOutcomes: [],
        cynefinPhase: null,
        selectedActionUIDs: [],
        sdgTargets: [],
        evidenceCids: [],
      },
    });
    expect(mockReadAssessmentDetail).not.toHaveBeenCalled();
  });

  it("reports a failed list only while it has no assessment to show", async () => {
    mockGetGardenAssessments.mockRejectedValue(new Error("EAS unavailable"));

    const { result } = render();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.records).toEqual([]);
  });

  // A screen that keeps a record in state from an effect re-renders without end
  // when a hook hands back new objects on every render.
  it("hands back the same records on a re-render when nothing changed", async () => {
    mockGetGardenAssessments.mockResolvedValue([attested("a", 100)]);
    mockReadAssessmentDetail.mockResolvedValue(detail);

    const { result, rerender } = render();
    await waitFor(() => expect(result.current.records[0]?.detail.status).toBe("loaded"));

    const settled = result.current.records;
    rerender();

    expect(result.current.records).toBe(settled);
    expect(result.current.records[0]).toBe(settled[0]);
  });
});
