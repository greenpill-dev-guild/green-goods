/**
 * ENSSection Tests
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@green-goods/shared/types/domain";

const mockUseENSRegistrationStatus = vi.fn((_slug?: string) => undefined);
const mockMutateAsync = vi.fn();
const mockReleaseMutateAsync = vi.fn();
const mockValidateSlug = vi.fn((_slug: string) => ({ valid: true }));
const mockClipboardWriteText = vi.fn(async () => undefined);
const mockTrigger = vi.fn(async () => true);
const mockGetValues = vi.fn(() => "river");
const mockReset = vi.fn();

let mockProtocolMember = true;
let mockProtocolMemberLoading = false;
let mockRegistrationData: Record<string, unknown> | undefined;
let mockSlugValue = "";
let mockExistingGreenGoodsEnsName: string | null = null;
let mockSponsoredReleaseUnavailable = false;

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...inputs: Array<string | undefined | null | false>) => inputs.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/utils/blockchain/ens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/utils/blockchain/ens")>()),
  validateSlug: (slug: string) => mockValidateSlug(slug),
}));

// The names the account already goes by, which seed the claim.
const mockNames = vi.hoisted(() => ({
  authMode: "passkey" as "passkey" | "wallet",
  userName: null as string | null,
  walletEnsName: null as string | null,
}));
const mockUseSlugForm = vi.hoisted(() => vi.fn());
vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => ({ authMode: mockNames.authMode, userName: mockNames.userName }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: mockNames.walletEnsName }),
}));

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@green-goods/shared/hooks/ens/useProtocolMemberStatus", () => ({
  useProtocolMemberStatus: () => ({
    data: mockProtocolMember,
    isLoading: mockProtocolMemberLoading,
  }),
}));

vi.mock("@green-goods/shared/hooks/ens/useSlugForm", () => ({
  useSlugForm: (suggestedSlug?: string) => {
    mockUseSlugForm(suggestedSlug);
    return {
      watch: (field: string) => (field === "slug" ? mockSlugValue : ""),
      register: () => ({}),
      trigger: mockTrigger,
      getValues: mockGetValues,
      reset: mockReset,
      formState: { errors: {}, isDirty: false },
    };
  },
}));

vi.mock("@green-goods/shared/hooks/ens/useSlugAvailability", () => ({
  useSlugAvailability: () => ({ data: true, isFetching: false }),
}));

vi.mock("@green-goods/shared/hooks/ens/useENSClaim", () => ({
  useENSClaim: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@green-goods/shared/hooks/ens/useENSReleaseName", () => ({
  useENSReleaseName: () => ({
    mutateAsync: mockReleaseMutateAsync,
    isPending: false,
    isSponsoredReleaseUnavailable: mockSponsoredReleaseUnavailable,
  }),
}));

vi.mock("@green-goods/shared/hooks/ens/useENSRegistrationStatus", () => ({
  useENSRegistrationStatus: (slug?: string) => {
    mockUseENSRegistrationStatus(slug);
    return { data: slug ? mockRegistrationData : undefined };
  },
}));

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: mockExistingGreenGoodsEnsName }),
}));

vi.mock("@green-goods/shared/components/Progress/ENSProgressTimeline", () => ({
  ENSProgressTimeline: ({ slug }: { slug: string; data: unknown }) =>
    createElement("div", { "data-testid": "ens-progress" }, slug),
}));

vi.mock("@green-goods/shared/components/Dialog/ConfirmDialog", () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    title,
    confirmLabel,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
    confirmLabel: string;
  }) =>
    isOpen
      ? createElement(
          "div",
          { "data-testid": "confirm-release-dialog", "aria-label": title },
          createElement(
            "button",
            { onClick: onConfirm, "data-testid": "confirm-release-button" },
            confirmLabel
          )
        )
      : null,
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

import { ENSSection } from "../../views/Profile/ENSSection";

const PRIMARY_ADDRESS = "0x1234567890123456789012345678901234567890" as const;

function ensSection(primaryAddress: Address = PRIMARY_ADDRESS) {
  return createElement(
    IntlProvider,
    { locale: "en", messages: {} },
    createElement(ENSSection, { primaryAddress })
  );
}

function renderENSSection(primaryAddress?: Address) {
  return render(ensSection(primaryAddress));
}

describe("Profile ENSSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProtocolMember = true;
    mockProtocolMemberLoading = false;
    mockRegistrationData = undefined;
    mockSlugValue = "";
    mockNames.authMode = "passkey";
    mockNames.userName = null;
    mockNames.walletEnsName = null;
    mockExistingGreenGoodsEnsName = null;
    mockSponsoredReleaseUnavailable = false;
    mockValidateSlug.mockReturnValue({ valid: true });
    window.localStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    mockMutateAsync.mockResolvedValue({});
    mockReleaseMutateAsync.mockResolvedValue({ slug: "forest" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows claim form for protocol members without an existing registration", () => {
    renderENSSection();

    expect(screen.getByText("Claim your name")).toBeInTheDocument();
    expect(screen.getByText("Claim your Green Goods name")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a personal name tied to your work. Registration takes about 15-20 minutes."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Claim Name")).toBeInTheDocument();
    expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ["the username chosen for the passkey", { userName: "Maya K", walletEnsName: null }, "maya-k"],
    ["the wallet's ENS label", { userName: "user_1726850000", walletEnsName: "maya.eth" }, "maya"],
    [
      "nothing when the account has no name",
      { userName: "user_1726850000", walletEnsName: null },
      "",
    ],
    // Auth keeps the last passkey username after a switch to a wallet.
    [
      "the wallet's ENS label over an earlier passkey username",
      { authMode: "wallet", userName: "Maya K", walletEnsName: "afo.eth" },
      "afo",
    ],
  ] as const)("starts the claim from %s", (_label, names, suggested) => {
    Object.assign(mockNames, names);

    renderENSSection();

    expect(mockUseSlugForm).toHaveBeenLastCalledWith(suggested);
  });

  it("replaces its own suggestion when the account changes, never something typed", () => {
    mockNames.walletEnsName = "maya.eth";
    mockGetValues.mockReturnValue("maya");
    const view = renderENSSection();

    mockNames.walletEnsName = "afo.eth";
    view.rerender(ensSection());
    expect(mockReset).toHaveBeenCalledWith({ slug: "afo" });

    mockReset.mockClear();
    mockGetValues.mockReturnValue("typed-name");
    mockNames.walletEnsName = "kit.eth";
    view.rerender(ensSection());
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("marks the claim unavailable with the join hint for gardeners without a garden", () => {
    mockProtocolMember = false;

    renderENSSection();

    expect(screen.getByText("Claim your name")).toBeInTheDocument();
    expect(screen.getByText("Claim your Green Goods name")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Not available yet");
    expect(status).toHaveTextContent("Join a garden to unlock your Green Goods name.");
    expect(screen.queryByText("Claim Name")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Choose your personal Green Goods name")
    ).not.toBeInTheDocument();
  });

  it("keeps the claim hidden until membership has resolved", () => {
    mockProtocolMember = false;
    mockProtocolMemberLoading = true;

    renderENSSection();

    expect(screen.queryByText("Claim your name")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides claim form after successful ENS claim and shows progress timeline", async () => {
    const user = userEvent.setup();
    mockSlugValue = "river";
    mockGetValues.mockReturnValue("river");
    mockRegistrationData = { status: "pending" };

    renderENSSection();

    expect(screen.getByText("Claim Name")).toBeInTheDocument();

    await user.click(screen.getByText("Claim Name"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ slug: "river" });
    });
    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("river");
    expect(screen.queryByText("Claim Name")).not.toBeInTheDocument();
  });

  it("hides claim form when registration is active", async () => {
    const user = userEvent.setup();
    mockSlugValue = "forest";
    mockGetValues.mockReturnValue("forest");
    mockRegistrationData = { status: "active" };

    renderENSSection();

    await user.click(screen.getByText("Claim Name"));

    await waitFor(() => {
      expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    });
    expect(screen.queryByText("Claim Name")).not.toBeInTheDocument();
  });

  it("hides claim form when the address already has a Green Goods ENS name", () => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };

    renderENSSection();

    expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith("forest");
    expect(screen.getAllByText("forest")).toHaveLength(2);
    expect(screen.getByText("Release Username")).toBeInTheDocument();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    expect(screen.queryByText("Claim Name")).not.toBeInTheDocument();
  });

  it("releases the current ENS name after confirmation", async () => {
    const user = userEvent.setup();
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };
    mockReleaseMutateAsync.mockResolvedValue({ slug: "forest" });

    renderENSSection();

    await user.click(screen.getByText("Release Username"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-release-dialog")).toBeInTheDocument();
    });
    expect(mockReleaseMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("confirm-release-button"));

    await waitFor(() => {
      expect(mockReleaseMutateAsync).toHaveBeenCalled();
    });
    expect(screen.getByText("Release started")).toBeInTheDocument();
  });

  it("prepares a support request when sponsored release is unavailable", async () => {
    const user = userEvent.setup();
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };
    mockSponsoredReleaseUnavailable = true;

    renderENSSection();

    const requestButton = screen.getByText("Request Username Change");
    expect(requestButton).not.toBeDisabled();
    expect(
      screen.getByText(
        "Username changes need a hand from support right now. We can either help you release this name or look into recovering it if you've lost access."
      )
    ).toBeInTheDocument();

    await user.click(requestButton);
    await user.type(screen.getByLabelText("Desired username"), "canopy");
    await user.type(screen.getByLabelText("Contact"), "@alice");
    await user.click(screen.getByText("Prepare request"));

    expect(mockReleaseMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Request ens-change-/)).toBeInTheDocument();
    expect((screen.getByLabelText("Request details") as HTMLTextAreaElement).value).toContain(
      "Desired name: canopy"
    );

    const stored = JSON.parse(
      window.localStorage.getItem("green-goods:ens-username-change-requests") ?? "[]"
    ) as Array<{ currentSlug: string; desiredSlug: string; owner: string }>;
    expect(stored[0]).toMatchObject({
      currentSlug: "forest",
      desiredSlug: "canopy",
      owner: PRIMARY_ADDRESS,
    });
  });
});
