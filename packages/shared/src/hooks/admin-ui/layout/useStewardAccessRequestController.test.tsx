import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockGarden } from "../../../__tests__/test-utils/mock-factories";
import { getTestQueryClient } from "../../../__tests__/test-utils/query-client";
import type { GardenJoinRequestSelfRecord } from "../../../public-contracts/join-requests";
import {
  parseStewardGardenTarget,
  useStewardAccessRequestController,
} from "./useStewardAccessRequestController";

const account = vi.hoisted(() => ({
  address: "0x2222222222222222222222222222222222222222",
  mode: "passkey",
}));
const submitRequest = vi.hoisted(() => vi.fn(async () => null));
const checkStatus = vi.hoisted(() => vi.fn(async () => null));
const requestState = vi.hoisted(() => ({ request: null as GardenJoinRequestSelfRecord | null }));
const gardens = [
  createMockGarden({
    id: "0x1111111111111111111111111111111111111111",
    name: "Comunidad Verde",
    chainId: 11155111,
  }),
  createMockGarden({
    id: "0xF7b892886998DAe960D64a9db488336684F137A0",
    name: "Aiyeloja Family Garden",
    chainId: 11155111,
  }),
  createMockGarden({
    id: "0x3F22568aE0deAA24dA7b8c669AfDcBD72A6A7fd8",
    name: "Live Garden Coop",
    chainId: 11155111,
  }),
  createMockGarden({
    id: "0x4444444444444444444444444444444444444444",
    name: "Other Network",
    chainId: 10,
  }),
];
vi.mock("../../auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => account.address }));
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ authMode: account.mode }) }));
vi.mock("../../blockchain/useChainConfig", () => ({ useCurrentChain: () => 11155111 }));
vi.mock("../../blockchain/useEnsName", () => ({ useEnsName: () => ({ data: "maya.eth" }) }));
vi.mock("../../blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: gardens, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../garden/useGardenJoinRequests", () => ({
  useGardenJoinRequestAvailabilityState: () => ({ available: true, isLoading: false, error: null }),
  useGardenJoinRequests: (garden?: string) => ({
    request: requestState.request,
    hasCheckedStatus: false,
    outcomeUnknown: false,
    canRefreshStatus: false,
    scopeKey: `${account.address}:${garden}`,
    statusState: { isLoading: false, error: null },
    mutationState: { isLoading: false, error: null },
    submitRequest,
    checkStatus,
    withdrawRequest: vi.fn(),
  }),
}));

describe("steward access request presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.address = "0x2222222222222222222222222222222222222222";
    requestState.request = null;
  });
  it.each([
    [
      "https://admin.greengoods.app/garden?gardenId=0x1111111111111111111111111111111111111111",
      "0x1111111111111111111111111111111111111111",
    ],
    [
      "https://greengoods.app/garden/0x1111111111111111111111111111111111111111",
      "0x1111111111111111111111111111111111111111",
    ],
    ["https://greengoods.app/sites/comunidad-verde", "0x1111111111111111111111111111111111111111"],
    ["https://example.com/garden/0x1111111111111111111111111111111111111111", null],
    ["https://greengoods.app/garden/0x1111111111111111111111111111111111111111?chainId=10", null],
  ])("resolves only known current-chain gardens from %s", (input, address) => {
    expect(parseStewardGardenTarget(input, gardens, 11155111)?.id ?? null).toBe(address);
  });
  it("retains the selected target across remounts, clears identity state and never signs on open", async () => {
    const client = getTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const first = renderHook(() => useStewardAccessRequestController("admin_access"), { wrapper });
    act(() => {
      first.result.current.setOpen(true);
      first.result.current.selectGarden(gardens[0]);
      first.result.current.setNote("I can coordinate seedlings.");
    });
    expect(first.result.current.selectedGarden?.name).toBe("Comunidad Verde");
    expect(first.result.current.candidates.map((garden) => garden.name)).toEqual([
      "Comunidad Verde",
      "Aiyeloja Family Garden",
    ]);
    expect(checkStatus).not.toHaveBeenCalled();
    expect(submitRequest).not.toHaveBeenCalled();
    first.unmount();
    const second = renderHook(() => useStewardAccessRequestController("account_profile"), {
      wrapper,
    });
    expect(second.result.current.selectedGarden?.id).toBe(gardens[0].id);
    expect(second.result.current.note).toBe("");
    account.address = "0x3333333333333333333333333333333333333333";
    second.rerender();
    await waitFor(() => expect(second.result.current.selectedGarden).toBeNull());
    expect(second.result.current.note).toBe("");
    expect(second.result.current.open).toBe(false);
    second.unmount();
    client.clear();
  });
  it("clears notes when the other entry changes the account-scoped request target", async () => {
    const client = getTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const first = renderHook(() => useStewardAccessRequestController("admin_access"), { wrapper });
    const second = renderHook(() => useStewardAccessRequestController("account_profile"), {
      wrapper,
    });
    act(() => first.result.current.selectGarden(gardens[0]));
    act(() => first.result.current.setNote("Private note for Comunidad Verde."));
    expect(first.result.current.note).toContain("Comunidad Verde");
    act(() => second.result.current.selectGarden(gardens[1]));
    await waitFor(() => expect(first.result.current.selectedGarden?.id).toBe(gardens[1].id));
    expect(first.result.current.note).toBe("");
    expect(first.result.current.step).toBe("review");
    first.unmount();
    second.unmount();
    client.clear();
  });

  it("refreshes garden eligibility only after a confirmed stewardship outcome", () => {
    const client = getTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useStewardAccessRequestController("admin_access"), { wrapper });
    requestState.request = {
      id: "request-1",
      kind: "garden_membership",
      state: "welcomed",
      revision: 1,
      requestedVia: "garden_detail",
      requestedAt: "2026-10-07T12:00:00.000Z",
      expiresAt: "2026-10-21T12:00:00.000Z",
      canAskAgain: false,
    };
    hook.rerender();
    expect(invalidate).not.toHaveBeenCalled();
    requestState.request = {
      ...requestState.request,
      kind: "steward_access",
      requestedVia: "admin_access",
    };
    hook.rerender();
    expect(invalidate).toHaveBeenCalledTimes(2);
    hook.unmount();
    client.clear();
  });
});
