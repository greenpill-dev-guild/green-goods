/** @vitest-environment happy-dom */

import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRole } from "../../hooks/gardener/useRole";
import { logger } from "../../modules/app/logger";
import { createTestQueryClient } from "../test-utils/query-client";
import { renderHookWithQueryClient } from "../test-utils/query-client-render";

const SMART_ACCOUNT = "0xAbCd000000000000000000000000000000000001";
const WALLET = "0x2222222222222222222222222222222222222222";
const CHAIN_ID = 11155111;
const gardens = [
  { id: "garden-1", name: "Steward Garden" },
  { id: "garden-2", name: "Another Garden" },
];
const mocks = vi.hoisted(() => ({
  auth: { isReady: true, authMode: "passkey", smartAccountAddress: null as string | null },
  registry: { canDeploy: false, isOwner: false, isInAllowlist: false, loading: false },
  chainId: 11155111,
  query: vi.fn(),
}));

vi.mock("../../providers/Auth", () => ({
  useAuthContext: () => mocks.auth,
  useOptionalAuthContext: () => mocks.auth,
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: WALLET }) }));
vi.mock("../../hooks/blockchain/useDeploymentRegistry", () => ({
  useDeploymentRegistry: () => mocks.registry,
}));
vi.mock("../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => mocks.chainId,
}));
vi.mock("../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));

let queryClient: ReturnType<typeof createTestQueryClient>;
const renderRole = () => renderHookWithQueryClient(useRole, { queryClient });

beforeEach(() => {
  queryClient = createTestQueryClient();
  mocks.auth = { isReady: true, authMode: "passkey", smartAccountAddress: SMART_ACCOUNT };
  mocks.registry = { canDeploy: false, isOwner: false, isInAllowlist: false, loading: false };
  mocks.chainId = CHAIN_ID;
  mocks.query.mockReset().mockImplementation(async (_document, { steward, chainId }) => ({
    data: {
      Garden: steward[0] === SMART_ACCOUNT.toLowerCase() && chainId === CHAIN_ID ? gardens : [],
    },
  }));
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
});

describe("useRole", () => {
  it("queries the normalized smart account and current chain despite a connected EOA", async () => {
    const { result } = renderRole();
    await waitFor(() => expect(result.current.role).toBe("steward"));
    expect(mocks.query).toHaveBeenCalledWith(
      expect.anything(),
      { steward: [SMART_ACCOUNT.toLowerCase()], chainId: CHAIN_ID },
      "getStewardGardens"
    );
    expect(result.current).toMatchObject({
      isSteward: true,
      isDeployer: false,
      stewardGardens: gardens,
      deploymentPermissions: { canDeploy: false, isOwner: false, isInAllowlist: false },
    });
  });

  it.each([false, true])("keeps deployer rights when stewardship is %s", async (isSteward) => {
    mocks.registry = { canDeploy: true, isOwner: true, isInAllowlist: true, loading: false };
    mocks.query.mockResolvedValueOnce({ data: { Garden: isSteward ? [gardens[0]] : [] } });
    const { result } = renderRole();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({
      role: "deployer",
      isDeployer: true,
      isSteward,
      stewardGardens: isSteward ? [gardens[0]] : [],
      deploymentPermissions: { canDeploy: true, isOwner: true, isInAllowlist: true },
    });
  });

  it("does not reuse another identity's or chain's cached stewardship", async () => {
    const { result, rerender } = renderRole();
    await waitFor(() => expect(result.current.isSteward).toBe(true));
    mocks.auth.smartAccountAddress = WALLET;
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({
      role: "user",
      isDeployer: false,
      isSteward: false,
      stewardGardens: [],
    });
    mocks.auth.smartAccountAddress = SMART_ACCOUNT;
    mocks.chainId = 42220;
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({
      role: "user",
      isDeployer: false,
      isSteward: false,
      stewardGardens: [],
    });
  });

  it.each([
    ["auth readiness", false],
    ["a primary address", true],
  ] as const)("requires %s before querying", (_reason, ready) => {
    mocks.auth.isReady = ready;
    if (ready) mocks.auth.smartAccountAddress = null;
    const { result } = renderRole();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ role: "user", loading: !ready, stewardGardens: [] });
  });

  it("shows fetching until a genuinely empty query settles", async () => {
    let resolve!: (value: { data: { Garden: never[] } }) => void;
    mocks.query.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { result } = renderRole();
    expect(result.current.loading).toBe(true);
    await act(async () => resolve({ data: { Garden: [] } }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ role: "user", gardensError: false, stewardGardens: [] });
  });

  it("waits for deployment permissions even after the garden query settles", async () => {
    mocks.registry.loading = true;
    const { result, rerender } = renderRole();
    await waitFor(() => expect(result.current.isSteward).toBe(true));
    expect(result.current.loading).toBe(true);
    mocks.registry.loading = false;
    rerender();
    expect(result.current.loading).toBe(false);
  });

  it("distinguishes an indexer outage from no access and recovers on refetch", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    mocks.query.mockResolvedValueOnce({ error: new Error("Indexer unavailable") });
    const { result } = renderRole();
    await waitFor(() => expect(result.current.gardensError).toBe(true));
    expect(result.current).toMatchObject({ role: "user", loading: false });
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    await waitFor(() => expect(result.current.role).toBe("steward"));
    expect(result.current.gardensError).toBe(false);
  });
});
