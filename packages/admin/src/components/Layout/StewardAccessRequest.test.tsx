import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { StewardAccessRequestController } from "@green-goods/shared/hooks/admin-ui/layout/useStewardAccessRequestController";
import type { Garden } from "@green-goods/shared/types/domain";
import type { GardenJoinRequestSelfRecord } from "@green-goods/shared/public-contracts/join-requests";
import messages from "@green-goods/shared/i18n/en.json";
import { StewardAccessRequest } from "./StewardAccessRequest";
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

const garden = {
  id: "0x1111111111111111111111111111111111111111",
  name: "Comunidad Verde",
  location: "Quito",
} as Garden;
function cachedRequest(state: "pending" | "welcomed"): GardenJoinRequestSelfRecord {
  return {
    id: "request-1",
    kind: "steward_access",
    state,
    revision: 1,
    requestedVia: "admin_access",
    requestedAt: "2026-10-07T12:00:00.000Z",
    expiresAt: "2026-10-21T12:00:00.000Z",
    canAskAgain: state === "welcomed",
  };
}
function controller(
  overrides: Partial<StewardAccessRequestController> = {}
): StewardAccessRequestController {
  return {
    accountAddress: "0x2222222222222222222222222222222222222222",
    available: true,
    serviceLoading: false,
    serviceError: null,
    retryAvailability: vi.fn(),
    busy: false,
    open: true,
    setOpen: vi.fn(),
    step: "choose",
    setStep: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    note: "",
    setNote: vi.fn(),
    selectedGarden: null,
    candidates: [garden],
    invalidLink: false,
    catalogLoading: false,
    catalogError: false,
    reloadGardens: vi.fn(),
    request: null,
    hasCheckedStatus: false,
    outcomeUnknown: false,
    canRefreshStatus: false,
    error: null,
    activity: null,
    selectGarden: vi.fn(),
    send: vi.fn(async () => undefined),
    check: vi.fn(async () => undefined),
    withdraw: vi.fn(async () => undefined),
    ...overrides,
  } as StewardAccessRequestController;
}
function renderRequest(c: StewardAccessRequestController) {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <StewardAccessRequest controller={c} showStatus />
    </IntlProvider>
  );
}

describe("StewardAccessRequest", () => {
  it("selects a named garden without sending or checking a signed request", () => {
    const c = controller();
    renderRequest(c);
    fireEvent.click(screen.getByRole("button", { name: /Comunidad Verde/ }));
    expect(c.selectGarden).toHaveBeenCalledWith(garden);
    expect(c.send).not.toHaveBeenCalled();
    expect(c.check).not.toHaveBeenCalled();
  });
  it("reviews the primary account and optional note before sending", () => {
    const c = controller({ selectedGarden: garden, step: "review" });
    renderRequest(c);
    expect(screen.getByText("Account to receive steward access")).toBeVisible();
    expect(screen.getByRole("button", { name: /copy/i })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "I coordinate seed swaps." },
    });
    expect(c.setNote).toHaveBeenCalledWith("I coordinate seed swaps.");
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    expect(c.send).toHaveBeenCalledOnce();
  });
  it("shows pending review and withdrawal without claiming steward access", () => {
    const c = controller({
      selectedGarden: garden,
      step: "review",
      request: {
        id: "request-1",
        kind: "steward_access",
        state: "pending",
        revision: 0,
        requestedVia: "admin_access",
        requestedAt: "2026-10-07T12:00:00.000Z",
        expiresAt: "2026-10-21T12:00:00.000Z",
        canAskAgain: false,
      },
    });
    renderRequest(c);
    expect(screen.getAllByText("Pending review")).toHaveLength(2);
    expect(screen.queryByText("Steward access confirmed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw Request" }));
    expect(c.withdraw).toHaveBeenCalledOnce();
  });
  it("offers address sharing when the deployed API does not advertise stewardship", () => {
    const c = controller({ available: false });
    renderRequest(c);
    expect(screen.getByText(/Steward requests are unavailable right now/)).toBeVisible();
    expect(screen.getByRole("button", { name: /copy/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
  });
  it("requires checking an uncertain send outcome before retrying", () => {
    const c = controller({ selectedGarden: garden, step: "review", outcomeUnknown: true });
    renderRequest(c);
    expect(screen.getByRole("button", { name: "Send Request" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check Status" }));
    expect(c.check).toHaveBeenCalledOnce();
  });
  it("shows availability loading before claiming that requests are unavailable", () => {
    renderRequest(controller({ available: false, serviceLoading: true }));
    expect(screen.getByText("Checking request availability…")).toBeVisible();
    expect(
      screen.queryByText(/Steward requests are unavailable right now/)
    ).not.toBeInTheDocument();
  });

  it("shows a welcomed request as confirmation even when the API allows asking again", () => {
    const c = controller({
      selectedGarden: garden,
      step: "review",
      request: cachedRequest("welcomed"),
    });
    renderRequest(c);
    expect(screen.getAllByText("Steward access confirmed")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw Request" })).not.toBeInTheDocument();
  });

  it.each([
    "pending",
    "welcomed",
  ] as const)("lets a %s requester choose another garden without altering the existing request", (state) => {
    const c = controller({ selectedGarden: garden, step: "review", request: cachedRequest(state) });
    const { rerender } = renderRequest(c);
    fireEvent.click(screen.getByRole("button", { name: "Change Garden" }));
    expect(c.setStep).toHaveBeenCalledWith("choose");
    expect(c.withdraw).not.toHaveBeenCalled();
    expect(c.send).not.toHaveBeenCalled();
    c.step = "choose";
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <StewardAccessRequest controller={c} showStatus />
      </IntlProvider>
    );
    expect(screen.getByLabelText("Garden name or link")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Comunidad Verde/ }));
    expect(c.selectGarden).toHaveBeenCalledWith(garden);
    expect(c.withdraw).not.toHaveBeenCalled();
    expect(c.send).not.toHaveBeenCalled();
  });

  it("reopens a selected request at its status after leaving the garden picker", () => {
    const c = controller({
      selectedGarden: garden,
      step: "choose",
      open: false,
      request: cachedRequest("pending"),
    });
    renderRequest(c);
    fireEvent.click(screen.getByRole("button", { name: "View Steward Request" }));
    expect(c.setStep).toHaveBeenCalledWith("review");
    expect(c.setOpen).toHaveBeenCalledWith(true);
    expect(c.send).not.toHaveBeenCalled();
    expect(c.withdraw).not.toHaveBeenCalled();
  });
});
