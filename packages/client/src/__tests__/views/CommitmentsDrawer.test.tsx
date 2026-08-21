/**
 * CommitmentsDrawer Tests — the member's own commitments sheet.
 *
 * The state ladder is the point of most of these: an unreachable data layer,
 * an offline device and a genuinely empty garden must each say their own thing.
 * Telling someone they have no commitments when the app cannot see any is the
 * defect this file exists to prevent.
 *
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

/** Rows navigate into a commitment, so the sheet needs a router around it. */
const render = (ui: React.ReactElement) => renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseCommitmentsInbox = vi.fn();
const mockUseOffline = vi.fn();

const AVAILABLE = { status: "available", capability: {} } as const;
const UNAVAILABLE = { status: "unavailable", reason: "not-integrated", capability: {} } as const;

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
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

function inbox(overrides: Record<string, unknown> = {}) {
  return {
    live: [],
    settled: [],
    liveActCount: 0,
    settledActCount: 0,
    totalActCount: 0,
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    failedJobCount: 0,
    failedCommitmentIds: new Set<string>(),
    unlistedFailureCount: 0,
    hasPendingCreate: false,
    queueUnavailable: false,
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
    useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha Community Garden" }] }),
    useCommitmentPools: () => ({ pools: [{ poolId: 7n, garden: GARDEN }] }),
    useCommitmentSeries: () => ({ series: [] }),
    useCommitmentsInbox: () => mockUseCommitmentsInbox(),
    useOffline: () => mockUseOffline(),
  };
});

const { CommitmentsDrawer } = await import("../../views/Home/CommitmentsDrawer");

describe("CommitmentsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUseCommitmentsInbox.mockReturnValue(inbox());
  });

  it("opens a row's commitment in its garden and closes the sheet behind it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({ live: [{ commitment: commitment(), seat: "provider", needsYou: false }] })
    );

    render(<CommitmentsDrawer isOpen onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /3 hours/ }));

    expect(mockNavigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/9`);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens settled commitments from the Over time tab the same way", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        settled: [
          {
            commitment: commitment({ derivedState: "FULFILLED", onchainState: "FULFILLED" }),
            seat: "provider",
            needsYou: false,
          },
        ],
      })
    );

    render(<CommitmentsDrawer isOpen onClose={onClose} />);
    await user.click(screen.getByRole("tab", { name: /over time/i }));
    await user.click(screen.getByRole("button", { name: /3 hours/ }));

    expect(mockNavigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/9`);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves a row whose garden it cannot place as a record rather than a dead button", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment({ poolId: 99n }), seat: "provider", needsYou: false }],
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3 hours/ })).not.toBeInTheDocument();
  });

  it("says the surface is not ready rather than claiming the garden is empty", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ availability: UNAVAILABLE }));

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("Commitments are not ready here yet")).toBeInTheDocument();
    expect(screen.queryByText("Nothing moving right now")).not.toBeInTheDocument();
  });

  it("keeps the unavailable state ahead of loading, so nothing spins forever", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ availability: UNAVAILABLE, isLoading: true }));

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("Commitments are not ready here yet")).toBeInTheDocument();
  });

  it("shows a loading region while it is still finding out", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ isLoading: true }));

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Gathering what is still moving…")).toBeInTheDocument();
  });

  it("offers a way back from a failed read instead of an empty list", async () => {
    const refetch = vi.fn();
    mockUseCommitmentsInbox.mockReturnValue(inbox({ isError: true, refetch }));

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(
      screen.getByText("We could not load what is still moving. Your commitments are safe.")
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("says offline rather than empty when the device cannot reach anything", () => {
    mockUseOffline.mockReturnValue({ isOnline: false });

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("You are offline")).toBeInTheDocument();
    expect(screen.queryByText("Nothing moving right now")).not.toBeInTheDocument();
  });

  it("invites a member in when the garden genuinely holds nothing", () => {
    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("Nothing moving right now")).toBeInTheDocument();
  });

  it("names the reader's own relationship on each row", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment(), seat: "provider", needsYou: true }],
        liveActCount: 1,
        totalActCount: 1,
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("You offered this")).toBeInTheDocument();
    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.getByText("Rocinha Community Garden")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Needs you")).toBeInTheDocument();
  });

  it("reads the same commitment differently from the other side", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({ live: [{ commitment: commitment(), seat: "confirmer", needsYou: false }] })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    expect(screen.getByText("You took this up")).toBeInTheDocument();
    expect(screen.queryByText("You offered this")).not.toBeInTheDocument();
  });

  it("never says a member did work they only helped with", async () => {
    const user = userEvent.setup();
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        settled: [
          {
            commitment: commitment({ derivedState: "FULFILLED", onchainState: "FULFILLED" }),
            seat: "contributor",
            needsYou: false,
          },
        ],
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId("tab-over-time"));

    expect(screen.getByText("You are helping with this")).toBeInTheDocument();
    expect(screen.queryByText("You offered this")).not.toBeInTheDocument();
  });

  it("says the queue could not be read rather than showing a short list", () => {
    // An unreadable queue and an empty one look identical in the data; only
    // one of them means the member has nothing waiting.
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment(), seat: "provider", needsYou: false }],
        queueUnavailable: true,
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    expect(screen.getByText(/this list may be incomplete/i)).toBeInTheDocument();
  });

  it("names the commitment whose work gave up, not just how many", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment(), seat: "provider", needsYou: false }],
        failedJobCount: 1,
        failedCommitmentIds: new Set(["9"]),
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    expect(screen.getByText("Didn't send")).toBeInTheDocument();
  });

  it("does not say twice what a row already says once", () => {
    // A failed confirm names its own row. A banner counting it as well reports
    // one commitment as two problems.
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment(), seat: "provider", needsYou: false }],
        failedJobCount: 1,
        failedCommitmentIds: new Set(["9"]),
        unlistedFailureCount: 0,
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    expect(screen.getByText("Didn't send")).toBeInTheDocument();
    expect(screen.queryByText(/could not be sent after several tries/i)).not.toBeInTheDocument();
  });

  it("still speaks for a failure no row could carry", () => {
    // A commitment that never reached the chain has no id and so no row.
    mockUseCommitmentsInbox.mockReturnValue(inbox({ failedJobCount: 1, unlistedFailureCount: 1 }));

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    expect(screen.getByText(/could not be sent after several tries/i)).toBeInTheDocument();
  });

  it("says a commitment made offline is still on its way", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ hasPendingCreate: true }));

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    expect(screen.getByText(/still waiting to send from this phone/i)).toBeInTheDocument();
  });

  it("counts acts per tab, and never inventory", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [
          { commitment: commitment(), seat: "provider", needsYou: true },
          { commitment: commitment({ id: "42161-10" }), seat: "provider", needsYou: false },
        ],
        liveActCount: 1,
        totalActCount: 1,
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);

    // Two rows are listed and only one needs an act, so the pill reads 1.
    expect(screen.getByTestId("tab-live")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-live")).not.toHaveTextContent("2");
  });

  it("filters by direction without letting anything that needs an act disappear", async () => {
    const user = userEvent.setup();
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [
          { commitment: commitment(), seat: "provider", needsYou: true },
          {
            commitment: commitment({ id: "42161-10", direction: "REQUEST", unitLabel: "rides" }),
            seat: "confirmer",
            needsYou: false,
          },
        ],
        liveActCount: 1,
        totalActCount: 1,
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    expect(screen.getByText("3 rides")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Offers" }));

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.queryByText("3 rides")).not.toBeInTheDocument();
    // The count is unchanged by a filter: it reports the tab, not the view.
    expect(screen.getByTestId("tab-live")).toHaveTextContent("1");
  });

  it("shows the member their own settled record, lapsed included", async () => {
    const user = userEvent.setup();
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        settled: [
          {
            commitment: commitment({ derivedState: "FULFILLED", onchainState: "FULFILLED" }),
            seat: "provider",
            needsYou: false,
          },
          {
            commitment: commitment({
              id: "42161-11",
              derivedState: "EXPIRED",
              onchainState: "EXPIRED",
            }),
            seat: "provider",
            needsYou: false,
          },
        ],
      })
    );

    render(<CommitmentsDrawer isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId("tab-over-time"));

    expect(screen.getByText("Your record")).toBeInTheDocument();
    expect(screen.getByText("1 kept · 1 lapsed")).toBeInTheDocument();
    expect(
      screen.getByText("Lapsed shows only to you and your stewards.", { exact: false })
    ).toBeInTheDocument();
  });
});
