import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../test-utils";

// Mock dependencies
vi.mock("../../modules/data/eas", () => ({
  getWorks: vi.fn(),
  getWorkApprovals: vi.fn(),
}));

vi.mock("../../modules/job-queue", () => ({
  jobQueue: {
    getJobs: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 }),
  },
  jobQueueDB: {
    getImagesForJob: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../modules/job-queue/event-bus", () => ({
  jobQueueEventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    onMultiple: vi.fn(),
  },
  useJobQueueEvents: vi.fn(),
}));

vi.mock("../../hooks/auth/useUser", () => ({
  useUser: vi.fn(() => ({
    smartAccountAddress: "0xuser",
  })),
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

import { useWorks } from "../../hooks/work/useWorks";
import { getWorks, getWorkApprovals } from "../../modules/data/eas";

describe("useWorks - Status Computation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should compute status as 'pending' when no approval exists", async () => {
    const mockWorks: EASWork[] = [
      {
        id: "0xwork1",
        gardenerAddress: "0xgardener",
        gardenAddress: "0xgarden",
        actionUID: 1,
        title: "Plant Trees",
        feedback: "",
        metadata: "",
        media: [],
        createdAt: Date.now(),
      },
    ];

    const mockApprovals: EASWorkApproval[] = [];

    (getWorks as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorks);
    (getWorkApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(mockApprovals);

    const { result } = renderHook(() => useWorks("0xgarden"), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(1);
    });

    expect(result.current.works[0]?.status).toBe("pending");
  });

  it("should compute status as 'approved' when approval exists with approved=true", async () => {
    const mockWorks: EASWork[] = [
      {
        id: "0xwork1",
        gardenerAddress: "0xgardener",
        gardenAddress: "0xgarden",
        actionUID: 1,
        title: "Plant Trees",
        feedback: "",
        metadata: "",
        media: [],
        createdAt: Date.now(),
      },
    ];

    const mockApprovals: EASWorkApproval[] = [
      {
        id: "0xapproval1",
        operatorAddress: "0xoperator",
        gardenerAddress: "0xgardener",
        actionUID: 1,
        workUID: "0xwork1",
        approved: true,
        feedback: "Great work!",
        createdAt: Date.now(),
      },
    ];

    (getWorks as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorks);
    (getWorkApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(mockApprovals);

    const { result } = renderHook(() => useWorks("0xgarden"), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(1);
    });

    expect(result.current.works[0]?.status).toBe("approved");
  });

  it("should compute status as 'rejected' when approval exists with approved=false", async () => {
    const mockWorks: EASWork[] = [
      {
        id: "0xwork1",
        gardenerAddress: "0xgardener",
        gardenAddress: "0xgarden",
        actionUID: 1,
        title: "Plant Trees",
        feedback: "",
        metadata: "",
        media: [],
        createdAt: Date.now(),
      },
    ];

    const mockApprovals: EASWorkApproval[] = [
      {
        id: "0xapproval1",
        operatorAddress: "0xoperator",
        gardenerAddress: "0xgardener",
        actionUID: 1,
        workUID: "0xwork1",
        approved: false,
        feedback: "Please add more photos",
        createdAt: Date.now(),
      },
    ];

    (getWorks as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorks);
    (getWorkApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(mockApprovals);

    const { result } = renderHook(() => useWorks("0xgarden"), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(1);
    });

    expect(result.current.works[0]?.status).toBe("rejected");
  });

  it("should correctly compute status for multiple works with mixed approvals", async () => {
    const mockWorks: EASWork[] = [
      {
        id: "0xwork1",
        gardenerAddress: "0xgardener1",
        gardenAddress: "0xgarden",
        actionUID: 1,
        title: "Plant Trees",
        feedback: "",
        metadata: "",
        media: [],
        createdAt: Date.now(),
      },
      {
        id: "0xwork2",
        gardenerAddress: "0xgardener2",
        gardenAddress: "0xgarden",
        actionUID: 2,
        title: "Clean Park",
        feedback: "",
        metadata: "",
        media: [],
        createdAt: Date.now() - 1000,
      },
      {
        id: "0xwork3",
        gardenerAddress: "0xgardener3",
        gardenAddress: "0xgarden",
        actionUID: 3,
        title: "Water Plants",
        feedback: "",
        metadata: "",
        media: [],
        createdAt: Date.now() - 2000,
      },
    ];

    const mockApprovals: EASWorkApproval[] = [
      {
        id: "0xapproval1",
        operatorAddress: "0xoperator",
        gardenerAddress: "0xgardener1",
        actionUID: 1,
        workUID: "0xwork1",
        approved: true,
        feedback: "Excellent!",
        createdAt: Date.now(),
      },
      {
        id: "0xapproval2",
        operatorAddress: "0xoperator",
        gardenerAddress: "0xgardener2",
        actionUID: 2,
        workUID: "0xwork2",
        approved: false,
        feedback: "Needs improvement",
        createdAt: Date.now(),
      },
      // No approval for work3 - should remain pending
    ];

    (getWorks as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorks);
    (getWorkApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(mockApprovals);

    const { result } = renderHook(() => useWorks("0xgarden"), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(3);
    });

    const workStatuses = result.current.works.reduce(
      (acc, work) => {
        acc[work.id] = work.status;
        return acc;
      },
      {} as Record<string, string>
    );

    expect(workStatuses["0xwork1"]).toBe("approved");
    expect(workStatuses["0xwork2"]).toBe("rejected");
    expect(workStatuses["0xwork3"]).toBe("pending");
  });
});
