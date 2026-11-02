/**
 * useGardenSetup Hook Tests
 * @vitest-environment happy-dom
 *
 * The parts a mint starts on other chains: a steward Safe on Gnosis and a settlement account on Celo.
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const ZERO = "0x0000000000000000000000000000000000000000";
const GARDEN = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const HATS = "0x3333333333333333333333333333333333333333";
const SETTLEMENT = "0x4444444444444444444444444444444444444444";
const BOOTSTRAP = "0x5555555555555555555555555555555555555555";
const SOMEONE = "0x6666666666666666666666666666666666666666";

const mockReadContract = vi.fn();

vi.mock("../../../utils/blockchain/contracts", () => ({
  CommitmentPoolingModuleABI: [],
  GardenTokenABI: [],
  GreenGoodsENSABI: [],
  createClients: vi.fn(() => ({ publicClient: { readContract: mockReadContract } })),
  getNetworkContracts: vi.fn(() => ({
    gardenToken: TOKEN,
    hatsModule: HATS,
    settlementModule: SETTLEMENT,
    greenGoodsENS: SOMEONE,
    gardensModule: SOMEONE,
    cookieJarModule: SOMEONE,
    commitmentPoolingModule: SOMEONE,
    octantModule: SOMEONE,
  })),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender: () => vi.fn(),
}));
vi.mock("../../../hooks/app/useToastAction", () => ({
  useToastAction: () => ({ executeWithToast: vi.fn() }),
}));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "" }) }));

import { useGardenSetup } from "../../../hooks/garden/useGardenSetup";

/** A fully set up garden minted as token 18, on a token whose upgradeable accounts start at 18. */
function chainAnswers(overrides: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = {
    slug: "harbour-seeds",
    ownerToSlug: "harbour-seeds",
    getGardenCommunity: SOMEONE,
    getGardenSignalPools: [SOMEONE],
    getGardenJars: [SOMEONE],
    getPoolByGarden: 3n,
    gardenNameReserve: 0n,
    getRegistrationFee: 1n,
    token: [42161n, TOKEN, 18n],
    firstUpgradeableTokenId: 18n,
    stewardSafeBootstrap: BOOTSTRAP,
    settlementAccountBootstrap: ZERO,
    stewardObserver: SOMEONE,
    ...overrides,
  };
  mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (!(functionName in answers)) throw new Error(`no ${functionName} here`);
    const answer = answers[functionName];
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

async function readSteps() {
  const { result } = renderHookWithQueryClient(() => useGardenSetup(GARDEN, true));
  await waitFor(() => expect(result.current.steps.length).toBeGreaterThan(0));
  return result.current;
}

describe("useGardenSetup", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  it("waits for a Green Goods update, not the team, while no mint opens a settlement account", async () => {
    chainAnswers();

    const setup = await readSteps();

    expect(setup.steps.find((step) => step.id === "stewardSafe")).toMatchObject({
      status: "done",
    });
    expect(setup.steps.find((step) => step.id === "settlement")).toMatchObject({
      status: "pending",
      pendingOn: "update",
    });
    expect(setup.needsAttention).toBe(false);
    expect(setup.hasPending).toBe(true);
  });

  it("leaves both parts off a garden minted before them, and off a token without them", async () => {
    chainAnswers({ token: [42161n, TOKEN, 5n] });
    const older = await readSteps();
    expect(older.steps.map((step) => step.id)).not.toContain("stewardSafe");
    expect(older.steps.map((step) => step.id)).not.toContain("settlement");
    expect(older.hasPending).toBe(false);

    chainAnswers({ firstUpgradeableTokenId: new Error("no such read") });
    const beforeRelease = await readSteps();
    expect(beforeRelease.steps.map((step) => step.id)).not.toContain("stewardSafe");
    expect(beforeRelease.steps.map((step) => step.id)).not.toContain("settlement");
  });

  it("names the team once minting opens settlement accounts and this garden has none", async () => {
    chainAnswers({
      stewardObserver: ZERO,
      settlementAccountBootstrap: BOOTSTRAP,
      settlementAccountOf: { account: ZERO, active: false },
    });

    const setup = await readSteps();

    expect(setup.steps.find((step) => step.id === "stewardSafe")).toMatchObject({
      status: "missing",
      fix: "team",
    });
    expect(setup.steps.find((step) => step.id === "settlement")).toMatchObject({
      status: "missing",
      fix: "team",
    });
    expect(setup.needsAttention).toBe(true);
  });

  it("shows a settlement account on its way until it is active, then ready", async () => {
    chainAnswers({
      settlementAccountBootstrap: BOOTSTRAP,
      settlementAccountOf: { account: SOMEONE, active: false },
    });
    const delivering = await readSteps();
    expect(delivering.steps.find((step) => step.id === "settlement")).toMatchObject({
      status: "pending",
      pendingOn: "delivery",
    });
    expect(delivering.needsAttention).toBe(false);

    chainAnswers({
      settlementAccountBootstrap: BOOTSTRAP,
      settlementAccountOf: { account: SOMEONE, active: true },
    });
    const ready = await readSteps();
    expect(ready.steps.find((step) => step.id === "settlement")).toMatchObject({
      status: "done",
    });
    expect(ready.hasPending).toBe(false);
  });
});
