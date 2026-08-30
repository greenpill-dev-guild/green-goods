import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GardenJoinRequestTransportError } from "@green-goods/shared/modules/garden-join-requests";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";

const submitRequest = vi.fn(async () => ({ id: "request-1", state: "pending" }));
const checkStatus = vi.fn(async () => null);
const hookState = vi.hoisted(() => ({
  mutationError: null as Error | null,
  mutationLoading: false,
  statusError: null as Error | null,
  statusLoading: false,
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useGardenJoinRequestAvailability: () => true,
  useGardenJoinRequests: () => ({
    request: null,
    hasCheckedStatus: false,
    statusState: { isLoading: hookState.statusLoading, error: hookState.statusError },
    mutationState: { isLoading: hookState.mutationLoading, error: hookState.mutationError },
    submitRequest,
    checkStatus,
    withdrawRequest: vi.fn(),
  }),
}));

import { GardenJoinRequestDialog } from "../../components/Features/Garden/GardenJoinRequestDialog";

describe("GardenJoinRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.mutationError = null;
    hookState.mutationLoading = false;
    hookState.statusError = null;
    hookState.statusLoading = false;
  });

  it("requires a display name and submits an optional note", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    const send = screen.getByRole("button", { name: "Send Request" });
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
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.click(screen.getByRole("button", { name: "Check request status" }));
    expect(checkStatus).toHaveBeenCalledOnce();
  });

  it("blocks another submission until an unknown outcome is checked", async () => {
    submitRequest.mockRejectedValueOnce(
      new GardenJoinRequestTransportError("Service unavailable.", 503, "internal_error", true)
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.type(screen.getByLabelText("Display name"), "Maya");
    await user.click(screen.getByRole("button", { name: "Send Request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not confirm whether your request was saved"
    );
    expect(screen.getByRole("button", { name: "Send Request" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Check request status" }));
    expect(checkStatus).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Request" })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it.each([
    {
      locale: "es",
      messages: esMessages,
      error: new GardenJoinRequestTransportError(
        "You are already a member of this garden.",
        409,
        "already_member"
      ),
      expected: "Ya eres miembro de este jardín.",
    },
    {
      locale: "pt",
      messages: ptMessages,
      error: new Error("Unable to send your join request."),
      expected: "Não foi possível concluir a solicitação. Tente novamente.",
    },
  ])("localizes $locale transport and fallback errors", async ({
    locale,
    messages,
    error,
    expected,
  }) => {
    hookState.mutationError = error;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale={locale} messages={messages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: messages["app.garden.joinRequest.action"] })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("alert")).not.toHaveTextContent(error.message);
  });

  it("disables status checks while a submission is in flight", async () => {
    hookState.mutationLoading = true;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));

    expect(screen.getByRole("button", { name: "Check request status" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});
