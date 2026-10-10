import { GardenJoinRequestTransportError } from "@green-goods/shared/modules/garden-join-requests";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadQueue = vi.fn(async () => ({ ok: true, items: [] }));
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
  "app.garden.joinQueue.membershipAddFailed": "Membership could not be added.",
  "app.garden.joinQueue.rateLimitedNotice": "Some join requests were rate-limited recently.",
  "app.garden.joinRequest.error.conflict":
    "This request changed or was already used. Check its status and try again.",
  "cockpit.community.joinRequests.confirmDecline": "Decline Request",
  "cockpit.community.joinRequests.decline": "Decline",
  "cockpit.community.joinRequests.declined": "The request was declined.",
  "cockpit.community.joinRequests.declineDescription": "Decline {name}'s request.",
  "cockpit.community.joinRequests.declineTitle": "Decline Join Request",
  "cockpit.community.joinRequests.description": "Review pending requests.",
  "cockpit.community.joinRequests.empty": "No pending requests.",
  "cockpit.community.joinRequests.load": "Check Requests",
  "cockpit.community.joinRequests.membershipPending": "Membership pending.",
  "cockpit.community.joinRequests.reason": "Reason for declining",
  "cockpit.community.joinRequests.title": "Join Requests",
  "cockpit.community.joinRequests.updateFailed": "The request could not be updated.",
  "cockpit.community.joinRequests.welcome": "Welcome",
  "cockpit.community.joinRequests.welcomed": "The gardener was welcomed.",
  "cockpit.community.stewardRequests.title": "Steward Access Requests",
  "cockpit.community.stewardRequests.description": "Assign the steward role to the account shown.",
  "cockpit.community.stewardRequests.approve": "Approve Steward Access",
  "cockpit.community.stewardRequests.confirmed": "Steward access was confirmed.",
  "cockpit.community.stewardRequests.pending": "Steward assignment is pending.",
};

function renderQueue() {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <CommunityJoinRequests gardenAddress="0x1111111111111111111111111111111111111111" />
    </IntlProvider>
  );
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
    await user.click(screen.getByRole("button", { name: "Check Requests" }));
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

  it("requires and sends a decline reason", async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: "Decline" }));
    const reason = screen.getByLabelText(/Reason for declining/);
    expect(reason).toHaveAttribute("maxlength", "500");
    await user.type(reason, "No capacity this season.");
    await user.click(screen.getByRole("button", { name: "Decline Request" }));
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
    await user.click(screen.getByRole("button", { name: "Decline Request" }));

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
      "Some join requests were rate-limited recently."
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
      "This request changed or was already used. Check its status and try again."
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
