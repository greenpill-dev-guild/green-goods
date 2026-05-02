/**
 * useAdminAccessState Hook Tests
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseEligibleAdminGardens = vi.fn();
vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => mockUseEligibleAdminGardens(),
}));

import { useAdminAccessState } from "../../../hooks/admin-ui/useAdminAccessState";

const SIGN_OUT = vi.fn();

const baseAuth = {
  isAuthenticated: true,
  eoaAddress: "0x1111111111111111111111111111111111111111",
  isReady: true,
  authMode: "wallet" as const,
  signOut: SIGN_OUT,
};

const baseEligibleGardens = {
  eligibleGardens: [],
  resolvedDefaultGarden: null,
  persistedGardenId: null,
  scopeKey: "11155111:0x1111111111111111111111111111111111111111",
  canCreateGarden: false,
  isLoaded: true,
  isError: false,
  hasStaleBaseList: false,
};

describe("useAdminAccessState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(baseAuth);
    mockUseEligibleAdminGardens.mockReturnValue(baseEligibleGardens);
  });

  it("classifies checking while auth is unresolved", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isReady: false });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current.status).toBe("checking");
  });

  it("classifies checking while eligible gardens are unresolved for an authenticated wallet", () => {
    mockUseEligibleAdminGardens.mockReturnValue({ ...baseEligibleGardens, isLoaded: false });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current.status).toBe("checking");
  });

  it("classifies embedded-wallet before disconnected", () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      authMode: "embedded",
      eoaAddress: null,
    });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current.status).toBe("embedded-wallet");
    if (result.current.status === "embedded-wallet") {
      expect(result.current.signOut).toBe(SIGN_OUT);
    }
  });

  it("classifies disconnected when there is no authenticated wallet address", () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: false,
      eoaAddress: null,
      authMode: null,
    });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current.status).toBe("disconnected");
  });

  it("classifies indexer-error when the base garden list failed and no fallback garden exists", () => {
    mockUseEligibleAdminGardens.mockReturnValue({ ...baseEligibleGardens, isError: true });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current.status).toBe("indexer-error");
  });

  it("classifies no-access when authenticated but no eligible garden exists", () => {
    mockUseEligibleAdminGardens.mockReturnValue({
      ...baseEligibleGardens,
      canCreateGarden: true,
    });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current).toEqual({ status: "no-access", canCreateGarden: true });
  });

  it("keeps role-confirmed stale-base-list fallback gardens ready", () => {
    const fallbackGarden = {
      id: "0x2222222222222222222222222222222222222222",
      name: "Recovered Garden",
    };
    mockUseEligibleAdminGardens.mockReturnValue({
      ...baseEligibleGardens,
      eligibleGardens: [fallbackGarden],
      resolvedDefaultGarden: fallbackGarden,
      isError: true,
      hasStaleBaseList: true,
    });

    const { result } = renderHook(() => useAdminAccessState());

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.eligibleGardens).toEqual([fallbackGarden]);
      expect(result.current.hasStaleBaseList).toBe(true);
    }
  });
});
