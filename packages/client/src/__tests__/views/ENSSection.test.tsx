/**
 * ENSSection Tests
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseENSRegistrationStatus = vi.fn();
const mockMutateAsync = vi.fn();
const mockReleaseMutateAsync = vi.fn();
const mockValidateSlug = vi.fn(() => ({ valid: true }));
const mockClipboardWriteText = vi.fn(async () => undefined);
const mockTrigger = vi.fn(async () => true);
const mockGetValues = vi.fn(() => "river");
const mockReset = vi.fn();

let mockProtocolMember = true;
let mockRegistrationData: Record<string, unknown> | undefined;
let mockSlugValue = "";
let mockExistingGreenGoodsEnsName: string | null = null;
let mockSponsoredReleaseUnavailable = false;

vi.mock("@green-goods/shared", () => ({
  validateSlug: (slug: string) => mockValidateSlug(slug),
  useOffline: () => ({ isOnline: true }),
  useProtocolMemberStatus: () => ({ data: mockProtocolMember }),
  useSlugForm: () => ({
    watch: (field: string) => (field === "slug" ? mockSlugValue : ""),
    register: () => ({}),
    trigger: mockTrigger,
    getValues: mockGetValues,
    reset: mockReset,
    formState: { errors: {} },
  }),
  useSlugAvailability: () => ({ data: true, isFetching: false }),
  useENSClaim: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useENSReleaseName: () => ({
    mutateAsync: mockReleaseMutateAsync,
    isPending: false,
    isSponsoredReleaseUnavailable: mockSponsoredReleaseUnavailable,
  }),
  useENSRegistrationStatus: (slug?: string) => {
    mockUseENSRegistrationStatus(slug);
    return { data: slug ? mockRegistrationData : undefined };
  },
  useGreenGoodsEnsName: () => ({ data: mockExistingGreenGoodsEnsName }),
  ENSProgressTimeline: ({ slug, data }: { slug: string; data: unknown }) =>
    createElement("div", { "data-testid": "ens-progress" }, slug),
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

vi.mock("@/components/Actions", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => createElement("button", { onClick, disabled }, label),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

import { ENSSection } from "../../views/Profile/ENSSection";

const PRIMARY_ADDRESS = "0x1234567890123456789012345678901234567890" as const;

function renderENSSection(primaryAddress: string = PRIMARY_ADDRESS) {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      createElement(ENSSection, { primaryAddress })
    )
  );
}

describe("Profile ENSSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProtocolMember = true;
    mockRegistrationData = undefined;
    mockSlugValue = "";
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

    expect(screen.getAllByText("Claim ENS name and subdomain")).toHaveLength(2);
    expect(
      screen.getByText(
        "Choose a greengoods.eth name tied to your Green Goods identity and garden work. Registration takes about 15-20 minutes."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Claim subdomain")).toBeInTheDocument();
    expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith(undefined);
  });

  it("hides claim form after successful ENS claim and shows progress timeline", async () => {
    const user = userEvent.setup();
    mockSlugValue = "river";
    mockGetValues.mockReturnValue("river");
    mockRegistrationData = { status: "pending" };

    renderENSSection();

    expect(screen.getByText("Claim subdomain")).toBeInTheDocument();

    await user.click(screen.getByText("Claim subdomain"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ slug: "river" });
    });
    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("river");
    expect(screen.queryByText("Claim subdomain")).not.toBeInTheDocument();
  });

  it("hides claim form when registration is active", async () => {
    const user = userEvent.setup();
    mockSlugValue = "forest";
    mockGetValues.mockReturnValue("forest");
    mockRegistrationData = { status: "active" };

    renderENSSection();

    await user.click(screen.getByText("Claim subdomain"));

    await waitFor(() => {
      expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    });
    expect(screen.queryByText("Claim subdomain")).not.toBeInTheDocument();
  });

  it("hides claim form when the address already has a Green Goods ENS name", () => {
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };

    renderENSSection();

    expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith("forest");
    expect(screen.getAllByText("forest")).toHaveLength(2);
    expect(screen.getByText("Release username")).toBeInTheDocument();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    expect(screen.queryByText("Claim subdomain")).not.toBeInTheDocument();
  });

  it("releases the current ENS name after confirmation", async () => {
    const user = userEvent.setup();
    mockExistingGreenGoodsEnsName = "forest.greengoods.eth";
    mockRegistrationData = { status: "active" };
    mockReleaseMutateAsync.mockResolvedValue({ slug: "forest" });

    renderENSSection();

    await user.click(screen.getByText("Release username"));

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

    const requestButton = screen.getByText("Request username change");
    expect(requestButton).not.toBeDisabled();
    expect(
      screen.getByText(
        "Username changes are support-assisted on this ENS sender. If you still have this passkey, an operator can fund the release transaction. If you lost it, support can review recovery."
      )
    ).toBeInTheDocument();

    await user.click(requestButton);
    await user.type(screen.getByLabelText("Desired username"), "canopy");
    await user.type(screen.getByLabelText("Contact"), "@alice");
    await user.click(screen.getByText("Prepare request"));

    expect(mockReleaseMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Request ens-change-/)).toBeInTheDocument();
    expect((screen.getByLabelText("Request details") as HTMLTextAreaElement).value).toContain(
      "Desired username: canopy.greengoods.eth"
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
