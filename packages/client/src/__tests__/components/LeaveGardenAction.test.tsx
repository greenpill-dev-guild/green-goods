import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import type { Garden } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveGardenAction } from "../../components/Features/Garden/LeaveGardenAction";
import { GardenMembershipCard } from "../../views/Profile/GardenMembershipCard";

const account = "0x2222222222222222222222222222222222222222";
const fakes = vi.hoisted(() => ({
  leave: vi.fn(),
  owner: false,
  listed: true,
  availability: "available" as "available" | "unavailable" | "unknown" | "checking",
  checkAvailability: vi.fn(),
  pending: false,
  recover: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x2222222222222222222222222222222222222222" }),
}));
vi.mock("@green-goods/shared/hooks/garden/useLeaveGarden", () => ({
  useLeaveGarden: () => ({
    leaveGarden: fakes.leave,
    isLeaving: false,
    availability: fakes.availability,
    checkAvailability: fakes.checkAvailability,
    hasPendingDeparture: fakes.pending,
    reconcileDeparture: fakes.recover,
  }),
}));
vi.mock("@green-goods/shared/hooks/roles/useGardenMembership", () => ({
  useGardenMembership: () => ({ isMember: fakes.listed, refetch: vi.fn() }),
}));
vi.mock("@green-goods/shared/hooks/roles/useHasRole", () => ({
  useHasRole: () => ({ hasRole: fakes.owner, refetch: vi.fn() }),
}));
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { error: fakes.error, success: fakes.success },
}));
const garden: Garden = {
  id: "0x1111111111111111111111111111111111111111",
  stewards: [],
  owners: [],
  evaluators: [],
  funders: [],
  communities: [],
  name: "Test garden",
  gardeners: [account as `0x${string}`],
  chainId: 11155111,
  tokenAddress: "0x1111111111111111111111111111111111111111",
  tokenID: 1n,
  description: "",
  location: "",
  bannerImage: "",
  createdAt: 1_700_000_000_000,
  assessments: [],
  works: [],
};
function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GardenMembershipCard
        garden={garden}
        role="gardener"
        onHome
        recovering={fakes.pending}
        onOpen={() => {}}
        onLeave={() => setOpen(true)}
      />
      <LeaveGardenAction
        garden={fakes.listed ? garden : { ...garden, gardeners: [] }}
        open={open}
        onClose={() => setOpen(false)}
        onConfirmed={() => setOpen(false)}
      />
    </>
  );
}
function setup(locale = "en", messages = en) {
  return render(
    <IntlProvider locale={locale} messages={messages}>
      <Fixture />
    </IntlProvider>
  );
}
function open(messages = en) {
  fireEvent.click(
    screen.getByRole("button", {
      name: (fakes.pending
        ? messages["app.garden.leave.recoveryTitle"]
        : messages["app.garden.leave.actionFor"]
      ).replace("{gardenName}", garden.name),
    })
  );
}
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    })),
  });
  vi.clearAllMocks();
  fakes.leave.mockReset();
  fakes.owner = false;
  fakes.listed = true;
  fakes.availability = "available";
  fakes.pending = false;
  fakes.recover.mockResolvedValue({ hash: "0xabc", departed: true });
  fakes.leave.mockResolvedValue({ hash: "0xabc", departed: true });
});
describe("LeaveGardenAction", () => {
  it.each([
    ["en", en],
    ["es", es],
    ["pt", pt],
  ])("warns in %s and cancel sends nothing", (locale, messages) => {
    setup(locale, messages);
    open(messages);
    expect(screen.getByText(messages["app.garden.leave.queue"])).toBeInTheDocument();
    expect(screen.getByText(messages["app.garden.leave.obligations"])).toBeInTheDocument();
    expect(screen.getByText(messages["app.garden.leave.rejoin"])).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: messages["app.common.cancel"] }));
    expect(fakes.leave).not.toHaveBeenCalled();
  });
  it("explains owner refusal without offering a signing action", () => {
    fakes.owner = true;
    setup();
    open();
    expect(screen.getByText(en["app.garden.leave.owner"])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave Garden" })).not.toBeInTheDocument();
    expect(fakes.leave).not.toHaveBeenCalled();
  });
  it("confirms once and reports the successful departure", async () => {
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
    await waitFor(() => expect(fakes.success).toHaveBeenCalled());
    expect(fakes.leave).toHaveBeenCalledTimes(1);
  });
  it("surfaces failure in the dialog and toast", async () => {
    fakes.leave.mockRejectedValue(new Error("RPC down"));
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(en["app.garden.leave.failed"])
    );
    expect(fakes.error).toHaveBeenCalled();
  });
  it("keeps the confirmation open when the signer cancels without claiming failure", async () => {
    fakes.leave.mockRejectedValue(
      Object.assign(new Error("User rejected the request"), { code: 4001 })
    );
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
    await waitFor(() => expect(fakes.leave).toHaveBeenCalled());
    expect(fakes.success).not.toHaveBeenCalled();
    expect(fakes.error).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("leave availability", () => {
  it.each([
    "checking",
    "unavailable",
    "unknown",
  ] as const)("never enables signing with %s capability", (state) => {
    fakes.availability = state;
    setup();
    open();
    const send = screen.getByRole("button", { name: "Leave Garden" });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(fakes.leave).not.toHaveBeenCalled();
    const key =
      state === "checking"
        ? "app.garden.leave.availabilityChecking"
        : state === "unavailable"
          ? "app.garden.leave.unavailable"
          : "app.garden.leave.availabilityFailed";
    expect(screen.getByText(en[key])).toBeInTheDocument();
  });
  it("retries unavailable capability and only enables after recovery", () => {
    fakes.availability = "unknown";
    const view = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: en["app.common.retry"] }));
    expect(fakes.checkAvailability).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Leave Garden" })).toBeDisabled();
    fakes.availability = "available";
    view.rerender(
      <IntlProvider locale="en" messages={en}>
        <Fixture />
      </IntlProvider>
    );
    expect(screen.getByRole("button", { name: "Leave Garden" })).toBeEnabled();
  });
});

const dismissals = [false, true].flatMap((narrow) =>
  ["Cancel", "Escape", "Close"].flatMap((dismiss) =>
    ["keyboard", "pointer"].map((entry) => ({ narrow, dismiss, entry }))
  )
);
describe("leave confirmation opener focus", () => {
  it.each(dismissals)("returns focus after $dismiss ($entry, narrow=$narrow)", async ({
    narrow,
    dismiss,
    entry,
  }) => {
    const media = vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: narrow && query.includes("639"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }));
    try {
      setup();
      const trigger = screen.getByRole("button", { name: "Leave Test garden" });
      if (entry === "pointer") fireEvent.pointerDown(trigger);
      else trigger.focus();
      fireEvent.click(trigger);
      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      expect(screen.getByRole("dialog")).toHaveAttribute("data-component", "PwaSheet");
      if (dismiss === "Escape") fireEvent.keyDown(document, { key: "Escape" });
      else fireEvent.click(screen.getByRole("button", { name: dismiss }));
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(fakes.leave).not.toHaveBeenCalled();
    } finally {
      media.mockRestore();
    }
  });
});

describe("pending departure recovery", () => {
  it.each([
    "unknown",
    "unavailable",
  ] as const)("keeps read-only recovery reachable without membership and with %s capability", async (capability) => {
    fakes.pending = true;
    fakes.listed = false;
    fakes.availability = capability;
    setup();
    open();
    const recover = screen.getByRole("button", { name: en["app.garden.leave.recover"] });
    expect(recover).toBeEnabled();
    expect(screen.getByText(en["app.garden.leave.recoveryInfo"])).toBeInTheDocument();
    fireEvent.click(recover);
    await waitFor(() =>
      expect(fakes.success).toHaveBeenCalledWith({ title: en["app.garden.leave.recoverySuccess"] })
    );
    expect(fakes.recover).toHaveBeenCalledOnce();
    expect(fakes.leave).not.toHaveBeenCalled();
    expect(fakes.checkAvailability).not.toHaveBeenCalled();
  });
  it("does not present an old receipt as a new departure after the account has rejoined as owner", async () => {
    fakes.pending = true;
    fakes.owner = true;
    setup();
    open();
    expect(
      screen.queryByRole("button", { name: en["app.garden.leave.action"] })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en["app.garden.leave.recover"] }));
    await waitFor(() =>
      expect(fakes.success).toHaveBeenCalledWith({ title: en["app.garden.leave.recoverySuccess"] })
    );
    expect(fakes.leave).not.toHaveBeenCalled();
  });
});

it("switches an uncertain send in the open dialog to read-only recovery before retry", async () => {
  fakes.leave.mockImplementation(async () => {
    fakes.pending = true;
    throw new Error("transaction-confirmation-pending");
  });
  setup();
  open();
  fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: en["app.garden.leave.recover"] })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole("button", { name: en["app.garden.leave.recover"] }));
  await waitFor(() =>
    expect(fakes.success).toHaveBeenCalledWith({ title: en["app.garden.leave.recoverySuccess"] })
  );
  expect(fakes.leave).toHaveBeenCalledOnce();
  expect(fakes.recover).toHaveBeenCalledOnce();
});

it("reports recovery rather than a new departure when a stored receipt wins a race with confirm", async () => {
  fakes.leave.mockResolvedValue({ hash: "0xabc", departed: false });
  setup();
  open();
  fireEvent.click(screen.getByRole("button", { name: "Leave Garden" }));
  await waitFor(() =>
    expect(fakes.success).toHaveBeenCalledWith({ title: en["app.garden.leave.recoverySuccess"] })
  );
});
