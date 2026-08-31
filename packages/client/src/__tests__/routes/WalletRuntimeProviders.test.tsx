/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuthState = vi.fn();

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => mockUseAuthState(),
}));

import { PwaStartupReadySignal } from "../../routes/WalletRuntimeProviders";

describe("PwaStartupReadySignal", () => {
  const clearBootFallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void }).__GG_CLEAR_BOOT_FALLBACK =
      clearBootFallback;
  });

  afterEach(() => {
    delete (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void }).__GG_CLEAR_BOOT_FALLBACK;
  });

  it("clears the static surface only after authentication is ready", () => {
    mockUseAuthState.mockReturnValue({ isReady: false });
    const view = render(<PwaStartupReadySignal />);

    expect(clearBootFallback).not.toHaveBeenCalled();

    mockUseAuthState.mockReturnValue({ isReady: true });
    view.rerender(<PwaStartupReadySignal />);

    expect(clearBootFallback).toHaveBeenCalledTimes(1);
  });
});
