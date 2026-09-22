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
  // The account's names, best first: Green Goods name, ENS name, chosen passkey username.
  greenGoodsName: null as string | null,
  greenGoodsNameLoading: false,
  /** A refetch over a cached answer: fetching without loading. */
  greenGoodsNameRefetching: false,
  ensName: null as string | null,
  authMode: "passkey" as "passkey" | "wallet",
  userName: null as string | null,
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

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => ({ authMode: hookState.authMode, userName: hookState.userName }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({
    data: hookState.greenGoodsName,
    isLoading: hookState.greenGoodsNameLoading,
    isFetching: hookState.greenGoodsNameLoading || hookState.greenGoodsNameRefetching,
  }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: hookState.ensName, isLoading: false, isFetching: false }),
}));

import { GardenJoinRequestDialog } from "../../components/Features/Garden/GardenJoinRequestDialog";

describe("GardenJoinRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.greenGoodsName = null;
    hookState.greenGoodsNameLoading = false;
    hookState.greenGoodsNameRefetching = false;
    hookState.ensName = null;
    hookState.authMode = "passkey";
    hookState.userName = null;
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
    // Rides the adaptive shell: centered here, the shared bottom sheet below 640px.
    expect(screen.getByRole("dialog")).toHaveAttribute("data-component", "DialogShell");
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

  it.each([
    [
      "its Green Goods name",
      { greenGoodsName: "maya.greengoods.eth", ensName: "maya.eth" },
      "maya.greengoods.eth",
    ],
    ["its ENS name", { ensName: "maya.eth", userName: "maya" }, "maya.eth"],
    ["the username it chose", { userName: "maya" }, "maya"],
  ])("requests under %s without asking for a display name", async (_label, names, expected) => {
    Object.assign(hookState, names);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
    expect(screen.getByText(expected)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Send Request" }));

    expect(submitRequest).toHaveBeenCalledWith(expect.objectContaining({ displayName: expected }));
  });

  it.each([
    ["a generated username", { userName: "user_1726850000" }],
    // Auth keeps the last passkey username after a switch to a wallet.
    ["a wallet and an earlier passkey username", { authMode: "wallet", userName: "maya" }],
  ] as const)("asks an account with %s what to be called", async (_label, account) => {
    Object.assign(hookState, account);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));

    expect(screen.getByLabelText("Display name")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send Request" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it.each([
    ["is loading for the first time", { greenGoodsNameLoading: true }],
    // Claiming a username invalidates these keys, so a cached empty answer refetches.
    ["is refetching a cached empty answer", { greenGoodsNameRefetching: true }],
  ] as const)("waits while a name that outranks the username %s", async (_label, lookup) => {
    hookState.userName = "maya";
    Object.assign(hookState, lookup);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en">
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));

    expect(screen.queryByText("maya")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Request" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
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
    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
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

    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
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

    expect(screen.getByRole("button", { name: "Check Request Status" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});
