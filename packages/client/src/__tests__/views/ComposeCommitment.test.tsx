/**
 * ComposeCommitment — making a commitment.
 *
 * What matters here is that a member cannot place something nobody could
 * recognise, that garden work carries the actions it names in the order they
 * were named, that the last screen says what placing it does to other people
 * rather than reading the form back, that a draft survives leaving, and that
 * the whole thing works with no signal.
 *
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseOffline = vi.fn();
const mockUsePools = vi.fn();
const mockUseCycles = vi.fn();
const mockUseActions = vi.fn();
const mockEnqueue = vi.fn();

const ACTIONS = [
  { id: "42161-44", title: "Prune", domain: "AGRO", media: [], description: "" },
  { id: "42161-45", title: "Plant", domain: "AGRO", media: [], description: "" },
  { id: "42161-0", title: "Water", domain: "AGRO", media: [], description: "" },
];

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    usePrimaryAddress: () => VIEWER,
    useCommitmentPools: () => mockUsePools(),
    useCommitmentCycles: () => mockUseCycles(),
    useCommitmentCycleNames: () => ({ byCycleId: new Map(), isLoading: false }),
    useActions: () => mockUseActions(),
    useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha Community Garden" }] }),
    useCommitmentJobs: () => ({
      enqueue: mockEnqueue,
      isPending: false,
      error: null,
      viewer: VIEWER,
    }),
    useOffline: () => mockUseOffline(),
  };
});

const { ComposeCommitment } = await import("../../views/Home/Garden/Compose");
const { useCommitmentComposerDraftStore } = await import("@green-goods/shared/stores");

const render = (direction: string | null = "offer") =>
  renderWithProviders(
    <MemoryRouter
      initialEntries={[
        direction
          ? `/home/${GARDEN}/commitments/new?direction=${direction}`
          : `/home/${GARDEN}/commitments/new`,
      ]}
    >
      {/* Nested like the app router: the composer is a child of the garden,
        so a route-relative ".." lands on the garden, not on the root. */}
      <Routes>
        <Route path="/home/:id" element={<Outlet />}>
          <Route index element={<p>Back on the pool</p>} />
          <Route path="commitments/new" element={<ComposeCommitment />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const next = () => screen.getByRole("button", { name: "Next" });

/** The review holds its act until its end has been seen; the test setup's
 * IntersectionObserver never reports, so reading to the end is explicit. */
async function place(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Read to the end" }));
  await user.click(screen.getByRole("button", { name }));
}

/** A service offer, named and counted, through to the review. */
async function walkServiceToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /A service/ }));
  await user.type(screen.getByLabelText("Name it"), "Compost workshop");
  await user.click(next());
  await user.click(screen.getByRole("button", { name: "sessions" }));
  await user.click(screen.getByRole("button", { name: "3" }));
  await user.click(next());
  await user.click(next());
}

describe("ComposeCommitment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useCommitmentComposerDraftStore.setState({ drafts: {} });
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUsePools.mockReturnValue({ pools: [{ poolId: 7n, openSeasonCycleId: null }] });
    mockUseCycles.mockReturnValue({ cycles: [] });
    mockUseActions.mockReturnValue({ data: ACTIONS });
    mockEnqueue.mockResolvedValue("job-1");
  });

  it("takes its direction from the door that opened it, and never asks again", () => {
    render("offer");
    expect(screen.getByText("Make an offer")).toBeInTheDocument();
    expect(screen.getByText("What are you offering?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Offering something/ })).not.toBeInTheDocument();
  });

  it("leaves the flow when no door opened it, rather than guessing a direction", () => {
    render(null);
    expect(screen.getByText("Back on the pool")).toBeInTheDocument();
  });

  it("offers the two kinds as equal cards, and garden work is counted in hours", async () => {
    const user = userEvent.setup();
    render("offer");

    expect(screen.getByRole("button", { name: /Garden work/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");
    await user.click(next());

    expect(screen.getByText("How many hours?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "sessions" })).not.toBeInTheDocument();
    expect(screen.getByText("What has to be approved")).toBeInTheDocument();
  });

  it("will not let garden work continue without an action, and says so", async () => {
    const user = userEvent.setup();
    render("offer");
    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");
    await user.click(next());

    expect(next()).toBeDisabled();
    expect(screen.getByText("Add at least one action.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Prune/ }));
    expect(next()).toBeEnabled();
  });

  it("carries every action row in the order it was chosen, with its count, and no tags", async () => {
    const user = userEvent.setup();
    render("offer");
    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");
    await user.click(next());
    await user.click(screen.getByRole("button", { name: /Prune/ }));
    await user.click(screen.getByRole("button", { name: /Water/ }));
    // Water is action UID 0: a real action, never a sentinel.
    const rows = screen.getByRole("list", { name: "Chosen actions" });
    await user.click(within(rows).getAllByRole("button", { name: "× 4" })[1]!);
    await user.click(next());
    await user.click(next());
    await place(user, "Make this offer");

    const call = mockEnqueue.mock.calls[0]?.[0] as {
      payload: {
        commitmentType: number;
        unitLabel: string;
        requirements: { actionUID: bigint; requiredCount: number }[];
        domainTags: number[];
      };
    };
    expect(call.payload.commitmentType).toBe(0);
    expect(call.payload.unitLabel).toBe("hours");
    expect(call.payload.requirements).toEqual([
      { actionUID: 44n, requiredCount: 1 },
      { actionUID: 0n, requiredCount: 4 },
    ]);
    expect(call.payload.domainTags).toEqual([]);
  });

  it("refuses a row with a count under one and keeps the member's entries", async () => {
    const user = userEvent.setup();
    render("offer");
    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");
    await user.click(next());
    await user.click(screen.getByRole("button", { name: /Prune/ }));
    const count = screen.getByLabelText("How many approved Prune submissions");
    await user.clear(count);
    await user.type(count, "0");

    expect(screen.getByRole("alert")).toHaveTextContent(/count of 1 or more/i);
    expect(next()).toBeDisabled();
    expect(screen.getByText("Give each action a count of 1 or more.")).toBeInTheDocument();
  });

  it("will not let a member place something nobody could recognise", async () => {
    const user = userEvent.setup();
    render("offer");

    // The name is what neighbours see in the pool; without it the row can only
    // describe the record back to them.
    expect(next()).toBeDisabled();
    expect(screen.getByText(/Give it a name/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name it"), "Compost workshop");
    expect(next()).toBeEnabled();
  });

  it("asks a requester who may take it up, and maps that onto the claim mode", async () => {
    const user = userEvent.setup();
    render("request");

    expect(screen.getByText("Make a request")).toBeInTheDocument();
    expect(screen.getByText("What are you asking for?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Help or a service/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.type(screen.getByLabelText("Name it"), "Ride to the market");
    await user.click(next());
    await user.click(screen.getByRole("button", { name: "rides" }));
    await user.click(screen.getByRole("radio", { name: /Stewards review who takes it/ }));
    await user.click(next());
    await user.click(next());
    await place(user, "Make this request");

    const call = mockEnqueue.mock.calls[0]?.[0] as {
      payload: { direction: number; claimMode: number; commitmentType: number };
    };
    expect(call.payload.direction).toBe(1);
    expect(call.payload.claimMode).toBe(1);
    expect(call.payload.commitmentType).toBe(1);
  });

  it("binds the one open season without asking, and asks only when more than one cycle is open", async () => {
    const user = userEvent.setup();
    mockUseCycles.mockReturnValue({
      cycles: [
        { id: "42161-8", cycleId: 8n, cycleType: "SEASON", state: "OPEN", metadataCID: null },
      ],
    });
    render("offer");

    expect(screen.getByText(/Runs in the Season/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Where it runs")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");
    await user.click(next());
    await user.click(screen.getByRole("button", { name: /Prune/ }));
    await user.click(next());
    await user.click(next());
    await place(user, "Make this offer");
    expect(
      (mockEnqueue.mock.calls[0]?.[0] as { payload: { cycleId: bigint } }).payload.cycleId
    ).toBe(8n);
  });

  it("lets the member choose between an open season and an open campaign", async () => {
    const user = userEvent.setup();
    mockUseCycles.mockReturnValue({
      cycles: [
        { id: "42161-9", cycleId: 9n, cycleType: "CAMPAIGN", state: "OPEN", metadataCID: null },
        { id: "42161-8", cycleId: 8n, cycleType: "SEASON", state: "OPEN", metadataCID: null },
      ],
    });
    render("offer");

    const where = screen.getByLabelText("Where it runs");
    // The season leads the list and is bound first.
    expect(where).toHaveValue("8");
    await user.selectOptions(where, "9");
    expect(where).toHaveValue("9");
  });

  it("keeps the note and links as the commitment's own words, under the schema's names", async () => {
    const user = userEvent.setup();
    render("offer");
    await user.click(screen.getByRole("button", { name: /A service/ }));
    await user.type(screen.getByLabelText("Name it"), "Compost workshop");
    await user.click(next());
    await user.click(screen.getByRole("button", { name: "sessions" }));
    await user.click(next());
    await user.type(screen.getByLabelText("Add any detail (optional)"), "Bring gloves");
    await user.type(screen.getByLabelText("Add a link"), "https://example.org/plan");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(next());
    await place(user, "Make this offer");

    const call = mockEnqueue.mock.calls[0]?.[0] as {
      payload: { metadataCID: string; metadata: Record<string, unknown> };
    };
    expect(call.payload.metadataCID).toBe("");
    expect(call.payload.metadata).toEqual({
      version: 1,
      title: "Compost workshop",
      note: "Bring gloves",
      links: [{ url: "https://example.org/plan" }],
    });
  });

  it("says what placing it does to other people, not what was typed", async () => {
    const user = userEvent.setup();
    render("offer");
    await walkServiceToReview(user);

    expect(screen.getByText("Before you place this")).toBeInTheDocument();
    expect(screen.getByText(/you can no longer withdraw it/i)).toBeInTheDocument();
    expect(screen.getByText(/Whoever takes it up confirms it/)).toBeInTheDocument();
  });

  it("holds the act until the end of the review has been seen", async () => {
    const user = userEvent.setup();
    // The real gate: nothing is sent from the top of the review.
    let observed = false;
    class FakeObserver {
      root = null;
      rootMargin = "";
      thresholds = [];
      observe() {
        observed = true;
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    try {
      render("offer");
      await walkServiceToReview(user);

      expect(observed).toBe(true);
      expect(screen.getByRole("button", { name: "Make this offer" })).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Read to the end" }));
      expect(screen.getByRole("button", { name: "Make this offer" })).toBeEnabled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("warns that it will wait when the phone has no signal", async () => {
    const user = userEvent.setup();
    mockUseOffline.mockReturnValue({ isOnline: false });
    render("offer");
    await walkServiceToReview(user);

    expect(screen.getByText(/will wait on your phone/i)).toBeInTheDocument();
  });

  it("refuses to place into a garden with no pool", async () => {
    const user = userEvent.setup();
    mockUsePools.mockReturnValue({ pools: [] });
    render("offer");
    await walkServiceToReview(user);

    expect(screen.getByText(/no pool to place it in yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make this offer" })).toBeDisabled();
  });

  it("queues the commitment with the member's own words attached", async () => {
    const user = userEvent.setup();
    render("offer");
    await walkServiceToReview(user);
    await place(user, "Make this offer");

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const call = mockEnqueue.mock.calls[0]?.[0] as {
      act: string;
      payload: {
        metadataCID: string;
        metadata: { title: string };
        unitLabel: string;
        targetUnits: bigint;
        direction: number;
        commitmentType: number;
      };
    };
    expect(call.act).toBe("create");
    expect(call.payload.metadata.title).toBe("Compost workshop");
    expect(call.payload.metadataCID).toBe("");
    expect(call.payload.unitLabel).toBe("sessions");
    expect(call.payload.targetUnits).toBe(3n);
    expect(call.payload.direction).toBe(0);
    expect(call.payload.commitmentType).toBe(1);
  });

  it("tells a member on a dead connection that it is saved, not sent", async () => {
    const user = userEvent.setup();
    mockUseOffline.mockReturnValue({ isOnline: false });
    render("offer");
    await walkServiceToReview(user);
    await place(user, "Make this offer");

    expect(await screen.findByText("Saved on this phone")).toBeInTheDocument();
  });

  it("stays on the review when the commitment could not be queued", async () => {
    const user = userEvent.setup();
    mockEnqueue.mockRejectedValue(new Error("no sender"));
    render("offer");
    await walkServiceToReview(user);
    await place(user, "Make this offer");

    // A failed enqueue must not read as success; the member keeps their draft.
    expect(screen.queryByText("It is on its way")).not.toBeInTheDocument();
    expect(screen.getByText("Before you place this")).toBeInTheDocument();
  });

  it("keeps what was typed on this device, and offers to resume it", async () => {
    const user = userEvent.setup();
    const first = render("offer");
    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");

    const stored = Object.values(useCommitmentComposerDraftStore.getState().drafts);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.values.title).toBe("Prune the north beds");
    const clientId = stored[0]?.clientCommitmentId;
    first.unmount();

    render("offer");
    expect(screen.getByText("Resume your draft?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume draft" }));
    expect(screen.getByLabelText("Name it")).toHaveValue("Prune the north beds");
    // The same creation identity: a resumed draft never mints a second commitment.
    expect(
      Object.values(useCommitmentComposerDraftStore.getState().drafts)[0]?.clientCommitmentId
    ).toBe(clientId);
  });

  it("starts fresh when asked, and forgets the old draft", async () => {
    const user = userEvent.setup();
    const first = render("offer");
    await user.type(screen.getByLabelText("Name it"), "Prune the north beds");
    first.unmount();

    render("offer");
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    expect(screen.getByLabelText("Name it")).toHaveValue("");
    expect(Object.keys(useCommitmentComposerDraftStore.getState().drafts)).toHaveLength(0);
  });

  it("forgets the draft once the commitment is placed", async () => {
    const user = userEvent.setup();
    render("offer");
    await walkServiceToReview(user);
    await place(user, "Make this offer");
    expect(await screen.findByText("It is on its way")).toBeInTheDocument();

    expect(Object.keys(useCommitmentComposerDraftStore.getState().drafts)).toHaveLength(0);
  });
});
