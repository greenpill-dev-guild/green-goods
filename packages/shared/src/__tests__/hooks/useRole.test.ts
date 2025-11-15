import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock the user provider first
const mockUseUser = vi.fn();
vi.mock("@/providers/user", () => ({
  useUser: () => mockUseUser(),
}));

// Mock URQL
const mockUseQuery = vi.fn();
vi.mock("urql", () => ({
  useQuery: () => mockUseQuery(),
}));

// Import after mocks
const { useRole } = await import("@/hooks/useRole");
const { createMockPrivyUser } = await import("../mocks/privy");

describe("useRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return admin role for admin address", () => {
    const adminUser = createMockPrivyUser("admin");
    mockUseUser.mockReturnValue(adminUser);
    mockUseQuery.mockReturnValue([
      {
        data: { gardens: [] },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOperator).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("should return operator role for operator with gardens", () => {
    const operatorUser = createMockPrivyUser("operator");
    mockUseUser.mockReturnValue(operatorUser);
    mockUseQuery.mockReturnValue([
      {
        data: {
          gardens: [
            { id: "0x123", name: "Test Garden" },
            { id: "0x456", name: "Another Garden" },
          ],
        },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("operator");
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isOperator).toBe(true);
    expect(result.current.operatorGardens).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it("should return unauthorized role for unknown address", () => {
    const unauthorizedUser = createMockPrivyUser("unauthorized");
    mockUseUser.mockReturnValue(unauthorizedUser);
    mockUseQuery.mockReturnValue([
      {
        data: { gardens: [] },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("unauthorized");
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isOperator).toBe(false);
    expect(result.current.operatorGardens).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it("should show loading state when user is not ready", () => {
    mockUseUser.mockReturnValue({
      ready: false,
      address: null,
    });
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: true,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should show loading state when query is fetching", () => {
    const adminUser = createMockPrivyUser("admin");
    mockUseUser.mockReturnValue(adminUser);
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: true,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should pause query when no address is available", () => {
    mockUseUser.mockReturnValue({
      ready: true,
      address: null,
    });

    renderHook(() => useRole());

    expect(mockUseQuery).toHaveBeenCalledWith({
      query: expect.any(Object),
      variables: { operator: "" },
      pause: true,
    });
  });

  it("should admin take precedence over operator role", () => {
    // Admin address that also has operator gardens
    const adminUser = createMockPrivyUser("admin");
    mockUseUser.mockReturnValue(adminUser);
    mockUseQuery.mockReturnValue([
      {
        data: {
          gardens: [{ id: "0x123", name: "Test Garden" }],
        },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOperator).toBe(true); // Can still be operator
    expect(result.current.operatorGardens).toHaveLength(1);
  });
});
