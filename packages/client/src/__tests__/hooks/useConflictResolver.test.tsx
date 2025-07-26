import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConflictResolver } from "@/hooks/useConflictResolver";
import type { ConflictType, WorkConflict } from "@/modules/conflict-resolver";

// Mock the conflict resolver module
vi.mock("@/modules/conflict-resolver", () => ({
  defaultConflictResolver: {
    detectConflicts: vi.fn(),
    resolveConflict: vi.fn(),
    getConflicts: vi.fn(),
    getConflictById: vi.fn(),
    clearConflict: vi.fn(),
    clearAllConflicts: vi.fn(),
    getConflictStats: vi.fn(),
  },
}));

// Import the mocked module
import { defaultConflictResolver } from "@/modules/conflict-resolver";

const mockConflictResolver = vi.mocked(defaultConflictResolver);

// Test data factories
const createMockConflictType = (overrides: Partial<ConflictType> = {}): ConflictType => ({
  type: "already_submitted",
  severity: "medium",
  autoResolvable: true,
  ...overrides,
});

const createMockWorkConflict = (overrides: Partial<WorkConflict> = {}): WorkConflict => ({
  workId: `work-${Date.now()}-${Math.random()}`,
  conflicts: [createMockConflictType()],
  localData: {
    id: "work-123",
    title: "Test Work",
    gardenId: "garden-123",
    contentHash: "hash123",
  },
  remoteData: {
    id: "work-123",
    title: "Test Work (Remote)",
    gardenId: "garden-123",
    status: "approved",
  },
  ...overrides,
});

const createMockWorkItem = (overrides = {}) => ({
  id: `work-${Date.now()}`,
  title: "Test Work",
  gardenId: "garden-123",
  contentHash: "hash123",
  schemaId: "schema-123",
  schemaVersion: "1.0",
  userId: "user-123",
  ...overrides,
});

describe("useConflictResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to empty state
    mockConflictResolver.getConflicts.mockReturnValue([]);
  });

  describe("Initial State", () => {
    it("should initialize with empty conflicts and default state", () => {
      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isResolving).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.detectConflicts).toBe("function");
      expect(typeof result.current.resolveConflict).toBe("function");
      expect(typeof result.current.clearConflict).toBe("function");
      expect(typeof result.current.clearAllConflicts).toBe("function");
      expect(typeof result.current.refreshConflicts).toBe("function");
      expect(typeof result.current.getConflictById).toBe("function");
    });

    it("should load initial conflicts on mount", () => {
      const mockConflicts = [
        createMockWorkConflict({ workId: "work-1" }),
        createMockWorkConflict({ workId: "work-2" }),
      ];
      mockConflictResolver.getConflicts.mockReturnValue(mockConflicts);

      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toEqual(mockConflicts);
      expect(mockConflictResolver.getConflicts).toHaveBeenCalled();
    });
  });

  describe("Conflict Detection", () => {
    it("should detect conflicts successfully", async () => {
      const workItems = [
        createMockWorkItem({ id: "work-1" }),
        createMockWorkItem({ id: "work-2" }),
      ];
      const mockDetectedConflicts = [
        createMockWorkConflict({ workId: "work-1" }),
        createMockWorkConflict({ workId: "work-2" }),
      ];

      mockConflictResolver.detectConflicts.mockResolvedValue(mockDetectedConflicts);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const conflicts = await result.current.detectConflicts(workItems);
        expect(conflicts).toEqual(mockDetectedConflicts);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.conflicts).toEqual(mockDetectedConflicts);
      expect(mockConflictResolver.detectConflicts).toHaveBeenCalledWith(workItems);
    });

    it("should handle detection errors gracefully", async () => {
      const workItems = [createMockWorkItem()];
      const errorMessage = "Network error during conflict detection";
      mockConflictResolver.detectConflicts.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const conflicts = await result.current.detectConflicts(workItems);
        expect(conflicts).toEqual([]);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.conflicts).toEqual([]);
    });

    it("should set loading state during detection", async () => {
      const workItems = [createMockWorkItem()];
      let resolveDetection: (value: WorkConflict[]) => void;
      const detectionPromise = new Promise<WorkConflict[]>((resolve) => {
        resolveDetection = resolve;
      });

      mockConflictResolver.detectConflicts.mockReturnValue(detectionPromise);

      const { result } = renderHook(() => useConflictResolver());

      act(() => {
        result.current.detectConflicts(workItems);
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      await act(async () => {
        resolveDetection([]);
        await detectionPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should clear previous errors when starting new detection", async () => {
      const workItems = [createMockWorkItem()];

      // First, set an error state
      mockConflictResolver.detectConflicts.mockRejectedValueOnce(new Error("Previous error"));

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        await result.current.detectConflicts(workItems);
      });

      expect(result.current.error).toBe("Previous error");

      // Now start a new successful detection
      mockConflictResolver.detectConflicts.mockResolvedValue([]);

      await act(async () => {
        await result.current.detectConflicts(workItems);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve conflict with merge strategy", async () => {
      const workId = "work-123";
      const resolutionData = { title: "Merged Title" };
      const mockResolvedData = { ...resolutionData, id: workId };

      mockConflictResolver.resolveConflict.mockResolvedValue(mockResolvedData);
      mockConflictResolver.getConflicts.mockReturnValue([]);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const resolved = await result.current.resolveConflict(workId, "merge", resolutionData);
        expect(resolved).toEqual(mockResolvedData);
      });

      expect(result.current.isResolving).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockConflictResolver.resolveConflict).toHaveBeenCalledWith(
        workId,
        "merge",
        resolutionData
      );
    });

    it("should resolve conflict with keep_local strategy", async () => {
      const workId = "work-123";
      const localData = { id: workId, title: "Local Title" };

      mockConflictResolver.resolveConflict.mockResolvedValue(localData);
      mockConflictResolver.getConflicts.mockReturnValue([]);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const resolved = await result.current.resolveConflict(workId, "keep_local");
        expect(resolved).toEqual(localData);
      });

      expect(mockConflictResolver.resolveConflict).toHaveBeenCalledWith(
        workId,
        "keep_local",
        undefined
      );
    });

    it("should resolve conflict with keep_remote strategy", async () => {
      const workId = "work-123";
      const remoteData = { id: workId, title: "Remote Title", status: "approved" };

      mockConflictResolver.resolveConflict.mockResolvedValue(remoteData);
      mockConflictResolver.getConflicts.mockReturnValue([]);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const resolved = await result.current.resolveConflict(workId, "keep_remote");
        expect(resolved).toEqual(remoteData);
      });

      expect(mockConflictResolver.resolveConflict).toHaveBeenCalledWith(
        workId,
        "keep_remote",
        undefined
      );
    });

    it("should resolve conflict with manual strategy", async () => {
      const workId = "work-123";
      const manualData = { id: workId, title: "Manually Resolved Title", customField: "value" };

      mockConflictResolver.resolveConflict.mockResolvedValue(manualData);
      mockConflictResolver.getConflicts.mockReturnValue([]);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const resolved = await result.current.resolveConflict(workId, "manual", manualData);
        expect(resolved).toEqual(manualData);
      });

      expect(mockConflictResolver.resolveConflict).toHaveBeenCalledWith(
        workId,
        "manual",
        manualData
      );
    });

    it("should handle resolution errors", async () => {
      const workId = "work-123";
      const errorMessage = "Resolution failed: No conflict found";
      mockConflictResolver.resolveConflict.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        try {
          await result.current.resolveConflict(workId, "merge");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe(errorMessage);
        }
      });

      expect(result.current.isResolving).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it("should set resolving state during resolution", async () => {
      const workId = "work-123";
      let resolveResolution: (value: any) => void;
      const resolutionPromise = new Promise((resolve) => {
        resolveResolution = resolve;
      });

      mockConflictResolver.resolveConflict.mockReturnValue(resolutionPromise);

      const { result } = renderHook(() => useConflictResolver());

      act(() => {
        result.current.resolveConflict(workId, "merge");
      });

      expect(result.current.isResolving).toBe(true);
      expect(result.current.error).toBeNull();

      await act(async () => {
        resolveResolution({ resolved: true });
        await resolutionPromise;
      });

      expect(result.current.isResolving).toBe(false);
    });

    it("should refresh conflicts after successful resolution", async () => {
      const workId = "work-123";
      const resolvedData = { id: workId, resolved: true };
      const updatedConflicts = [createMockWorkConflict({ workId: "work-456" })];

      mockConflictResolver.resolveConflict.mockResolvedValue(resolvedData);
      mockConflictResolver.getConflicts
        .mockReturnValueOnce([]) // Initial empty state
        .mockReturnValueOnce(updatedConflicts); // After resolution

      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toEqual([]);

      await act(async () => {
        await result.current.resolveConflict(workId, "merge");
      });

      expect(result.current.conflicts).toEqual(updatedConflicts);
      expect(mockConflictResolver.getConflicts).toHaveBeenCalledTimes(2);
    });
  });

  describe("Conflict Management", () => {
    it("should clear specific conflict", () => {
      const workId = "work-123";
      const initialConflicts = [
        createMockWorkConflict({ workId: "work-123" }),
        createMockWorkConflict({ workId: "work-456" }),
      ];
      const remainingConflicts = [createMockWorkConflict({ workId: "work-456" })];

      mockConflictResolver.getConflicts
        .mockReturnValueOnce(initialConflicts)
        .mockReturnValueOnce(remainingConflicts);

      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toEqual(initialConflicts);

      act(() => {
        result.current.clearConflict(workId);
      });

      expect(mockConflictResolver.clearConflict).toHaveBeenCalledWith(workId);
      expect(result.current.conflicts).toEqual(remainingConflicts);
    });

    it("should clear all conflicts", () => {
      const initialConflicts = [
        createMockWorkConflict({ workId: "work-123" }),
        createMockWorkConflict({ workId: "work-456" }),
      ];

      mockConflictResolver.getConflicts
        .mockReturnValueOnce(initialConflicts)
        .mockReturnValueOnce([]);

      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toEqual(initialConflicts);

      act(() => {
        result.current.clearAllConflicts();
      });

      expect(mockConflictResolver.clearAllConflicts).toHaveBeenCalled();
      expect(result.current.conflicts).toEqual([]);
    });

    it("should get conflict by ID", () => {
      const workId = "work-123";
      const mockConflict = createMockWorkConflict({ workId });

      mockConflictResolver.getConflictById.mockReturnValue(mockConflict);

      const { result } = renderHook(() => useConflictResolver());

      const conflict = result.current.getConflictById(workId);

      expect(conflict).toEqual(mockConflict);
      expect(mockConflictResolver.getConflictById).toHaveBeenCalledWith(workId);
    });

    it("should return undefined for non-existent conflict ID", () => {
      const workId = "non-existent";

      mockConflictResolver.getConflictById.mockReturnValue(undefined);

      const { result } = renderHook(() => useConflictResolver());

      const conflict = result.current.getConflictById(workId);

      expect(conflict).toBeUndefined();
      expect(mockConflictResolver.getConflictById).toHaveBeenCalledWith(workId);
    });

    it("should refresh conflicts manually", () => {
      const newConflicts = [
        createMockWorkConflict({ workId: "work-789" }),
        createMockWorkConflict({ workId: "work-101" }),
      ];

      mockConflictResolver.getConflicts
        .mockReturnValueOnce([]) // Initial empty state
        .mockReturnValueOnce(newConflicts); // After refresh

      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toEqual([]);

      act(() => {
        result.current.refreshConflicts();
      });

      expect(result.current.conflicts).toEqual(newConflicts);
      expect(mockConflictResolver.getConflicts).toHaveBeenCalledTimes(2);
    });
  });

  describe("Complex Conflict Scenarios", () => {
    it("should handle multiple conflict types for single work item", async () => {
      const workItem = createMockWorkItem({ id: "work-complex" });
      const complexConflict = createMockWorkConflict({
        workId: "work-complex",
        conflicts: [
          createMockConflictType({
            type: "already_submitted",
            severity: "high",
            autoResolvable: true,
          }),
          createMockConflictType({
            type: "schema_mismatch",
            severity: "medium",
            autoResolvable: false,
          }),
          createMockConflictType({
            type: "garden_mismatch",
            severity: "high",
            autoResolvable: false,
          }),
        ],
      });

      mockConflictResolver.detectConflicts.mockResolvedValue([complexConflict]);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const conflicts = await result.current.detectConflicts([workItem]);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].conflicts).toHaveLength(3);
      });

      expect(result.current.conflicts[0].conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "already_submitted" }),
          expect.objectContaining({ type: "schema_mismatch" }),
          expect.objectContaining({ type: "garden_mismatch" }),
        ])
      );
    });

    it("should handle high-severity non-auto-resolvable conflicts", () => {
      const criticalConflict = createMockWorkConflict({
        workId: "work-critical",
        conflicts: [
          createMockConflictType({
            type: "data_conflict",
            severity: "high",
            autoResolvable: false,
          }),
        ],
      });

      mockConflictResolver.getConflicts.mockReturnValue([criticalConflict]);

      const { result } = renderHook(() => useConflictResolver());

      expect(result.current.conflicts).toHaveLength(1);
      expect(result.current.conflicts[0].conflicts[0]).toEqual(
        expect.objectContaining({
          type: "data_conflict",
          severity: "high",
          autoResolvable: false,
        })
      );
    });

    it("should handle mixed auto-resolvable and manual conflicts", async () => {
      const workItems = [
        createMockWorkItem({ id: "work-auto" }),
        createMockWorkItem({ id: "work-manual" }),
      ];

      const mixedConflicts = [
        createMockWorkConflict({
          workId: "work-auto",
          conflicts: [createMockConflictType({ autoResolvable: true })],
        }),
        createMockWorkConflict({
          workId: "work-manual",
          conflicts: [createMockConflictType({ autoResolvable: false })],
        }),
      ];

      mockConflictResolver.detectConflicts.mockResolvedValue(mixedConflicts);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const conflicts = await result.current.detectConflicts(workItems);
        expect(conflicts).toHaveLength(2);
      });

      const autoResolvableConflicts = result.current.conflicts.filter((conflict: WorkConflict) =>
        conflict.conflicts.some((c: ConflictType) => c.autoResolvable)
      );
      const manualConflicts = result.current.conflicts.filter((conflict: WorkConflict) =>
        conflict.conflicts.every((c: ConflictType) => !c.autoResolvable)
      );

      expect(autoResolvableConflicts).toHaveLength(1);
      expect(manualConflicts).toHaveLength(1);
    });
  });

  describe("Error Handling Edge Cases", () => {
    it("should handle malformed conflict data gracefully", () => {
      const malformedConflict = {
        workId: "work-malformed",
        conflicts: null, // Invalid data
        localData: undefined,
      } as any;

      mockConflictResolver.getConflicts.mockReturnValue([malformedConflict]);

      const { result } = renderHook(() => useConflictResolver());

      // Should not crash and should handle the malformed data
      expect(result.current.conflicts).toEqual([malformedConflict]);
      expect(result.current.error).toBeNull();
    });

    it("should handle API timeout errors during detection", async () => {
      const workItems = [createMockWorkItem()];
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "TimeoutError";

      mockConflictResolver.detectConflicts.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        const conflicts = await result.current.detectConflicts(workItems);
        expect(conflicts).toEqual([]);
      });

      expect(result.current.error).toBe("Request timeout");
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle network disconnection during resolution", async () => {
      const workId = "work-123";
      const networkError = new Error("Network error");
      networkError.name = "NetworkError";

      mockConflictResolver.resolveConflict.mockRejectedValue(networkError);

      const { result } = renderHook(() => useConflictResolver());

      await act(async () => {
        try {
          await result.current.resolveConflict(workId, "merge");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.isResolving).toBe(false);
    });
  });
});
