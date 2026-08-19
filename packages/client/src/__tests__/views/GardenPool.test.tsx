/**
 * GardenPool Tests — the garden's pool tab.
 *
 * Most of these pin what a pool says when it is NOT open. Collapsing paused,
 * closed and composted into one "unavailable" would hide the consequence that
 * differs between them: whether anything resumes, and whether a steward can
 * bring it back.
 *
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

/** The tab navigates into commitment detail, so it needs a router around it. */
const render = (ui: React.ReactElement) =>
  renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;

const mockUseCommitments = vi.fn();
const mockUseCommitmentCycles = vi.fn();
const mockUseOffline = vi.fn();

const AVAILABLE = { status: "available", capability: {} } as const;
const UNAVAILABLE = { status: "unavailable", reason: "not-integrated", capability: {} } as const;

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-7",
    chainId: 42161,
    poolId: 7n,
    registrationSeen: true,
    state: "OPEN",
    commitmentsDue: 12n,
    commitmentsFulfilled: 9n,
    ...overrides,
  };
}

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    poolId: 7n,
    unitLabel: "hours",
    creator: OTHER,
    leadProvider: OTHER,
    counterparty: null,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

function commitmentsResult(overrides: Record<string, unknown> = {}) {
  return {
    commitments: [],
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    usePrimaryAddress: () => VIEWER,
    useCommitments: () => mockUseCommitments(),
    useCommitmentCycles: () => mockUseCommitmentCycles(),
    useOffline: () => mockUseOffline(),
  };
});

const { GardenPool } = await import("../../views/Home/Garden/Pool");

describe("GardenPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUseCommitmentCycles.mockReturnValue({ cycles: [] });
    mockUseCommitments.mockReturnValue(commitmentsResult());
  });

  it("says a paused pool resumes and loses nothing, above a still-readable list", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool({ state: "PAUSED" })} />);

    expect(screen.getByText(/paused this pool/i)).toBeInTheDocument();
    expect(screen.getByText("3 hours")).toBeInTheDocument();
  });

  it("keeps a closed pool's history on screen instead of an empty surface", () => {
    render(<GardenPool pool={pool({ state: "CLOSED" })} />);

    expect(screen.getByText("This pool has closed")).toBeInTheDocument();
    expect(screen.getByText("What this pool grew")).toBeInTheDocument();
    expect(screen.getByText("12 commitments made · 9 kept")).toBeInTheDocument();
  });

  it("says a composted pool can be reopened, which a closed one does not", () => {
    render(<GardenPool pool={pool({ state: "COMPOSTED" })} />);

    expect(screen.getByText(/may reopen it/i)).toBeInTheDocument();
  });

  it("tells a member a set-up pool is not open yet rather than showing an empty list", () => {
    render(<GardenPool pool={pool({ state: "READY" })} />);

    expect(screen.getByText("The pool is set up")).toBeInTheDocument();
    expect(screen.queryByText("No commitments yet")).not.toBeInTheDocument();
  });

  it("does not claim a pool is empty when it cannot read it at all", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ availability: UNAVAILABLE }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Commitments are not ready here yet")).toBeInTheDocument();
    expect(screen.queryByText("No commitments yet")).not.toBeInTheDocument();
  });

  it("says offline rather than empty when the device cannot reach anything", () => {
    mockUseOffline.mockReturnValue({ isOnline: false });

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("You are offline")).toBeInTheDocument();
  });

  it("names a reader's own relationship to a commitment in someone else's garden", () => {
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [commitment({ creator: VIEWER, leadProvider: VIEWER })],
      })
    );

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("You offered this")).toBeInTheDocument();
  });

  it("leaves a stranger's commitment unclaimed by the reader", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.queryByText("You offered this")).not.toBeInTheDocument();
    expect(screen.queryByText("You are helping with this")).not.toBeInTheDocument();
  });

  it("tells seasons and campaigns apart by word and glyph, not colour", () => {
    mockUseCommitmentCycles.mockReturnValue({
      cycles: [
        {
          id: "42161-1",
          cycleId: 1n,
          cycleType: "SEASON",
          state: "OPEN",
          commitmentsFulfilled: 6n,
          commitmentsDue: 16n,
        },
        {
          id: "42161-2",
          cycleId: 2n,
          cycleType: "CAMPAIGN",
          state: "OPEN",
          commitmentsFulfilled: 8n,
          commitmentsDue: 8n,
        },
      ],
    });
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("Campaign")).toBeInTheDocument();
    expect(screen.getByText("6 of 16 kept")).toBeInTheDocument();
    expect(screen.getByText("8 of 8 kept")).toBeInTheDocument();
  });

  it("filters by direction without inventing a total across kinds", async () => {
    const user = userEvent.setup();
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [
          commitment(),
          commitment({ id: "42161-10", direction: "REQUEST", unitLabel: "rides" }),
        ],
      })
    );

    render(<GardenPool pool={pool()} />);
    expect(screen.getByText("3 rides")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Requests" }));

    expect(screen.getByText("3 rides")).toBeInTheDocument();
    expect(screen.queryByText("3 hours")).not.toBeInTheDocument();
  });

  it("explains what the pool is for before listing what is in it", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText(/offer help and ask for it/i)).toBeInTheDocument();
  });
});
