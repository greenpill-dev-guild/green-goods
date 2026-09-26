/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentViewerRoles } from "../../../hooks/commitment-pooling/useCommitmentViewerRoles";
import type { Address } from "../../../types/domain";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const HOST = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa" as Address;
const OTHER = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb" as Address;
const PENDING_JOINS_KEY = "greengoods:pending-joins";

const mocks = vi.hoisted(() => ({
  roleAnswers: new Map<string, boolean>(),
  loadingRoles: new Set<string>(),
  gardens: [] as Array<{ id: string; name: string; gardeners: string[]; stewards: string[] }>,
  gardensLoading: false,
  gardensError: false,
  refetch: vi.fn(),
}));

vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (garden: string | undefined, _viewer: string | undefined, role: string) => {
    const key = garden ? `${garden.toLowerCase()}:${role}` : "";
    return {
      hasRole: key ? (mocks.roleAnswers.get(key) ?? false) : false,
      isLoading: key ? mocks.loadingRoles.has(key) : false,
    };
  },
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({
    data: mocks.gardensLoading || mocks.gardensError ? undefined : mocks.gardens,
    isLoading: mocks.gardensLoading,
    isSuccess: !mocks.gardensLoading && !mocks.gardensError,
    isError: mocks.gardensError,
    refetch: mocks.refetch,
  }),
}));

vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({ canManageGarden: () => false }),
}));

function roles(routeGarden: string = HOST, poolGarden: string = HOST) {
  return renderHook(() =>
    useCommitmentViewerRoles({
      chainId: 42161,
      viewer: VIEWER,
      routeGarden,
      commitment: { direction: "OFFER", counterpartyKind: "INDIVIDUAL", counterparty: null },
      pool: { garden: poolGarden },
    })
  );
}

describe("useCommitmentViewerRoles", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.roleAnswers = new Map();
    mocks.loadingRoles = new Set();
    mocks.gardensLoading = false;
    mocks.gardensError = false;
    mocks.refetch = vi.fn();
    mocks.gardens = [
      { id: HOST, name: "Host Garden", gardeners: [], stewards: [] },
      { id: OTHER, name: "Other Garden", gardeners: [], stewards: [] },
    ];
  });

  it("counts a member by the chain's gardener role when the indexer roster is behind", () => {
    mocks.roleAnswers.set(`${HOST.toLowerCase()}:gardener`, true);
    expect(roles().result.current.isMemberHere).toBe(true);
  });

  it("counts a join the moment it lands, through the pending-join overlay", () => {
    expect(roles().result.current.isMemberHere).toBe(false);
    window.localStorage.setItem(
      PENDING_JOINS_KEY,
      JSON.stringify({ [HOST]: { address: VIEWER, timestamp: Date.now() } })
    );
    const { result } = roles();
    expect(result.current.isMemberHere).toBe(true);
    // The overlay also opens a garden as a claim context on the protocol pool.
    window.localStorage.setItem(
      PENDING_JOINS_KEY,
      JSON.stringify({ [OTHER]: { address: VIEWER, timestamp: Date.now() } })
    );
    expect(roles(HOST, HOST).result.current.claimGardens.member).toEqual([
      { address: OTHER, name: "Other Garden" },
    ]);
  });

  it("answers null while the gardener read is on its way, and false once it has answered", () => {
    mocks.loadingRoles.add(`${HOST.toLowerCase()}:gardener`);
    expect(roles().result.current.isMemberHere).toBeNull();
    mocks.loadingRoles.clear();
    expect(roles().result.current.isMemberHere).toBe(false);
  });

  it("stays unknown until the garden list is in, even when the chain read says no", () => {
    // A member known only through the roster or the join overlay must not see
    // the join card while the list is still loading.
    mocks.gardensLoading = true;
    const { result } = roles();
    expect(result.current.isMemberHere).toBeNull();
    expect(result.current.claimGardensKnown).toBe(false);
    expect(result.current.claimGardens.member).toEqual([]);
  });

  it("keeps membership unknown when the garden list fails, and offers the read again", () => {
    // A failed query stops loading and returns no list; that is not "a member of none".
    mocks.gardensError = true;
    const { result } = roles();
    expect(result.current.isMemberHere).toBeNull();
    expect(result.current.claimGardensKnown).toBe(false);
    expect(result.current.gardensUnavailable).toBe(true);
    result.current.retryGardens();
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    // The chain's answer still counts when it is yes.
    mocks.roleAnswers.set(`${HOST.toLowerCase()}:gardener`, true);
    expect(roles().result.current.isMemberHere).toBe(true);
  });
});
