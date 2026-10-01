/**
 * ENSSection Tests
 * @vitest-environment happy-dom
 */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
let mockAvailable = true;
let mockNameLoading = false;
let mockRegistrationError = false;
const mockCheckRegistration = vi.fn();
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
  useSlugAvailability: () => ({ data: mockAvailable, isFetching: false }),
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
    return {
      data: slug ? mockRegistrationData : undefined,
      refetch: mockCheckRegistration,
      isError: mockRegistrationError,
    };
  },
}));

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: mockExistingGreenGoodsEnsName, isLoading: mockNameLoading }),
}));

vi.mock("@green-goods/shared/components/Progress/ENSProgressTimeline", () => ({
  ENSProgressTimeline: ({ slug, phase }: { slug: string; data: unknown; phase?: string }) =>
    createElement("div", { "data-testid": "ens-progress", "data-phase": phase }, slug),
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
    mockAvailable = true;
    mockNameLoading = false;
    mockRegistrationError = false;
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
    mockReleaseMutateAsync.mockImplementation(async () => {
      mockRegistrationData = { status: "pending", release: { owner: PRIMARY_ADDRESS } };
      return { slug: "forest" };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows claim form for protocol members without an existing registration", () => {
    renderENSSection();

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("Your Green Goods name")).toBeInTheDocument();
    expect(
      screen.getByText("A personal name people can use to find your work.")
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

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("Your Green Goods name")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Not available yet");
    expect(status).toHaveTextContent("Join a garden to unlock your Green Goods name.");
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Choose your personal Green Goods name")
    ).not.toBeInTheDocument();
  });

  it("keeps the claim hidden until membership has resolved", () => {
    mockProtocolMember = false;
    mockProtocolMemberLoading = true;

    renderENSSection();

    expect(screen.queryByText("Username")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
  });

  it("suppresses a taken result from our own claim before its receipt arrives", async () => {
    let receive!: () => void;
    mockMutateAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          receive = resolve;
        })
    );
    mockSlugValue = "river";
    const user = userEvent.setup();
    const view = renderENSSection();
    await user.click(screen.getByRole("button", { name: "Claim Name" }));
    mockAvailable = false; // The focus refetch sees our own newly reserved name.
    view.rerender(ensSection());
    expect(screen.queryByText("This name is already taken")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Name taken")).not.toBeInTheDocument();
    expect(screen.getByTestId("ens-progress")).toHaveAttribute("data-phase", "submitting");
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
    mockRegistrationData = { status: "pending" };
    await act(async () => receive());
    expect(screen.getByTestId("ens-progress")).not.toHaveAttribute("data-phase");
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(mockCheckRegistration).toHaveBeenCalledOnce();
  });

  it("returns to the editable form when submission is rejected", async () => {
    mockSlugValue = "river";
    mockMutateAsync.mockRejectedValueOnce(new Error("User rejected request"));
    renderENSSection();
    await userEvent.click(screen.getByRole("button", { name: "Claim Name" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Claim Name" })).toBeEnabled());
    expect(screen.queryByTestId("ens-progress")).not.toBeInTheDocument();
  });

  it("waits for the account's existing name before offering another claim", () => {
    mockNameLoading = true;
    mockAvailable = false;
    mockSlugValue = "river";
    renderENSSection();
    expect(screen.queryByText("This name is already taken")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
    expect(screen.getByTestId("ens-progress")).toHaveAttribute("data-phase", "checking");
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
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
  });

  it("hides claim form when the address already has a Green Goods ENS name", () => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };

    renderENSSection();

    expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith("forest");
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    expect(screen.getByText("Release Username")).toBeInTheDocument();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
  });

  it("hides release when a stale reverse lookup points to another owner's active name", () => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockSlugValue = "canopy";
    mockRegistrationData = {
      status: "active",
      registration: { owner: "0x2345678901234567890123456789012345678901" },
    };

    renderENSSection();

    expect(screen.queryByRole("button", { name: "Release Username" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim Name" })).toBeEnabled();
  });

  it.each([
    "pending",
    "available",
  ])("can claim again after a release first observed as %s", async (releaseStatus) => {
    const user = userEvent.setup();
    mockSlugValue = "forest";
    mockGetValues.mockReturnValue("forest");
    mockRegistrationData = { status: "active" };
    mockReleaseMutateAsync.mockImplementation(async () => {
      mockRegistrationData = { status: releaseStatus, release: { owner: PRIMARY_ADDRESS } };
      if (releaseStatus === "available") mockExistingGreenGoodsEnsName = null;
      return { slug: "forest" };
    });

    const view = renderENSSection();
    await user.click(screen.getByRole("button", { name: "Claim Name" }));
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    view.rerender(ensSection());

    await user.click(screen.getByText("Release Username"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-release-dialog")).toBeInTheDocument();
    });
    expect(mockReleaseMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("confirm-release-button"));

    await waitFor(() => {
      expect(mockReleaseMutateAsync).toHaveBeenCalled();
    });
    if (releaseStatus === "pending") {
      expect(screen.getByText("Release started")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
    }
    mockRegistrationData = { status: "available", release: { owner: PRIMARY_ADDRESS } };
    mockExistingGreenGoodsEnsName = null;
    view.rerender(ensSection());
    await waitFor(() => expect(screen.getByRole("button", { name: "Claim Name" })).toBeEnabled());
    mockGetValues.mockReturnValue("canopy");
    mockRegistrationData = { status: "pending" };
    await user.click(screen.getByRole("button", { name: "Claim Name" }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenLastCalledWith({ slug: "canopy" }));
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("canopy");
    mockExistingGreenGoodsEnsName = "canopy.greengoods.eth";
    mockRegistrationData = { status: "active" };
    view.rerender(ensSection());
    expect(screen.getByRole("button", { name: "Release Username" })).toBeEnabled();
  });

  it.each([
    "pending",
    "timed_out",
  ])("keeps recovery and retry available for an owned %s name", async (status) => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status };
    const view = renderENSSection();
    expect(screen.getByRole("button", { name: "Release Username" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(mockCheckRegistration).toHaveBeenCalledOnce();
    mockSponsoredReleaseUnavailable = true;
    view.rerender(ensSection());
    await userEvent.click(screen.getByRole("button", { name: "Request Username Change" }));
    expect(screen.getByLabelText("Desired username")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
    expect(mockReleaseMutateAsync).not.toHaveBeenCalled();
  });

  it("offers retry for a failed refresh of a confirmed name", async () => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };
    mockRegistrationError = true;
    renderENSSection();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t check your name. Please try again."
    );
    await userEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(mockCheckRegistration).toHaveBeenCalledOnce();
  });

  it("resumes a restored release without permitting duplicate release", () => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "pending", release: { owner: PRIMARY_ADDRESS } };
    renderENSSection();
    expect(screen.getByRole("button", { name: "Release started" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Claim Name" })).not.toBeInTheDocument();
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
