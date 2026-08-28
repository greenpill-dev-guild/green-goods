import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadQueue = vi.fn(async () => ({ ok: true, items: [] }));
const resolveRequest = vi.fn(async () => ({ ok: true, pendingOnchainMembership: false }));
const addGardener = vi.fn(async () => ({ success: true, hash: "0x1234" }));

vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useGardenJoinRequests: () => ({
    queue: [
      {
        id: "request-1",
        accountAddress: "0x2222222222222222222222222222222222222222",
        displayName: "Maya",
        note: "I can help with seedlings.",
        state: "pending",
        revision: 0,
      },
    ],
    nextCursor: undefined,
    queueState: { isLoading: false, error: null },
    mutationState: { isLoading: false, error: null },
    loadQueue,
    resolveRequest,
  }),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ addGardener, isLoading: false }),
}));

vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => <span>{address}</span>,
}));

import { CommunityJoinRequests } from "./CommunityJoinRequests";

const messages = {
  "app.common.cancel": "Cancel",
  "app.garden.joinQueue.membershipAddFailed": "Membership could not be added.",
  "cockpit.community.joinRequests.confirmDecline": "Decline request",
  "cockpit.community.joinRequests.decline": "Decline",
  "cockpit.community.joinRequests.declined": "The request was declined.",
  "cockpit.community.joinRequests.declineDescription": "Decline {name}'s request.",
  "cockpit.community.joinRequests.declineTitle": "Decline join request",
  "cockpit.community.joinRequests.description": "Review pending requests.",
  "cockpit.community.joinRequests.empty": "No pending requests.",
  "cockpit.community.joinRequests.load": "Check requests",
  "cockpit.community.joinRequests.membershipPending": "Membership pending.",
  "cockpit.community.joinRequests.reason": "Reason for declining",
  "cockpit.community.joinRequests.title": "Join requests",
  "cockpit.community.joinRequests.updateFailed": "The request could not be updated.",
  "cockpit.community.joinRequests.welcome": "Welcome",
  "cockpit.community.joinRequests.welcomed": "The gardener was welcomed.",
};

function renderQueue() {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <CommunityJoinRequests gardenAddress="0x1111111111111111111111111111111111111111" />
    </IntlProvider>
  );
}

describe("CommunityJoinRequests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads explicitly and welcomes through the on-chain membership operation first", async () => {
    const user = userEvent.setup();
    renderQueue();
    expect(loadQueue).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Check requests" }));
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
    await user.click(screen.getByRole("button", { name: "Decline request" }));
    await waitFor(() =>
      expect(resolveRequest).toHaveBeenCalledWith("request-1", {
        action: "decline",
        expectedRevision: 0,
        reason: "No capacity this season.",
      })
    );
  });

  it("shows decline failures inside the open dialog", async () => {
    resolveRequest.mockRejectedValueOnce(new Error("The request changed. Refresh and retry."));
    const user = userEvent.setup();
    renderQueue();

    await user.click(screen.getByRole("button", { name: "Decline" }));
    const reason = screen.getByLabelText(/Reason for declining/);
    await user.type(reason, "No capacity this season.");
    await user.click(screen.getByRole("button", { name: "Decline request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The request changed. Refresh and retry."
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(reason).toHaveValue("No capacity this season.");
  });
});
