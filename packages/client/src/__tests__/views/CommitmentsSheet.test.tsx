/**
 * CommitmentsSheet Tests — the member's own commitments sheet.
 *
 * The state ladder is the point of most of these: an unreachable data layer,
 * an offline device and a genuinely empty garden must each say their own thing.
 * Telling someone they have no commitments when the app cannot see any is the
 * defect this file exists to prevent.
 *
 * @vitest-environment happy-dom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "../test-utils";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";

/** Rows navigate into a commitment, so the sheet needs a router around it. */
const render = (ui: React.ReactElement) =>
  renderWithProviders(<MemoryRouter initialEntries={["/home"]}>{ui}</MemoryRouter>);

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseCommitmentsInbox = vi.fn();
const mockUseCommitmentsToConfirm = vi.fn();
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

function toConfirm(overrides: Record<string, unknown> = {}) {
  return {
    groups: [],
    count: 0,
    isSteward: false,
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

vi.mock("@green-goods/shared/config/default-chain", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    DEFAULT_CHAIN_ID: 42161,
  };
});

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    usePrimaryAddress: () => VIEWER,
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha Community Garden" }] }),
  };
});

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOnlineStatus: () => mockUseOffline().isOnline,
  };
});

/** Whether the reader sends queued promises themselves, as a wallet sign-in does. */
const mockSendsFromTap = vi.fn(() => false);
vi.mock("@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({ sendsFromTap: mockSendsFromTap() }),
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentPools: () => ({ pools: [{ poolId: 7n, garden: GARDEN }] }),
  useCommitmentSeries: () => ({ series: [] }),
  useCommitmentsInbox: () => mockUseCommitmentsInbox(),
  useCommitmentsToConfirm: () => mockUseCommitmentsToConfirm(),
}));

const { CommitmentsSheet } = await import("../../views/Home/CommitmentsSheet");

describe("CommitmentsSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockSendsFromTap.mockReturnValue(false);
    mockUseCommitmentsInbox.mockReturnValue(inbox());
    mockUseCommitmentsToConfirm.mockReturnValue(toConfirm());
  });

  describe("the To confirm tab", () => {
    const gardenClaim = (overrides: Record<string, unknown> = {}) => ({
      commitment: commitment({
        creator: "0x2222222222222222222222222222222222222222",
        leadProvider: "0x2222222222222222222222222222222222222222",
        counterparty: GARDEN,
        derivedState: "READY_FOR_CONFIRMATION",
        onchainState: "READY_FOR_CONFIRMATION",
        evidenceCount: 1,
        ...overrides,
      }),
      seat: "confirmer" as const,
      needsYou: true,
    });

    it("does not exist for a plain member", () => {
      render(<CommitmentsSheet isOpen onClose={vi.fn()} />);

      expect(screen.queryByRole("tab", { name: /to confirm/i })).not.toBeInTheDocument();
    });

    it("shows a steward what their garden must confirm, grouped by garden, and opens it there", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      mockUseCommitmentsToConfirm.mockReturnValue(
        toConfirm({
          isSteward: true,
          count: 1,
          groups: [
            { garden: GARDEN, gardenName: "Rocinha Community Garden", rows: [gardenClaim()] },
          ],
        })
      );

      render(<CommitmentsSheet isOpen onClose={onClose} />);
      await user.click(screen.getByRole("tab", { name: /to confirm/i }));

      expect(screen.getByText(/These reach you as a steward/)).toBeInTheDocument();
      expect(screen.getByText("Garden claim")).toBeInTheDocument();
      expect(screen.getByText(/Nobody can confirm their own work/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /3 hours/ }));
      expect(onClose).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/9`, {
        viewTransition: false,
        state: {
          dashboardOrigin: expect.any(Object),
          dashboardBack: expect.objectContaining({ path: "/home", scope: expect.any(String) }),
        },
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("marks a commitment a steward recorded for someone as recorded", async () => {
      const user = userEvent.setup();
      const row = gardenClaim({ recordedBy: "0x3333333333333333333333333333333333333333" });
      mockUseCommitmentsToConfirm.mockReturnValue(
        toConfirm({
          isSteward: true,
          count: 1,
          groups: [{ garden: GARDEN, gardenName: "Rocinha Community Garden", rows: [row] }],
        })
      );

      render(<CommitmentsSheet isOpen onClose={vi.fn()} />);
      await user.click(screen.getByRole("tab", { name: /to confirm/i }));

      expect(screen.getByText("Recorded")).toBeInTheDocument();
    });

    it("says nothing is waiting for the garden, not that the reader has nothing", async () => {
      const user = userEvent.setup();
      mockUseCommitmentsToConfirm.mockReturnValue(toConfirm({ isSteward: true }));

      render(<CommitmentsSheet isOpen onClose={vi.fn()} />);
      await user.click(screen.getByRole("tab", { name: /to confirm/i }));

      expect(screen.getByText("Nothing waiting for the garden")).toBeInTheDocument();
    });

    it("offers a retry when the garden's queue could not be read", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockUseCommitmentsToConfirm.mockReturnValue(
        toConfirm({ isSteward: true, isError: true, refetch })
      );

      render(<CommitmentsSheet isOpen onClose={vi.fn()} />);
      await user.click(screen.getByRole("tab", { name: /to confirm/i }));

      expect(screen.getByText(/Could not load the garden's queue/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /try again/i }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  it("opens a row's commitment in its garden without dismissing the dashboard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({ live: [{ commitment: commitment(), seat: "provider", needsYou: false }] })
    );

    render(<CommitmentsSheet isOpen onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /3 hours/ }));
    expect(onClose).not.toHaveBeenCalled();

    expect(mockNavigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/9`, {
      viewTransition: false,
      state: {
        dashboardOrigin: expect.any(Object),
        dashboardBack: expect.objectContaining({ path: "/home", scope: expect.any(String) }),
      },
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("records the displayed Live tab after the reader loses the steward role", async () => {
    const user = userEvent.setup();
    const previous = useUIStore.getState().commitmentsSheetReturnState;
    useUIStore.setState({ commitmentsSheetReturnState: undefined });
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({ live: [{ commitment: commitment(), seat: "provider", needsYou: true }] })
    );
    mockUseCommitmentsToConfirm.mockReturnValue(toConfirm({ isSteward: true }));
    const onClose = vi.fn();
    const view = render(<CommitmentsSheet isOpen onClose={onClose} />);
    try {
      await user.click(screen.getByRole("tab", { name: /to confirm/i }));
      mockUseCommitmentsToConfirm.mockReturnValue(toConfirm({ isSteward: false }));
      view.rerender(
        <MemoryRouter>
          <CommitmentsSheet isOpen onClose={onClose} />
        </MemoryRouter>
      );
      expect(screen.getByRole("tab", { name: /live/i })).toHaveAttribute("aria-selected", "true");
      await user.click(screen.getByRole("button", { name: /3 hours/ }));
      expect(onClose).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        "/home",
        expect.objectContaining({
          state: expect.objectContaining({
            dashboardEntry: expect.objectContaining({
              snapshot: expect.objectContaining({ tab: "live" }),
            }),
          }),
        })
      );
    } finally {
      view.unmount();
      useUIStore.setState({ commitmentsSheetReturnState: previous });
    }
  });

  it("opens settled commitments from the History tab the same way", async () => {
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

    render(<CommitmentsSheet isOpen onClose={onClose} />);
    await user.click(screen.getByRole("tab", { name: /history/i }));
    await user.click(screen.getByRole("button", { name: /3 hours/ }));
    expect(onClose).not.toHaveBeenCalled();

    expect(mockNavigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/9`, {
      viewTransition: false,
      state: {
        dashboardOrigin: expect.any(Object),
        dashboardBack: expect.objectContaining({ path: "/home", scope: expect.any(String) }),
      },
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves a row whose garden it cannot place as a record rather than a dead button", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment({ poolId: 99n }), seat: "provider", needsYou: false }],
      })
    );

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3 hours/ })).not.toBeInTheDocument();
  });

  it("says the surface is not ready rather than claiming the garden is empty", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ availability: UNAVAILABLE }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("Promises are not ready here yet")).toBeInTheDocument();
    expect(screen.queryByText("Nothing moving right now")).not.toBeInTheDocument();
  });

  it("keeps the unavailable state ahead of loading, so nothing spins forever", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ availability: UNAVAILABLE, isLoading: true }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("Promises are not ready here yet")).toBeInTheDocument();
  });

  it("shows a loading region while it is still finding out", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ isLoading: true }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Gathering what is still moving…")).toBeInTheDocument();
  });

  it("offers a way back from a failed read instead of an empty list", async () => {
    const refetch = vi.fn();
    mockUseCommitmentsInbox.mockReturnValue(inbox({ isError: true, refetch }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(
      screen.getByText("We could not load what is still moving. Your promises are safe.")
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("says offline rather than empty when the device cannot reach anything", () => {
    mockUseOffline.mockReturnValue({ isOnline: false });

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("You are offline")).toBeInTheDocument();
    expect(screen.queryByText("Nothing moving right now")).not.toBeInTheDocument();
  });

  it("invites a member in when the garden genuinely holds nothing", () => {
    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("Nothing moving right now")).toBeInTheDocument();
  });

  it("puts what needs the reader ahead of their relationship on a row", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({
        live: [{ commitment: commitment(), seat: "provider", needsYou: true }],
        liveActCount: 1,
        totalActCount: 1,
      })
    );

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

    // A row carries one qualifier: what needs the reader outranks how they are involved.
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.queryByText("You offered this")).not.toBeInTheDocument();
    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.getByText("Rocinha Community Garden")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("reads the same commitment differently from the other side", () => {
    mockUseCommitmentsInbox.mockReturnValue(
      inbox({ live: [{ commitment: commitment(), seat: "confirmer", needsYou: false }] })
    );

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId("tab-over-time"));

    // Kept, the relationship is told in the past tense.
    expect(screen.getByText("You helped with this")).toBeInTheDocument();
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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    expect(screen.getByText("Didn't send")).toBeInTheDocument();
    expect(screen.queryByText(/could not be sent after several tries/i)).not.toBeInTheDocument();
  });

  it("still speaks for a failure no row could carry", () => {
    // A commitment that never reached the chain has no id and so no row.
    mockUseCommitmentsInbox.mockReturnValue(inbox({ failedJobCount: 1, unlistedFailureCount: 1 }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    expect(screen.getByText(/could not be sent after several tries/i)).toBeInTheDocument();
  });

  it("says a commitment made offline is still on its way", () => {
    mockUseCommitmentsInbox.mockReturnValue(inbox({ hasPendingCreate: true }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    expect(
      screen.getByText(/saved on this phone\. It sends when you are connected/i)
    ).toBeInTheDocument();
  });

  it("tells a wallet reader a queued promise is theirs to send, never that it sends itself", () => {
    mockSendsFromTap.mockReturnValue(true);
    mockUseCommitmentsInbox.mockReturnValue(inbox({ hasPendingCreate: true }));

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    expect(
      screen.getByText(/still on this phone\. Send it, or check on it, from its garden's Promises/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/It sends when you are connected/i)).not.toBeInTheDocument();
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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);

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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    expect(screen.getByText("3 rides")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Offers" }));

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.queryByText("3 rides")).not.toBeInTheDocument();
    // The count is unchanged by a filter: it reports the tab, not the view.
    expect(screen.getByTestId("tab-live")).toHaveTextContent("1");
    const scroller = document.querySelector<HTMLElement>(".overflow-y-auto");
    if (!scroller) throw new Error("Commitments scroll owner is missing");
    scroller.scrollTop = 172;
    await user.click(screen.getByRole("button", { name: /3 hours/ }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, "/home", {
      replace: true,
      state: {
        dashboardEntry: expect.objectContaining({
          path: "/home",
          snapshot: { kind: "commitments", tab: "live", direction: "OFFER", scrollTop: 172 },
        }),
      },
    });
  });

  it("keeps the reader's scroll after a clamped promise dashboard return", async () => {
    const previous = useUIStore.getState().commitmentsSheetReturnState;
    useUIStore.setState({
      commitmentsSheetReturnState: { tab: "live", direction: "all", scrollTop: 420 },
    });
    const positions = new WeakMap<Element, number>();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    Object.defineProperty(Element.prototype, "scrollTop", {
      configurable: true,
      get() {
        return positions.get(this) ?? 0;
      },
      set(value: number) {
        positions.set(
          this,
          this.classList.contains("overflow-y-auto") ? Math.min(value, 150) : value
        );
      },
    });
    try {
      const view = render(<CommitmentsSheet isOpen onClose={vi.fn()} />);
      expect(screen.getByTestId("app-sheet")).toHaveAttribute("data-entry-motion", "instant");
      expect(screen.getByTestId("app-sheet-overlay").style.viewTransitionName).toBe(
        "promises-dashboard"
      );
      const scroller = document.querySelector<HTMLElement>(".overflow-y-auto");
      if (!scroller) throw new Error("Commitments scroll owner is missing");
      expect(scroller.scrollTop).toBe(150);
      fireEvent.touchStart(scroller);
      scroller.scrollTop = 70;
      scroller.append(document.createElement("p"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(scroller.scrollTop).toBe(70);
      view.unmount();
    } finally {
      useUIStore.setState({ commitmentsSheetReturnState: previous });
      if (original) Object.defineProperty(Element.prototype, "scrollTop", original);
      else Reflect.deleteProperty(Element.prototype, "scrollTop");
    }
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

    render(<CommitmentsSheet isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId("tab-over-time"));

    expect(screen.getByText("Your record")).toBeInTheDocument();
    expect(screen.getByText("1 kept · 1 lapsed")).toBeInTheDocument();
    expect(
      screen.getByText("Lapsed shows only to you and your stewards.", { exact: false })
    ).toBeInTheDocument();
  });
});
