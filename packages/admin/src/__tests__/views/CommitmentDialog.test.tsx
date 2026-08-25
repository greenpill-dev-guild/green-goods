/**
 * @vitest-environment jsdom
 */

import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { commitmentDialogControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const CREATOR = "0x1111111111111111111111111111111111111111" as const;
const TAKER = "0x2222222222222222222222222222222222222222" as const;

const mocks = vi.hoisted(() => ({
  controller: null as CommitmentDialogController | null,
  navigate: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/useCommitmentDialogController", () => ({
  useCommitmentDialogController: () => mocks.controller!,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { error: mocks.toastError },
}));

// A Radix dialog opened over the inspector's own dialog flickers out in jsdom
// (AddMembersDialog precedent): the reason dialog becomes a plain region that
// hands the typed reason straight to onConfirm.
vi.mock("@/components/AdminReasonDialog", () => ({
  AdminReasonDialog: ({
    isOpen,
    title,
    confirmLabel,
    onConfirm,
    children,
  }: {
    isOpen: boolean;
    title: string;
    confirmLabel: string;
    onConfirm: (reason: string) => void | Promise<void>;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
        <button type="button" onClick={() => void onConfirm("because")}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const { CommitmentDialogPanel } = await import("@/views/Garden/Pool/CommitmentDialog");

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "EVIDENCE_SUBMITTED",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 2,
    cycleId: 12n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 1n,
    unitLabel: "repair session",
    direction: "OFFER",
    commitmentType: "SUPPORT_SERVICE",
    creator: CREATOR,
    leadProvider: CREATOR,
    counterparty: TAKER,
    counterpartyKind: "INDIVIDUAL",
    confirmers: [],
    confirmationThreshold: 1,
    protocolFallbackEnabled: true,
    contributorCount: 1,
    contributorsFrozen: false,
    dueDate: 1_756_000_500n,
    metadataCID: "bafy-9",
    considerationRail: "ARBITRUM_EXTERNAL",
    requiresAssessment: false,
    assessmentUID: null,
    readyOverridden: false,
    preDisputeState: null,
    ...overrides,
  });
}

function can(
  overrides: Partial<CommitmentDialogController["can"]> = {}
): CommitmentDialogController["can"] {
  return {
    cancel: false,
    markReady: false,
    sendForConfirmation: false,
    attachAssessment: false,
    raiseDispute: false,
    resolveDispute: false,
    resolveFulfilled: false,
    expire: false,
    confirmOrdinary: false,
    confirmFallback: false,
    acceptClaim: false,
    declineClaim: false,
    syncWorkDecisions: false,
    ...overrides,
  };
}

type ControllerOverrides = Omit<Partial<CommitmentDialogController>, "commitment" | "detail"> & {
  commitment?: Partial<CommitmentReadModel> | null;
  detail?: CommitmentDialogController["detail"];
};

function controller(overridesWithCommitment: ControllerOverrides = {}): CommitmentDialogController {
  const { commitment: commitmentOverrides, ...overrides } = overridesWithCommitment;
  const acts = {
    cancel: vi.fn().mockResolvedValue("0x1"),
    markReady: vi.fn().mockResolvedValue("0x1"),
    sendForConfirmation: vi.fn().mockResolvedValue("job"),
    attachAssessment: vi.fn().mockResolvedValue("0x1"),
    raiseDispute: vi.fn().mockResolvedValue("0x1"),
    resolveDispute: vi.fn().mockResolvedValue("0x1"),
    expire: vi.fn().mockResolvedValue("0x1"),
    confirmOrdinary: vi.fn().mockResolvedValue("job"),
    confirmFallback: vi.fn().mockResolvedValue("0x1"),
    acceptClaim: vi.fn().mockResolvedValue("0x1"),
    declineClaim: vi.fn().mockResolvedValue("0x1"),
    syncWorkDecisions: vi.fn().mockResolvedValue("0x1"),
  };
  const record = commitmentOverrides === null ? null : commitment(commitmentOverrides ?? {});
  const detail =
    overrides.detail === undefined
      ? record
        ? commitmentDetailFixture({
            commitment: record,
            contributors: [
              contributorFixture({
                id: "c-1",
                commitmentId: 9n,
                contributor: CREATOR,
                active: true,
                isLead: true,
                evidenceCredits: 1,
              }),
            ],
          })
        : null
      : overrides.detail;
  return commitmentDialogControllerFixture({
    chainId: 42161,
    garden: GARDEN,
    viewer: "0x3333333333333333333333333333333333333333",
    isOnline: true,
    commitment: record,
    detail,
    title: "Repair tool handles",
    note: null,
    cycle: null,
    events: [
      {
        id: "e-2",
        chainId: 42161,
        poolId: 7n,
        cycleId: 12n,
        commitmentId: 9n,
        eventType: "EVIDENCE_ATTACHED",
        actor: CREATOR,
        configurationKey: null,
        previousValue: null,
        newValue: null,
        units: null,
        data: null,
        txHash: "0x1",
        timestamp: 1_755_900_000,
      },
      {
        id: "e-1",
        chainId: 42161,
        poolId: 7n,
        cycleId: 12n,
        commitmentId: 9n,
        eventType: "CREATED",
        actor: CREATOR,
        configurationKey: null,
        previousValue: null,
        newValue: null,
        units: null,
        data: null,
        txHash: "0x0",
        timestamp: 1_755_800_000,
      },
    ],
    disputeReason: { reason: null, isLoading: false, isUnavailable: false },
    cancelReason: { reason: null, isLoading: false, isUnavailable: false },
    assessments: [],
    assessmentsLoading: false,
    activeContributors: [CREATOR],
    seat: "bystander",
    isLocalSteward: true,
    isProtocolSteward: false,
    onRoster: false,
    poolPaused: false,
    ordinaryReachable: true,
    confirmation: { allowed: false, path: null, reason: "not-eligible" },
    isDue: false,
    hasPendingJob: false,
    can: can(),
    reconciliation: {
      candidates: [],
      count: 0,
      decisionUIDs: [],
      readAvailable: true,
      isLoading: false,
      isError: false,
      pendingReadback: false,
      succeeded: false,
      readbackStatus: "idle",
      unavailableReadback: false,
      needsFreshReview: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    acts,
    isActing: false,
    isLoading: false,
    isError: false,
    unavailable: false,
    notFound: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

function renderPanel(commitmentId = "9") {
  return renderWithProviders(
    <CommitmentDialogPanel
      chainId={42161}
      garden={GARDEN}
      commitmentId={commitmentId}
      tone="garden"
    />
  );
}

function panel(commitmentId: string) {
  return (
    <CommitmentDialogPanel
      chainId={42161}
      garden={GARDEN}
      commitmentId={commitmentId}
      tone="garden"
    />
  );
}

describe("CommitmentDialogPanel (W10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.controller = controller();
  });

  it("renders the record's anatomy: chips, parties, stages, facts and timeline", () => {
    renderPanel();
    expect(screen.getByText("Repair tool handles")).toBeInTheDocument();
    expect(screen.getByText(/proof in/i, { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/1 repair session/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /lifecycle/i })).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
    expect(screen.getByText(/ordinary rule/i)).toBeInTheDocument();
    const timeline =
      screen.getByRole("region", { name: /timeline/i }) ?? screen.getByText(/timeline/i);
    expect(timeline).toBeInTheDocument();
    expect(screen.getByText(/proof added/i)).toBeInTheDocument();
    expect(screen.getByText(/^created$/i)).toBeInTheDocument();
  });

  it("offers the accepted row's three separate acts and routes each through its own reason", async () => {
    mocks.controller = controller({
      can: can({ cancel: true, markReady: true, sendForConfirmation: true }),
    });
    renderPanel();
    const acts = mocks.controller!.acts;

    fireEvent.click(screen.getByRole("button", { name: /mark ready/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /mark ready with override/i })).getByRole(
        "button",
        { name: /^mark ready$/i }
      )
    );
    await waitFor(() => expect(acts.markReady).toHaveBeenCalledWith("because"));

    fireEvent.click(screen.getByRole("button", { name: /cancel commitment/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /cancel this commitment/i })).getByRole("button", {
        name: /^cancel commitment$/i,
      })
    );
    await waitFor(() => expect(acts.cancel).toHaveBeenCalledWith("because"));

    fireEvent.click(screen.getByRole("button", { name: /send for confirmation/i }));
    await waitFor(() => expect(acts.sendForConfirmation).toHaveBeenCalled());
  });

  it("shows the fallback banner and act only when the ordinary path is unreachable, naming the garden's authority", async () => {
    const ordinary = controller({
      commitment: {
        onchainState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
      },
    });
    mocks.controller = ordinary;
    const { unmount } = renderPanel();
    expect(screen.queryByTestId("commitment-fallback-eligible")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fallback/i })).not.toBeInTheDocument();
    unmount();

    mocks.controller = controller({
      commitment: {
        onchainState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
      },
      ordinaryReachable: false,
      confirmation: { allowed: true, path: "POOL_FALLBACK", reason: null },
      can: can({ confirmFallback: true, raiseDispute: true }),
    });
    renderPanel();
    expect(screen.getByTestId("commitment-fallback-eligible")).toHaveTextContent(
      /steward of this garden/i
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm as garden fallback/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /confirm as garden fallback/i })).getByRole(
        "button",
        { name: /^confirm as garden fallback$/i }
      )
    );
    const acts = mocks.controller!.acts;
    await waitFor(() => expect(acts.confirmFallback).toHaveBeenCalledWith("because"));
  });

  it("names the Green Goods team on a protocol fallback", () => {
    mocks.controller = controller({
      commitment: {
        onchainState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
      },
      ordinaryReachable: false,
      confirmation: { allowed: true, path: "PROTOCOL_FALLBACK", reason: null },
      can: can({ confirmFallback: true }),
    });
    renderPanel();
    expect(screen.getByTestId("commitment-fallback-eligible")).toHaveTextContent(
      /green goods team/i
    );
    expect(
      screen.getByRole("button", { name: /confirm for green goods team/i })
    ).toBeInTheDocument();
  });

  it("hides Kept from a steward on the roster and from a formerly expired record, and resolves with a reason", async () => {
    mocks.controller = controller({
      commitment: {
        onchainState: "DISPUTED",
        state: "DISPUTED",
        derivedState: "DISPUTED",
        preDisputeState: "EXPIRED",
      },
      disputeReason: {
        reason: { version: 1, reason: "Delivery contested" },
        isLoading: false,
        isUnavailable: false,
      },
      can: can({ resolveDispute: true, resolveFulfilled: false }),
    });
    renderPanel();
    expect(screen.getByText(/delivery contested/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^resolve/i }));
    const dialog = screen.getByRole("dialog", { name: /resolve the dispute/i });
    expect(within(dialog).queryByRole("radio", { name: /^kept/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: /cancelled/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /^resolve$/i }));
    const acts = mocks.controller!.acts;
    await waitFor(() => expect(acts.resolveDispute).toHaveBeenCalledWith("CANCELLED", "because"));
  });

  it("offers Kept to an eligible non-contributor steward", () => {
    mocks.controller = controller({
      commitment: {
        onchainState: "DISPUTED",
        state: "DISPUTED",
        derivedState: "DISPUTED",
        preDisputeState: "READY_FOR_CONFIRMATION",
      },
      can: can({ resolveDispute: true, resolveFulfilled: true }),
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^resolve/i }));
    expect(
      within(screen.getByRole("dialog", { name: /resolve the dispute/i })).getByRole("radio", {
        name: /^kept/i,
      })
    ).toBeInTheDocument();
  });

  // ConfirmLib.markReadyForConfirmation waives the requirement counters and the
  // commitment type both, so the override is the only recovery a stalled
  // Work-backed record has. Hiding the row left it with none.
  it("offers the steward override on a Work-backed record, in its own words", async () => {
    const record = controller({
      commitment: { commitmentType: "DOMAIN_IMPACT" },
      can: can({ markReady: true }),
    });
    record.detail!.requirements = [
      {
        id: "42161-9-0",
        chainId: 42161,
        commitmentId: 9n,
        requirementIndex: 0,
        creationSeen: true,
        actionUID: 1n,
        requiredCount: 3,
        approvedCount: 1,
        domain: 0,
        createdAt: 1_755_000_000,
        updatedAt: 1_755_000_000,
      },
    ];
    mocks.controller = record;
    renderPanel();

    expect(screen.getByText(/work still outstanding/i)).toBeInTheDocument();
    expect(screen.queryByText(/recipient can.t confirm/i)).not.toBeInTheDocument();

    const markReady = screen.getByRole("button", { name: /mark ready/i });
    expect(markReady).toBeEnabled();
    fireEvent.click(markReady);
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /mark ready with override/i })).getByRole(
        "button",
        { name: /^mark ready$/i }
      )
    );
    const acts = mocks.controller!.acts;
    await waitFor(() => expect(acts.markReady).toHaveBeenCalledWith("because"));
  });

  it("confirms steward reconciliation without exposing raw decision ids", async () => {
    mocks.controller = controller({
      can: can({ syncWorkDecisions: true }),
      reconciliation: {
        ...controller().reconciliation,
        count: 2,
        decisionUIDs: [`0x${"ab".repeat(32)}`, `0x${"cd".repeat(32)}`],
      },
    });
    renderPanel();

    expect(screen.getByText(/2 approved links are waiting to count/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /count linked work/i }));

    const dialog = screen.getByRole("alertdialog", { name: /count approved linked work/i });
    expect(dialog).toHaveTextContent(/freeze its contributor roster/i);
    expect(dialog).not.toHaveTextContent("abababab");
    expect(dialog).not.toHaveTextContent("cdcdcdcd");

    fireEvent.click(within(dialog).getByRole("button", { name: /^count linked work$/i }));
    await waitFor(() => expect(mocks.controller!.acts.syncWorkDecisions).toHaveBeenCalledTimes(1));
  });

  it("keeps a failed reconciliation visible and reports it through the admin toast", async () => {
    const record = controller({
      can: can({ syncWorkDecisions: true }),
      reconciliation: { ...controller().reconciliation, count: 1 },
    });
    vi.mocked(record.acts.syncWorkDecisions).mockRejectedValue(new Error("write failed"));
    mocks.controller = record;
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /count linked work/i }));
    const dialog = screen.getByRole("alertdialog", { name: /count approved linked work/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^count linked work$/i }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alertdialog", { name: /count approved linked work/i })).toBeVisible();
  });

  it("gates reconciliation on connection and decision read availability", () => {
    mocks.controller = controller({
      isOnline: false,
      can: can({ syncWorkDecisions: false }),
      reconciliation: { ...controller().reconciliation, count: 1 },
    });
    const view = renderPanel();
    expect(screen.getByRole("button", { name: /count linked work/i })).toBeDisabled();
    expect(screen.getAllByText(/needs a connection/i)).not.toHaveLength(0);

    mocks.controller = controller({
      reconciliation: {
        ...controller().reconciliation,
        readAvailable: false,
        isError: true,
        readbackStatus: "unavailable",
        error: new Error("read failed"),
      },
    });
    view.rerender(panel("9"));

    expect(screen.getByRole("alert")).toHaveTextContent(/readback is unavailable/i);
    expect(screen.queryByRole("button", { name: /count linked work/i })).not.toBeInTheDocument();
  });

  it.each([
    ["pending", /waiting for indexed confirmation/i],
    ["succeeded", /approved linked work counted/i],
  ] as const)("announces the derived indexed-readback %s state", (readbackStatus, message) => {
    mocks.controller = controller({
      reconciliation: { ...controller().reconciliation, readbackStatus },
    });
    renderPanel();

    expect(screen.getByText(message).closest('[role="status"]')).toBeInTheDocument();
  });

  it("keeps successful reconciliation visible after the commitment advances", () => {
    mocks.controller = controller({
      commitment: {
        onchainState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
      },
      reconciliation: { ...controller().reconciliation, readbackStatus: "succeeded" },
    });

    renderPanel();

    expect(screen.getByText(/approved linked work counted/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark ready/i })).not.toBeInTheDocument();
  });

  it("keeps fresh-review readback distinct from counted success", () => {
    mocks.controller = controller({
      reconciliation: {
        ...controller().reconciliation,
        readbackStatus: "needsFreshReview",
        succeeded: true,
      },
    });
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/newer Work decision needs review/i);
    expect(screen.queryByText(/approved linked work counted/i)).not.toBeInTheDocument();
  });

  it("shows the override disabled when the chain's own gates are not clear", () => {
    const record = controller({ commitment: { commitmentType: "DOMAIN_IMPACT" } });
    record.detail!.requirements = [
      {
        id: "42161-9-0",
        chainId: 42161,
        commitmentId: 9n,
        requirementIndex: 0,
        creationSeen: true,
        actionUID: 1n,
        requiredCount: 3,
        approvedCount: 1,
        domain: 0,
        createdAt: 1_755_000_000,
        updatedAt: 1_755_000_000,
      },
    ];
    mocks.controller = record;
    renderPanel();
    expect(screen.getByRole("button", { name: /mark ready/i })).toBeDisabled();
  });

  it("shows the empty assessment state instead of another garden's records", () => {
    mocks.controller = controller({
      commitment: { requiresAssessment: true },
      can: can({ attachAssessment: true, cancel: true }),
      assessments: [],
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /attach assessment/i }));
    expect(screen.getByTestId("attach-assessment-empty")).toBeInTheDocument();
  });

  it("shows the not-found cast with retry and a way back to the pool", () => {
    const refetch = vi.fn();
    mocks.controller = controller({ commitment: null, detail: null, notFound: true, refetch });
    renderPanel();
    expect(screen.getByText(/couldn.t be loaded/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    expect(refetch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /back to pool/i }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/garden\/pool\?gardenId=/)
    );
  });

  it("names the fulfilled path and reason once confirmed", () => {
    mocks.controller = controller({
      commitment: {
        onchainState: "FULFILLED",
        state: "FULFILLED",
        derivedState: "FULFILLED",
        confirmationPath: "PROTOCOL_FALLBACK",
        fallbackReason: "no eligible local confirmer",
        fulfilledBy: TAKER,
      },
    });
    renderPanel();
    expect(screen.getByText(/green goods team — fallback/i)).toBeInTheDocument();
    expect(screen.getByText(/no eligible local confirmer/i)).toBeInTheDocument();
  });

  it("shows the not-found cast for a malformed route id rather than failing to render", () => {
    renderPanel("not-a-number");
    expect(screen.getByText(/couldn.t be loaded/i)).toBeInTheDocument();
    expect(screen.queryByTestId("commitment-acts")).not.toBeInTheDocument();
  });

  it("names an unavailable chain and offers no retry that cannot run", () => {
    mocks.controller = controller({
      commitment: null,
      detail: null,
      unavailable: true,
      availability: {
        status: "unavailable",
        reason: "not-integrated",
        capability: availableCapability,
      },
    });
    renderPanel();
    expect(screen.getByText(/not on this chain yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to pool/i })).toBeInTheDocument();
  });

  it("drops the picked resolution when the panel switches to another commitment", async () => {
    mocks.controller = controller({
      commitment: {
        onchainState: "DISPUTED",
        state: "DISPUTED",
        derivedState: "DISPUTED",
        preDisputeState: "READY_FOR_CONFIRMATION",
      },
      can: can({ resolveDispute: true, resolveFulfilled: true }),
    });
    const { rerender } = renderPanel("9");
    fireEvent.click(screen.getByRole("button", { name: /^resolve/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /resolve the dispute/i })).getByRole("radio", {
        name: /^kept/i,
      })
    );

    // The next record is one this steward may not mark kept, so a carried-over
    // FULFILLED would submit an outcome its own dialog refuses to offer.
    mocks.controller!.can = can({
      resolveDispute: true,
      resolveFulfilled: false,
    });
    rerender(panel("10"));
    expect(screen.queryByRole("dialog", { name: /resolve the dispute/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^resolve/i }));
    const dialog = screen.getByRole("dialog", { name: /resolve the dispute/i });
    expect(within(dialog).queryByRole("radio", { name: /^kept/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /^resolve$/i }));
    const acts = mocks.controller!.acts;
    await waitFor(() =>
      expect(acts.resolveDispute).toHaveBeenCalledWith("RESTORE_PREVIOUS", "because")
    );
  });

  it("drops the picked assessment when the panel switches to another commitment", () => {
    mocks.controller = controller({
      commitment: { requiresAssessment: true },
      can: can({ attachAssessment: true }),
      assessments: [
        {
          id: "0xaaa",
          authorAddress: CREATOR,
          gardenAddress: GARDEN,
          title: "Soil check",
          description: "Check the garden soil",
          assessmentConfigCID: "bafy-soil-check",
          domain: 0,
          startDate: null,
          endDate: null,
          location: "Rocinha",
          createdAt: 1_755_000_000,
        },
      ],
    });
    const { rerender } = renderPanel("9");
    const open = () => fireEvent.click(screen.getByRole("button", { name: /attach assessment/i }));

    open();
    fireEvent.click(screen.getByRole("radio", { name: /soil check/i }));
    expect(screen.getByRole("button", { name: /^attach$/i })).toBeEnabled();

    rerender(panel("10"));
    open();
    // A record in another provider garden must not inherit this pick.
    expect(screen.getByRole("button", { name: /^attach$/i })).toBeDisabled();
  });
});
