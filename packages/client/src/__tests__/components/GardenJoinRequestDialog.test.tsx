import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GardenJoinRequestTransportError } from "@green-goods/shared/modules/garden-join-requests";
import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";

const submitRequest = vi.fn(async () => ({ id: "request-1", state: "pending" }));
const checkStatus = vi.fn(async () => null);
const withdrawRequest = vi.fn(async () => true);
const scrollFeedbackIntoView = vi.fn();
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
  hasCheckedStatus: false,
  scopeKey: "account-a",
  outcomeUnknown: false,
  canRefreshStatus: false,
  request: null as { id: string; state: string } | null,
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@green-goods/shared/hooks/garden/useGardenJoinRequests")
  >()),
  useGardenJoinRequestAvailability: () => true,
  useGardenJoinRequests: () => ({
    request: hookState.request,
    scopeKey: hookState.scopeKey,
    outcomeUnknown: hookState.outcomeUnknown,
    canRefreshStatus: hookState.canRefreshStatus,
    hasCheckedStatus: hookState.hasCheckedStatus,
    statusState: { isLoading: hookState.statusLoading, error: hookState.statusError },
    mutationState: { isLoading: hookState.mutationLoading, error: hookState.mutationError },
    submitRequest,
    checkStatus,
    withdrawRequest,
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
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scrollFeedbackIntoView);
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
    hookState.hasCheckedStatus = false;
    hookState.scopeKey = "account-a";
    hookState.outcomeUnknown = false;
    hookState.canRefreshStatus = false;
    hookState.request = null;
  });

  it("requires a display name and submits an optional note", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
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
        <IntlProvider locale="en" messages={enMessages}>
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
        <IntlProvider locale="en" messages={enMessages}>
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
        <IntlProvider locale="en" messages={enMessages}>
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
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    expect(checkStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    expect(screen.getByText(/Confirm with your wallet or passkey/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
    expect(checkStatus).toHaveBeenCalledOnce();
    expect(await screen.findByText("Checked just now.")).toBeVisible();
    expect(scrollFeedbackIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "instant" });
  });

  it("names checking immediately and keeps the action busy until the visible result", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
    expect(checkStatus).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Checking for updates…");
    expect(screen.getByRole("button", { name: "Checking…" })).toHaveAttribute("aria-busy", "true");
    await screen.findByText("Checked just now.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: "Check Request Status" })).not.toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("refreshes cached pending status on open and keeps refresh available", async () => {
    hookState.request = { id: "pending-1", state: "pending" };
    hookState.canRefreshStatus = true;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    expect(checkStatus).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Checked just now/)).not.toBeInTheDocument();
    expect(scrollFeedbackIntoView).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
    expect(checkStatus).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Checked just now.")).toBeVisible();
    expect(scrollFeedbackIntoView).toHaveBeenCalled();
  });

  it("does not present an earlier check as a fresh result when reopened", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
    expect(await screen.findByText(/Checked just now/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    expect(screen.queryByText(/Checked just now/)).not.toBeInTheDocument();
    expect(checkStatus).toHaveBeenCalledOnce();
  });

  it("brings withdrawal feedback into view before the form", async () => {
    hookState.request = { id: "pending-1", state: "pending" };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.click(screen.getByRole("button", { name: "Withdraw Request" }));
    expect(withdrawRequest).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Your request was withdrawn/)).toBeVisible();
    expect(scrollFeedbackIntoView).toHaveBeenCalled();
  });

  it.each([
    "automatic",
    "explicit",
  ] as const)("shows a failed withdrawal after an %s status refresh", async (refresh) => {
    hookState.request = { id: "pending-1", state: "pending" };
    hookState.canRefreshStatus = refresh === "automatic";
    withdrawRequest.mockImplementationOnce(async () => {
      const error = new GardenJoinRequestTransportError("Unavailable", 503, "provider_unavailable");
      hookState.mutationError = error;
      throw error;
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    if (refresh === "explicit") {
      await user.click(screen.getByRole("button", { name: "Check Request Status" }));
      await screen.findByText("Checked just now.");
    }
    await waitFor(() =>
      expect(checkStatus).toHaveBeenCalledWith({ allowSignature: refresh === "explicit" })
    );
    await user.click(screen.getByRole("button", { name: "Withdraw Request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Garden join requests are unavailable right now. Please try again later."
    );
    expect(withdrawRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Withdraw Request" })).toBeEnabled();
    expect(screen.queryByText(/Your request was withdrawn/)).not.toBeInTheDocument();
  });

  it("keeps an uncertain save blocked after dialog remount", async () => {
    hookState.outcomeUnknown = true;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.type(screen.getByLabelText("Display name"), "Maya");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not confirm whether your request was saved"
    );
    expect(screen.getByRole("button", { name: "Send Request" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("blocks another submission until an unknown outcome is checked", async () => {
    hookState.hasCheckedStatus = true;
    submitRequest.mockRejectedValueOnce(
      new GardenJoinRequestTransportError("Service unavailable.", 503, "internal_error", true)
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.type(screen.getByLabelText("Display name"), "Maya");
    await user.click(screen.getByRole("button", { name: "Send Request" }));

    expect(scrollFeedbackIntoView).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not confirm whether your request was saved"
    );
    expect(
      screen.queryByText("You do not have a request for this garden yet.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Request" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Check Request Status" }));
    expect(checkStatus).toHaveBeenCalledOnce();
    await screen.findByText("Checked just now.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Request" })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("explains a known pre-save failure and leaves retry available", async () => {
    hookState.mutationError = new GardenJoinRequestTransportError(
      "Unavailable",
      503,
      "request_not_saved"
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IntlProvider locale="en" messages={enMessages}>
          <GardenJoinRequestDialog gardenAddress="0x1111111111111111111111111111111111111111" />
        </IntlProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Request to Join" }));
    await user.type(screen.getByLabelText("Display name"), "Maya");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This attempt did not save a request. Please try again."
    );
    expect(screen.getByRole("button", { name: "Send Request" })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.queryByText(/could not confirm whether/)).not.toBeInTheDocument();
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
        <IntlProvider locale="en" messages={enMessages}>
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
