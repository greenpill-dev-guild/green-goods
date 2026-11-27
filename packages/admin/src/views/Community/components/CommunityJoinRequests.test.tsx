import { GardenJoinRequestTransportError } from "@green-goods/shared/modules/garden-join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadQueue = vi.fn(
  async (): Promise<{
    ok: boolean;
    items: never[];
    countGrant?: { token: string; expiresAt: number };
  }> => ({ ok: true, items: [] })
);
const resolveRequest = vi.fn(async () => ({ ok: true, pendingOnchainMembership: false }));
let rateLimitedRecently = false;
let mutationError: Error | null = null;
let stewardship = false;
const addGardener = vi.fn(
  async (): Promise<{
    success: boolean;
    hash?: `0x${string}`;
    error?: { name: string; message: string };
  }> => ({ success: true, hash: "0x1234" })
);
const addSteward = vi.fn(
  async (): Promise<{
    success: boolean;
    hash?: `0x${string}`;
    error?: { name: string; message: string };
  }> => ({ success: true, hash: "0x1234" })
);

vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useAwaitingJoinRequests: () => new Set<string>(),
  useGardenJoinRequestAvailability: (kind?: string) => kind !== "steward_access" || stewardship,
  useGardenJoinRequests: () => ({
    queue: [
      {
        id: "request-1",
        kind: stewardship ? "steward_access" : "garden_membership",
        accountAddress: "0x2222222222222222222222222222222222222222",
        displayName: "Maya",
        note: "I can help with seedlings.",
        state: "pending",
        revision: 0,
        requestedAt: "2026-08-27T12:00:00.000Z",
      },
    ],
    nextCursor: undefined,
    queueState: { isLoading: false, error: null },
    mutationState: { isLoading: false, error: mutationError },
    rateLimitedRecently,
    loadQueue,
    resolveRequest,
  }),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ addGardener, addSteward, isLoading: false }),
}));

vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => <span>{address}</span>,
}));

import { CommunityJoinRequests } from "./CommunityJoinRequests";

const messages = {
  "app.common.cancel": "Cancel",
  "app.common.refresh": "Refresh",
  "app.garden.joinQueue.membershipAddFailed": "Membership could not be added.",
  "app.garden.joinQueue.rateLimitedNotice":
    "Some people couldn't ask to join recently because of the rate limit.",
  "app.garden.joinRequest.error.conflict":
    "This changed or was already used. Check its status and try again.",
  "hub.community.joinRequests.confirmDecline": "Decline",
  "hub.community.joinRequests.countNotice":
    "Checking also lets this browser show how many wait on the Members tab for 30 days.",
  "hub.community.joinRequests.decline": "Decline",
  "hub.community.joinRequests.declined": "They were declined.",
  "hub.community.joinRequests.declineDescription":
    "Decline {name} and share the reason they can read when they check their status.",
  "hub.community.joinRequests.declineTitle": "Decline Membership",
  "hub.community.joinRequests.description": "Review people who asked to join this garden.",
  "hub.community.joinRequests.empty": "Nobody is asking to join right now.",
  "hub.community.joinRequests.load": "Check Who's Asking",
  "hub.community.joinRequests.membershipPending": "Membership pending.",
  "hub.community.joinRequests.reason": "Reason for declining",
  "hub.community.joinRequests.title": "Asking to Join",
  "hub.community.joinRequests.updateFailed": "That didn't go through. Try again.",
  "hub.community.joinRequests.welcome": "Welcome",
  "hub.community.joinRequests.welcomed": "The gardener was welcomed.",
  "hub.community.stewardRequests.title": "Steward Access Requests",
  "hub.community.stewardRequests.description": "Assign the steward role to the account shown.",
  "hub.community.stewardRequests.approve": "Approve Steward Access",
  "hub.community.stewardRequests.confirmed": "Steward access was confirmed.",
  "hub.community.stewardRequests.pending": "Steward assignment is pending.",
};

const GARDEN = "0x1111111111111111111111111111111111111111";

const onCountGrant = vi.fn();

function queueUi(onRead: (kind: string, waiting: number) => void, gardenAddress: string = GARDEN) {
  return (
    <IntlProvider locale="en" messages={messages}>
      <CommunityJoinRequests
        gardenAddress={gardenAddress as Address}
        onRead={onRead}
        onCountGrant={onCountGrant}
      />
    </IntlProvider>
  );
}

function renderQueue(onRead: (kind: string, waiting: number) => void = () => {}) {
  return render(queueUi(onRead));
}

describe("CommunityJoinRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitedRecently = false;
    mutationError = null;
    stewardship = false;
  });

  it("loads explicitly and welcomes through the on-chain membership operation first", async () => {
    const user = userEvent.setup();
    renderQueue();
    expect(loadQueue).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Check Who's Asking" }));
    expect(loadQueue).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Welcome" }));
    await waitFor(() => expect(addGardener).toHaveBeenCalledOnce());
    expect(addGardener).toHaveBeenCalledWith("0x2222222222222222222222222222222222222222", {
      trackMemberAnalytics: false,
    });
    await waitFor(() =>
      expect(resolveRequest).toHaveBeenCalledWith("request-1", {
        action: "welcome",
        expectedRevision: 0,
      })
    );
  });

  it("tells the Members tab how many wait only after a finished read (DL-134)", async () => {
    const onRead = vi.fn();
    const user = userEvent.setup();
    renderQueue(onRead);
    // Opening the queue reads nothing: the count never asks for a signature.
    expect(loadQueue).not.toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();

    // A failed read says nothing about how many wait.
    loadQueue.mockRejectedValueOnce(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "Check Who's Asking" }));
    await waitFor(() => expect(loadQueue).toHaveBeenCalledOnce());
    expect(onRead).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Check Who's Asking" }));
    await waitFor(() => expect(onRead).toHaveBeenCalledWith("garden_membership", 1));
  });

  it("says what checking does, then hands over the grant a signed read returns", async () => {
    const user = userEvent.setup();
    renderQueue();
    expect(screen.getByText(/show how many wait on the Members tab/)).toBeInTheDocument();
    expect(onCountGrant).not.toHaveBeenCalled();

    // An older service returns no grant, and a failed read has none to give.
    await user.click(screen.getByRole("button", { name: "Check Who's Asking" }));
    loadQueue.mockRejectedValueOnce(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2));
    expect(onCountGrant).not.toHaveBeenCalled();

    const countGrant = { token: "grant.token", expiresAt: 4_000_000_000 };
    loadQueue.mockResolvedValueOnce({ ok: true, items: [], countGrant });
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(onCountGrant).toHaveBeenCalledWith(countGrant));
  });

  it("starts another garden's queue unchecked, so one garden's read never counts for it", async () => {
    const user = userEvent.setup();
    const { rerender } = renderQueue();
    await user.click(screen.getByRole("button", { name: "Check Who's Asking" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument()
    );

    const onRead = vi.fn();
    rerender(queueUi(onRead, "0x3333333333333333333333333333333333333333"));

    expect(screen.getByRole("button", { name: "Check Who's Asking" })).toBeInTheDocument();
    expect(onRead).not.toHaveBeenCalled();
  });

  it("requires and sends a decline reason", async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: "Decline" }));
    const reason = screen.getByLabelText(/Reason for declining/);
    expect(reason).toHaveAttribute("maxlength", "500");
    await user.type(reason, "No capacity this season.");
    await user.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() =>
      expect(resolveRequest).toHaveBeenCalledWith("request-1", {
        action: "decline",
        expectedRevision: 0,
        reason: "No capacity this season.",
      })
    );
  });

  it("resolves an already-held membership after the role operation confirms success", async () => {
    addGardener.mockResolvedValueOnce({
      success: true,
    });
    resolveRequest.mockResolvedValueOnce({ ok: true, pendingOnchainMembership: false });
    const user = userEvent.setup();
    renderQueue();

    await user.click(screen.getByRole("button", { name: "Welcome" }));

    await waitFor(() =>
      expect(resolveRequest).toHaveBeenCalledWith("request-1", {
        action: "welcome",
        expectedRevision: 0,
      })
    );
    expect(await screen.findByText("The gardener was welcomed.")).toBeVisible();
  });

  it("treats a declined signature as a choice, not a failure", async () => {
    resolveRequest.mockRejectedValueOnce(new Error("User rejected the request."));
    const user = userEvent.setup();
    renderQueue();

    await user.click(screen.getByRole("button", { name: "Welcome" }));
    await waitFor(() => expect(resolveRequest).toHaveBeenCalledOnce());

    await waitFor(() => expect(screen.getByRole("button", { name: "Welcome" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows decline failures inside the open dialog", async () => {
    resolveRequest.mockRejectedValueOnce(new Error("The request changed. Refresh and retry."));
    const user = userEvent.setup();
    renderQueue();

    await user.click(screen.getByRole("button", { name: "Decline" }));
    const reason = screen.getByLabelText(/Reason for declining/);
    await user.type(reason, "No capacity this season.");
    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The request changed. Refresh and retry."
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(reason).toHaveValue("No capacity this season.");
  });

  it("shows aggregate request pressure without exposing applicant details", () => {
    rateLimitedRecently = true;
    renderQueue();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Some people couldn't ask to join recently because of the rate limit."
    );
  });

  it("renders resolution transport errors through locale messages", () => {
    mutationError = new GardenJoinRequestTransportError(
      "The request changed. Refresh and retry.",
      409,
      "resolution_conflict"
    );

    renderQueue();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This changed or was already used. Check its status and try again."
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "The request changed. Refresh and retry."
    );
  });

  it("assigns the steward role for stewardship requests and never gardener membership", async () => {
    stewardship = true;
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: "Approve Steward Access" }));
    await waitFor(() =>
      expect(addSteward).toHaveBeenCalledWith("0x2222222222222222222222222222222222222222", {
        trackMemberAnalytics: false,
      })
    );
    expect(addGardener).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Welcome" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(resolveRequest).toHaveBeenCalledWith("request-1", {
        action: "welcome",
        expectedRevision: 0,
      })
    );
    expect(await screen.findByText("Steward access was confirmed.")).toBeVisible();
  });

  it("keeps a stewardship request pending when the assigned role is not confirmed", async () => {
    stewardship = true;
    resolveRequest.mockResolvedValueOnce({
      ok: true,
      pendingOnchainMembership: false,
      pendingOnchainRole: true,
    } as Awaited<ReturnType<typeof resolveRequest>>);
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: "Approve Steward Access" }));
    expect(await screen.findByText("Steward assignment is pending.")).toBeVisible();
    expect(screen.queryByText("Steward access was confirmed.")).not.toBeInTheDocument();
  });

  it("keeps a cancelled steward assignment undecided without an error", async () => {
    stewardship = true;
    addSteward.mockRejectedValueOnce(new Error("User rejected the request."));
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: "Approve Steward Access" }));
    await waitFor(() => expect(addSteward).toHaveBeenCalledOnce());
    expect(resolveRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Steward Access" })).toBeEnabled();
  });

  it.each([
    false,
    true,
  ])("does not sign a resolution when assignment fails (steward=%s)", async (isSteward) => {
    stewardship = isSteward;
    const assign = isSteward ? addSteward : addGardener;
    assign.mockResolvedValueOnce({
      success: false,
      error: { name: "OperationFailed", message: "Role assignment failed." },
    });
    const user = userEvent.setup();
    renderQueue();
    await user.click(
      screen.getByRole("button", { name: isSteward ? "Approve Steward Access" : "Welcome" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Role assignment failed.");
    expect(resolveRequest).not.toHaveBeenCalled();
    expect(screen.queryByText("Steward access was confirmed.")).not.toBeInTheDocument();
  });

  it.each([
    false,
    true,
  ])("does not sign a resolution after an operation reports cancellation (steward=%s)", async (isSteward) => {
    stewardship = isSteward;
    const assign = isSteward ? addSteward : addGardener;
    assign.mockResolvedValueOnce({
      success: false,
      error: { name: "UserRejected", message: "User rejected the request." },
    });
    const user = userEvent.setup();
    renderQueue();
    await user.click(
      screen.getByRole("button", { name: isSteward ? "Approve Steward Access" : "Welcome" })
    );
    await waitFor(() => expect(assign).toHaveBeenCalledOnce());
    expect(resolveRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
