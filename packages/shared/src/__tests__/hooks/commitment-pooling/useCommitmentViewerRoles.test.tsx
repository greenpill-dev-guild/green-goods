/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentViewerRoles } from "../../../hooks/commitment-pooling/useCommitmentViewerRoles";
import type { Address } from "../../../types/domain";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const HOST = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa" as Address;
const OTHER = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb" as Address;
const PENDING_JOINS_KEY = "greengoods:pending-joins";

type RosterGarden = {
  id: string;
  name: string;
  gardeners: string[];
  stewards: string[];
  funders?: string[];
  communities?: string[];
};

const mocks = vi.hoisted(() => ({
  gardens: [] as RosterGarden[],
  gardensLoading: false,
  gardensError: false,
  refetchGardens: vi.fn(),
  membership: { isMember: false as boolean | null, isLoading: false, isError: false },
  /** One garden's chain read, where it differs from `membership`. */
  membershipByGarden: new Map<
    string,
    { isMember: boolean | null; isLoading: boolean; isError: boolean }
  >(),
  /** Gardens the reader stewards, by lowercased id. */
  managed: new Set<string>(),
  /** The host's own record, read when the garden list does not hold it. */
  hostRecord: null as RosterGarden | null,
  refetchMembership: vi.fn(),
}));

vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: () => ({ hasRole: false, isLoading: false }),
}));

vi.mock("../../../hooks/roles/useGardenMembership", () => ({
  useGardenMembership: (garden?: string) => ({
    ...((garden && mocks.membershipByGarden.get(garden.toLowerCase())) || mocks.membership),
    refetch: mocks.refetchMembership,
  }),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({
    data: mocks.gardensLoading || mocks.gardensError ? undefined : mocks.gardens,
    isLoading: mocks.gardensLoading,
    isSuccess: !mocks.gardensLoading && !mocks.gardensError,
    isError: mocks.gardensError,
    refetch: mocks.refetchGardens,
  }),
}));

vi.mock("../../../hooks/garden/useGardenRecord", () => ({
  useGardenRecord: (_garden: string | null, { enabled = true }: { enabled?: boolean } = {}) => ({
    data: enabled ? mocks.hostRecord : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({
    canManageGarden: (garden: { id: string }) => mocks.managed.has(garden.id.toLowerCase()),
  }),
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
    mocks.gardensLoading = false;
    mocks.gardensError = false;
    mocks.refetchGardens = vi.fn();
    mocks.refetchMembership = vi.fn();
    mocks.membership = { isMember: false, isLoading: false, isError: false };
    mocks.membershipByGarden = new Map();
    mocks.managed = new Set();
    mocks.hostRecord = null;
    mocks.gardens = [
      { id: HOST, name: "Host Garden", gardeners: [], stewards: [] },
      { id: OTHER, name: "Other Garden", gardeners: [], stewards: [] },
    ];
  });

  it("counts a member by the chain's role read when the indexer roster is behind", () => {
    mocks.membership = { isMember: true, isLoading: false, isError: false };
    expect(roles().result.current.isMemberHere).toBe(true);
  });

  it("counts a join the moment it lands, through the pending-join overlay", () => {
    expect(roles().result.current.isMemberHere).toBe(false);
    window.localStorage.setItem(
      PENDING_JOINS_KEY,
      JSON.stringify({ [HOST]: { address: VIEWER, timestamp: Date.now() } })
    );
    expect(roles().result.current.isMemberHere).toBe(true);
    // The overlay also opens a garden as a claim context on the protocol pool.
    window.localStorage.setItem(
      PENDING_JOINS_KEY,
      JSON.stringify({ [OTHER]: { address: VIEWER, timestamp: Date.now() } })
    );
    expect(roles(HOST, HOST).result.current.claimGardens.member).toEqual([
      { address: OTHER, name: "Other Garden" },
    ]);
  });

  it("counts every role the contract accepts, funders and community members included", () => {
    // The roster is the fallback while the chain has not answered.
    mocks.membership = { isMember: null, isLoading: false, isError: false };
    mocks.gardens = [
      { id: HOST, name: "Host Garden", gardeners: [], stewards: [], funders: [VIEWER] },
      { id: OTHER, name: "Other Garden", gardeners: [], stewards: [], communities: [VIEWER] },
    ];
    const { result } = roles();
    expect(result.current.isMemberHere).toBe(true);
    expect(result.current.claimGardens.member).toEqual([
      { address: HOST, name: "Host Garden" },
      { address: OTHER, name: "Other Garden" },
    ]);
  });

  it("offers the host for a personal claim on its own chain read, and never for a garden claim", () => {
    // The reader's only role is in the host, and they steward it.
    mocks.membership = { isMember: true, isLoading: false, isError: false };
    mocks.managed = new Set([HOST.toLowerCase()]);
    const { result } = roles();
    expect(result.current.claimGardens.member).toEqual([{ address: HOST, name: "Host Garden" }]);
    // The contract refuses the host as a garden claim's context.
    expect(result.current.claimGardens.stewarded).toEqual([]);
    expect(result.current.claimGardensKnown).toBe(true);
  });

  it("asks the host itself when the commitment opens through another garden's route", () => {
    const answer = (isMember: boolean | null, isLoading = false) => ({
      isMember,
      isLoading,
      isError: false,
    });
    mocks.membershipByGarden = new Map([
      [HOST.toLowerCase(), answer(true)],
      [OTHER.toLowerCase(), answer(false)],
    ]);
    expect(roles(OTHER, HOST).result.current.claimGardens.member).toEqual([
      { address: HOST, name: "Host Garden" },
    ]);

    // A chain denial for the host outranks a stale roster naming the reader there.
    mocks.gardens = [
      { id: HOST, name: "Host Garden", gardeners: [VIEWER], stewards: [] },
      { id: OTHER, name: "Other Garden", gardeners: [], stewards: [] },
    ];
    mocks.membershipByGarden.set(HOST.toLowerCase(), answer(false));
    expect(roles(OTHER, HOST).result.current.claimGardens.member).toEqual([]);

    // Until the host's own read answers, an empty list does not yet mean none.
    mocks.gardens = [
      { id: HOST, name: "Host Garden", gardeners: [], stewards: [] },
      { id: OTHER, name: "Other Garden", gardeners: [], stewards: [] },
    ];
    mocks.membershipByGarden.set(HOST.toLowerCase(), answer(null, true));
    expect(roles(OTHER, HOST).result.current.claimGardensKnown).toBe(false);
  });

  it("trusts a completed chain denial over a stale roster, and a fresh join over both", () => {
    // The indexer can still list a role the chain has just revoked; the queue
    // and the contract test the chain, so its "no" wins.
    mocks.gardens = [{ id: HOST, name: "Host Garden", gardeners: [VIEWER], stewards: [] }];
    mocks.membership = { isMember: false, isLoading: false, isError: false };
    expect(roles().result.current.isMemberHere).toBe(false);
    // A join this device just made landed after that read, so it still counts.
    window.localStorage.setItem(
      PENDING_JOINS_KEY,
      JSON.stringify({ [HOST]: { address: VIEWER, timestamp: Date.now() } })
    );
    expect(roles().result.current.isMemberHere).toBe(true);
  });

  it("answers null while the chain read is on its way, and false once it has answered", () => {
    mocks.membership = { isMember: null, isLoading: true, isError: false };
    expect(roles().result.current.isMemberHere).toBeNull();
    mocks.membership = { isMember: false, isLoading: false, isError: false };
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

  it("reads the host on its own when it sits past the newest gardens the list holds", () => {
    // The list holds only the newest gardens, and the protocol's own may sit past it.
    mocks.gardens = [{ id: OTHER, name: "Other Garden", gardeners: [], stewards: [] }];
    mocks.hostRecord = { id: HOST, name: "Host Garden", gardeners: [], stewards: [] };
    mocks.membershipByGarden = new Map([
      [HOST.toLowerCase(), { isMember: true, isLoading: false, isError: false }],
      [OTHER.toLowerCase(), { isMember: false, isLoading: false, isError: false }],
    ]);

    const { result } = roles(OTHER, HOST);
    expect(result.current.claimGardens.member).toEqual([{ address: HOST, name: "Host Garden" }]);
    expect(result.current.claimGardensKnown).toBe(true);
  });

  it("keeps membership unknown when the garden list fails, and reads them all again on retry", () => {
    // A failed query stops loading and returns no list; that is not "a member of none".
    mocks.gardensError = true;
    const { result } = roles();
    expect(result.current.isMemberHere).toBeNull();
    expect(result.current.claimGardensKnown).toBe(false);
    expect(result.current.membershipUnavailable).toBe(true);
    result.current.retryMembership();
    expect(mocks.refetchGardens).toHaveBeenCalledTimes(1);
    // The route's chain read and the host's.
    expect(mocks.refetchMembership).toHaveBeenCalledTimes(2);
  });

  it("keeps membership unknown when the chain's role read fails and the roster says no", () => {
    // The hierarchical useHasRole would have answered no; a failed read is not no.
    mocks.membership = { isMember: null, isLoading: false, isError: true };
    const { result } = roles();
    expect(result.current.isMemberHere).toBeNull();
    expect(result.current.membershipUnavailable).toBe(true);
    // The roster's yes still counts when the chain cannot answer.
    mocks.gardens = [{ id: HOST, name: "Host Garden", gardeners: [VIEWER], stewards: [] }];
    const again = roles();
    expect(again.result.current.isMemberHere).toBe(true);
    expect(again.result.current.membershipUnavailable).toBe(false);
  });
});
