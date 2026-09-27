/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGardenMembership } from "../../../hooks/roles/useGardenMembership";
import { renderHookWithProviders } from "../../test-utils";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("../../../utils/blockchain/garden-role-reads", () => ({
  readGardenMembership: (...args: unknown[]) => mocks.read(...args),
}));

const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const USER = "0x2222222222222222222222222222222222222222" as const;

describe("useGardenMembership", () => {
  beforeEach(() => {
    mocks.read.mockReset();
  });

  it("answers from the chain's six-role read", async () => {
    mocks.read.mockResolvedValue(true);
    const { result } = renderHookWithProviders(() => useGardenMembership(GARDEN, USER, 42161));
    await waitFor(() => expect(result.current.isMember).toBe(true));
    expect(mocks.read).toHaveBeenCalledWith(GARDEN, USER, 42161);
  });

  it("keeps a failed read unknown, not no, and offers it again", async () => {
    mocks.read.mockResolvedValue(null);
    const { result } = renderHookWithProviders(() => useGardenMembership(GARDEN, USER, 42161));
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.isMember).toBeNull();

    mocks.read.mockResolvedValue(true);
    result.current.refetch();
    await waitFor(() => expect(result.current.isMember).toBe(true));
  });

  it("does not read without a garden and an account", () => {
    const { result } = renderHookWithProviders(() => useGardenMembership(undefined, USER, 42161));
    expect(result.current).toMatchObject({ isMember: null, isLoading: false, isError: false });
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
