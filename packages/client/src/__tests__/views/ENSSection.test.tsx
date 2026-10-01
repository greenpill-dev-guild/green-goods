/**
 * ENSSection Tests
 * @vitest-environment happy-dom
 */

/**
 * The Account tab's Username section (PRD-1026): what the card offers in each
 * state, and the Change Username sheet it opens for each kind of account. The
 * controller is a stand-in: where the name stands and the change's two steps
 * are proven in Shared (`username.test.ts`, `useUsernameController.test.tsx`).
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsernameCardState } from "@green-goods/shared/hooks/client-ui/profile/useUsernameController";

const PRIMARY_ADDRESS = "0x1234567890123456789012345678901234567890" as const;

const mocks = vi.hoisted(() => ({
  card: { kind: "ready", slug: "ines" } as UsernameCardState,
  isOnline: true,
  changeBySupport: false,
  typed: "",
  available: undefined as boolean | undefined,
  free: {} as Record<string, boolean>,
  fee: { isSuccess: true, isError: false, data: "500000000000000" as string | null },
  acts: {
    claim: vi.fn(async () => true),
    startChange: vi.fn(async () => undefined),
    chooseAnother: vi.fn(),
    checkStatus: vi.fn(),
  },
  navigate: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/client-ui/profile/useUsernameController", async () => {
  const { useSlugForm } = await import("@green-goods/shared/hooks/ens/useSlugForm");
  return {
    useUsernameController: () => {
      const slugForm = useSlugForm(mocks.typed);
      return {
        isOnline: mocks.isOnline,
        card: mocks.card,
        currentSlug: "ines",
        changeBySupport: mocks.changeBySupport,
        form: {
          slugForm,
          typed: slugForm.watch("slug"),
          available: mocks.available,
          checking: false,
        },
        isCheckingStatus: false,
        isClaiming: false,
        isReleasing: false,
        acts: mocks.acts,
      };
    },
  };
});
vi.mock("@green-goods/shared/hooks/ens/useENSReleaseName", () => ({
  useENSReleaseFee: () => mocks.fee,
}));
vi.mock("@green-goods/shared/hooks/ens/useSlugAvailability", () => ({
  useSlugAvailability: (slug?: string) => ({
    data: slug ? mocks.free[slug] : undefined,
    isFetching: false,
  }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

import { ENSSection } from "../../views/Profile/ENSSection";

function renderSection() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: {} },
        createElement(ENSSection, { primaryAddress: PRIMARY_ADDRESS })
      )
    )
  );
}

const sheet = () => screen.getByTestId("app-sheet");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.card = { kind: "ready", slug: "ines" };
  mocks.isOnline = true;
  mocks.changeBySupport = false;
  mocks.typed = "";
  mocks.available = undefined;
  mocks.free = {};
  mocks.fee = { isSuccess: true, isError: false, data: "500000000000000" };
  window.localStorage.clear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) },
  });
});

afterEach(() => {
  cleanup();
});

describe("Profile ENSSection", () => {
  it("reads a ready name on one row and opens a wallet's change with its fee and two steps", async () => {
    renderSection();
    expect(screen.getByText("ines.greengoods.eth")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("People can use this name to find your work.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change Username" }));

    const steps = within(sheet()).getByTestId("change-username-steps");
    expect(within(sheet()).getByText("Your username is ines.greengoods.eth.")).toBeInTheDocument();
    expect(steps).toHaveTextContent(
      "Now, your wallet releases ines.greengoods.eth for a 0.0005 ETH fee."
    );
    expect(steps).toHaveTextContent("In about 15–20 minutes, your wallet claims the new name.");
    const submit = within(sheet()).getByTestId("change-username-submit");
    expect(submit).toBeDisabled();

    mocks.free["ines-duarte"] = true;
    await userEvent.type(within(sheet()).getByLabelText("New username"), "ines-duarte");
    expect(steps).toHaveTextContent("your wallet claims ines-duarte.greengoods.eth.");
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.acts.startChange).toHaveBeenCalledWith("ines-duarte"));
  });

  it("releases nothing while the fee can't be read", async () => {
    mocks.fee = { isSuccess: false, isError: true, data: null };
    mocks.free["ines-duarte"] = true;
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Change Username" }));
    await userEvent.type(within(sheet()).getByLabelText("New username"), "ines-duarte");

    expect(within(sheet()).getByTestId("change-username-steps")).toHaveTextContent(
      "The fee couldn’t be read, so nothing can be released yet."
    );
    expect(within(sheet()).getByTestId("change-username-submit")).toBeDisabled();
  });

  it("prepares a support request for a passkey account's change", async () => {
    mocks.changeBySupport = true;
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Change Username" }));

    expect(
      within(sheet()).getByText(
        "Your username is ines.greengoods.eth. For passkey accounts, support helps with the change for now."
      )
    ).toBeInTheDocument();
    await userEvent.type(within(sheet()).getByLabelText("Desired username"), "ines-duarte");
    await userEvent.type(within(sheet()).getByLabelText("Contact"), "@ines_d");
    fireEvent.click(within(sheet()).getByRole("button", { name: "Add a Note" }));
    await userEvent.type(within(sheet()).getByLabelText("Notes"), "New phone");
    fireEvent.click(within(sheet()).getByRole("button", { name: "Prepare Request" }));

    const prepared = await within(sheet()).findByTestId("ens-change-request-prepared");
    const receipt = within(prepared).getByLabelText("Request details");
    expect((receipt as HTMLTextAreaElement).value).toContain(
      "Desired name: ines-duarte.greengoods.eth\nReason: I still use this sign-in\nContact: @ines_d\nNotes: New phone"
    );
    expect(
      within(sheet()).getByRole("button", { name: "Open Telegram Support" })
    ).toBeInTheDocument();
  });

  it.each([
    [true, "We couldn’t check your name. Try again in a moment.", "Check Status"],
    [
      false,
      "You’re offline. Your name’s status updates when you’re back online.",
      "Go Online to Check",
    ],
  ])("offers only a new check while the status is unknown (online: %s)", (online, sentence, action) => {
    mocks.isOnline = online;
    mocks.card = { kind: "unknown", slug: "ines" };
    renderSection();

    expect(screen.getByText("Status unknown")).toBeInTheDocument();
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Username" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(mocks.acts.checkStatus).toHaveBeenCalledTimes(online ? 1 : 0);
  });

  it("asks for the chosen name's claim at step 2, or another name", () => {
    mocks.card = { kind: "claimable", to: "ines-duarte" };
    renderSection();

    expect(screen.getByText("ines-duarte.greengoods.eth")).toBeInTheDocument();
    expect(screen.getByText("Changing · 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claim ines-duarte" }));
    expect(mocks.acts.claim).toHaveBeenCalledWith("ines-duarte");
    fireEvent.click(screen.getByRole("button", { name: "Choose Another" }));
    expect(mocks.acts.chooseAnother).toHaveBeenCalled();
  });

  it("claims a first name only once it reads as free", async () => {
    mocks.card = { kind: "choose", after: "none", taken: null };
    mocks.typed = "ines";
    renderSection();
    const claim = screen.getByRole("button", { name: "Claim Name" });
    expect(screen.getByText("4/50")).toBeInTheDocument();
    expect(claim).toBeDisabled();

    mocks.available = true;
    cleanup();
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Claim Name" }));

    await waitFor(() => expect(mocks.acts.claim).toHaveBeenCalledWith("ines"));
  });

  it("sends an account outside every garden to the open gardens", () => {
    mocks.card = { kind: "locked" };
    renderSection();

    expect(screen.getByText("Not available yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Gardens" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/home");
  });
});
