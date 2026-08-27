import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const submitRequest = vi.fn(async () => ({ id: "request-1", state: "pending" }));
const checkStatus = vi.fn(async () => null);

vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useGardenJoinRequests: () => ({
    request: null,
    hasCheckedStatus: false,
    statusState: { isLoading: false, error: null },
    mutationState: { isLoading: false, error: null },
    submitRequest,
    checkStatus,
    withdrawRequest: vi.fn(),
  }),
}));

import { GardenJoinRequestDialog } from "../../components/Features/Garden/GardenJoinRequestDialog";

describe("GardenJoinRequestDialog", () => {
  it("requires a display name and submits an optional note", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to join" }));
    const send = screen.getByRole("button", { name: "Send request" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    await user.type(screen.getByLabelText("Display name"), "Maya");
    await user.type(screen.getByLabelText("Note (optional)"), "I can help with seedlings.");
    await user.click(send);

    expect(submitRequest).toHaveBeenCalledWith({
      displayName: "Maya",
      note: "I can help with seedlings.",
      requestedVia: "garden_detail",
    });
    expect(await screen.findByText("Your request was sent to the garden stewards.")).toBeVisible();
  });

  it("checks status only after an explicit action", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    expect(checkStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Request to join" }));
    await user.click(screen.getByRole("button", { name: "Check request status" }));
    expect(checkStatus).toHaveBeenCalledOnce();
  });
});
