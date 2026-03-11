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
const mockTrigger = vi.fn(async () => true);
const mockGetValues = vi.fn(() => "river");
const mockReset = vi.fn();

let mockProtocolMember = true;
let mockRegistrationData: Record<string, unknown> | undefined;
let mockSlugValue = "";

vi.mock("@green-goods/shared", () => ({
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
  useENSRegistrationStatus: (slug?: string) => {
    mockUseENSRegistrationStatus(slug);
    return { data: slug ? mockRegistrationData : undefined };
  },
  ENSProgressTimeline: ({ slug, data }: { slug: string; data: unknown }) =>
    createElement("div", { "data-testid": "ens-progress" }, slug),
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
    mockMutateAsync.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("shows claim form for protocol members without an existing registration", () => {
    renderENSSection();

    expect(screen.getByText("Claim name")).toBeInTheDocument();
    expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith(undefined);
  });

  it("hides claim form after successful ENS claim and shows progress timeline", async () => {
    const user = userEvent.setup();
    mockSlugValue = "river";
    mockGetValues.mockReturnValue("river");
    mockRegistrationData = { status: "pending" };

    renderENSSection();

    expect(screen.getByText("Claim name")).toBeInTheDocument();

    await user.click(screen.getByText("Claim name"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ slug: "river" });
    });
    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("river");
    expect(screen.queryByText("Claim name")).not.toBeInTheDocument();
  });

  it("hides claim form when registration is active", async () => {
    const user = userEvent.setup();
    mockSlugValue = "forest";
    mockGetValues.mockReturnValue("forest");
    mockRegistrationData = { status: "active" };

    renderENSSection();

    await user.click(screen.getByText("Claim name"));

    await waitFor(() => {
      expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    });
    expect(screen.queryByText("Claim name")).not.toBeInTheDocument();
  });
});
