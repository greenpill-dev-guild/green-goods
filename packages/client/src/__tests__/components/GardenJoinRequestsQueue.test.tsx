import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GardenJoinRequestsQueue } from "@/components/Features/Garden/GardenJoinRequestsQueue";

const { addGardener, resolveRequest } = vi.hoisted(() => ({
  addGardener: vi.fn(),
  resolveRequest: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useGardenJoinRequestAvailability: () => true,
  useGardenJoinRequests: () => ({
    queue: [
      {
        id: "request-1",
        accountAddress: "0x2222222222222222222222222222222222222222",
        displayName: "Maya",
        state: "pending",
        revision: 3,
        requestedAt: "2026-08-27T12:00:00.000Z",
      },
    ],
    queueState: { isLoading: false, error: null },
    mutationState: { isLoading: false, error: null },
    resolveRequest,
  }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ addGardener }),
}));

function renderQueue() {
  return render(
    <IntlProvider locale="en">
      <GardenJoinRequestsQueue gardenAddress="0x1111111111111111111111111111111111111111" />
    </IntlProvider>
  );
}

describe("GardenJoinRequestsQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addGardener.mockResolvedValue({ success: true });
    resolveRequest.mockResolvedValue({ pendingOnchainMembership: false });
  });

  it("shows the assignment error without requesting resolution signing", async () => {
    addGardener.mockResolvedValue({
      success: false,
      error: { name: "OperationFailed", message: "Membership could not be added." },
    });
    renderQueue();
    await userEvent.click(screen.getByRole("button", { name: "Welcome" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Membership could not be added.");
    expect(resolveRequest).not.toHaveBeenCalled();
  });

  it("leaves a cancelled assignment pending without another signature or error", async () => {
    addGardener.mockResolvedValue({
      success: false,
      error: { name: "UserRejected", message: "User rejected the request." },
    });
    renderQueue();
    await userEvent.click(screen.getByRole("button", { name: "Welcome" }));
    await waitFor(() => expect(addGardener).toHaveBeenCalledOnce());
    expect(resolveRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Welcome" })).toBeEnabled();
  });

  it("shows a confirmed welcome after successful assignment and resolution", async () => {
    renderQueue();
    await userEvent.click(screen.getByRole("button", { name: "Welcome" }));
    expect(await screen.findByText("The gardener was welcomed.")).toBeVisible();
    expect(resolveRequest).toHaveBeenCalledWith("request-1", {
      action: "welcome",
      expectedRevision: 3,
    });
  });

  it("keeps a submitted membership awaiting confirmation visible", async () => {
    resolveRequest.mockResolvedValue({ pendingOnchainMembership: true });
    renderQueue();
    await userEvent.click(screen.getByRole("button", { name: "Welcome" }));
    expect(await screen.findByText(/Confirm again after it is visible on-chain/)).toBeVisible();
    expect(screen.queryByText("The gardener was welcomed.")).not.toBeInTheDocument();
  });
});
