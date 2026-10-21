/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - the hook's own work is joining each approved work to its action's domain and surviving a failed domain read; AttestationSelector.test.tsx covers the filtering
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetWorks, mockGetWorkApprovals, mockGetActionDomains, mockWarn } = vi.hoisted(() => ({
  mockGetWorks: vi.fn(),
  mockGetWorkApprovals: vi.fn(),
  mockGetActionDomains: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock("../../../modules/data/eas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/data/eas")>()),
  getWorks: mockGetWorks,
  getWorkApprovals: mockGetWorkApprovals,
}));

vi.mock("../../../modules/data/greengoods", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/data/greengoods")>()),
  getActionDomains: mockGetActionDomains,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: mockWarn, error: vi.fn(), debug: vi.fn() },
}));

import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { useAttestations } from "../../../hooks/hypercerts/useAttestations";
import { Domain } from "../../../types/domain";
import { createMockWork, createMockWorkApproval } from "../../test-utils/mock-factories";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// A work attestation's metadata field holds the CID of its metadata file, never the domain.
const METADATA_CID = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";

describe("useAttestations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorks.mockResolvedValue([
      createMockWork({ id: "0xwaste", actionUID: 3, metadata: METADATA_CID }),
      createMockWork({ id: "0xunlisted", actionUID: 9, metadata: METADATA_CID }),
      createMockWork({ id: "0xrejected", actionUID: 3, metadata: METADATA_CID }),
    ]);
    mockGetWorkApprovals.mockResolvedValue([
      createMockWorkApproval({ id: "0xa1", workUID: "0xwaste", createdAt: 2 }),
      createMockWorkApproval({ id: "0xa2", workUID: "0xunlisted", createdAt: 1 }),
      createMockWorkApproval({ id: "0xa3", workUID: "0xrejected", approved: false }),
    ]);
  });

  it("gives each approved work its action's domain, and none when the indexer has no domain for it", async () => {
    mockGetActionDomains.mockResolvedValue(new Map([[3, Domain.WASTE]]));

    const { result } = renderHookWithQueryClient(() => useAttestations("0xgarden"));

    await waitFor(() => expect(result.current.attestations).toHaveLength(2));
    expect(result.current.attestations.map(({ workUid, domain }) => [workUid, domain])).toEqual([
      ["0xwaste", "waste"],
      ["0xunlisted", undefined],
    ]);
    expect(mockGetActionDomains).toHaveBeenCalledWith(expect.any(Array), DEFAULT_CHAIN_ID);
  });

  it("still lists the work, with no domain, when the action domains cannot be read", async () => {
    mockGetActionDomains.mockRejectedValue(new Error("indexer offline"));

    const { result } = renderHookWithQueryClient(() => useAttestations("0xgarden"));

    await waitFor(() => expect(result.current.attestations).toHaveLength(2));
    expect(result.current.hasError).toBe(false);
    expect(result.current.attestations.every((attestation) => !attestation.domain)).toBe(true);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Action domains could not be read"),
      expect.objectContaining({ error: "indexer offline" })
    );
  });
});
