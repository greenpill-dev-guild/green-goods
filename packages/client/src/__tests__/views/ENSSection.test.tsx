import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseENSRegistrationStatus = vi.fn();
const mockMutateAsync = vi.fn();
const mockReadOwnerToSlug = vi.fn();

let mockProtocolMember = true;
let mockRegistrationData: Record<string, unknown> | undefined;

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  useOffline: () => ({ isOnline: true }),
  useProtocolMemberStatus: () => ({ data: mockProtocolMember }),
  useSlugForm: () => ({
    watch: () => "",
    register: () => ({}),
    trigger: vi.fn(async () => true),
    getValues: vi.fn(() => ""),
    reset: vi.fn(),
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
  ENSProgressTimeline: ({ slug }: { slug: string }) =>
    createElement("div", { "data-testid": "ens-progress" }, slug),
}));

vi.mock("@green-goods/shared/utils", () => ({
  GreenGoodsENSABI: [],
  getNetworkContracts: () => ({
    greenGoodsENS: "0x9999999999999999999999999999999999999999",
  }),
  createClients: () => ({
    publicClient: {
      readContract: mockReadOwnerToSlug,
    },
  }),
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label }: { label: string }) => createElement("button", null, label),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

import { ENSSection } from "../../views/Profile/ENSSection";

const PRIMARY_ADDRESS = "0x1234567890123456789012345678901234567890" as const;
const SECONDARY_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

function renderENSSection(
  primaryAddress: typeof PRIMARY_ADDRESS | typeof SECONDARY_ADDRESS = PRIMARY_ADDRESS
) {
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
    localStorage.clear();
    mockProtocolMember = true;
    mockRegistrationData = undefined;
    mockReadOwnerToSlug.mockResolvedValue("");
  });

  afterEach(() => {
    cleanup();
  });

  it("restores pending registration state from per-account storage", async () => {
    localStorage.setItem(
      "gg:ens:slug:11155111:0x1234567890123456789012345678901234567890",
      "river"
    );
    mockRegistrationData = { status: "pending" };

    renderENSSection();

    await waitFor(() => expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith("river"));
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("river");
    expect(screen.queryByText("Claim name")).not.toBeInTheDocument();
  });

  it("prefers contract owner state over stale session-local storage", async () => {
    localStorage.setItem(
      "gg:ens:slug:11155111:0x1234567890123456789012345678901234567890",
      "river"
    );
    mockReadOwnerToSlug.mockResolvedValue("forest");
    mockRegistrationData = { status: "active" };

    renderENSSection();

    await waitFor(() => expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith("forest"));
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");
    expect(screen.queryByText("Claim name")).not.toBeInTheDocument();
  });

  it("does not carry the previous account slug into the next account", async () => {
    let resolveSecondAccountSlug: ((value: string) => void) | null = null;
    mockRegistrationData = { status: "active" };

    mockReadOwnerToSlug.mockImplementation(({ args }: { args: [string] }) => {
      const [address] = args;
      if (address === PRIMARY_ADDRESS) {
        return Promise.resolve("forest");
      }
      if (address === SECONDARY_ADDRESS) {
        return new Promise<string>((resolve) => {
          resolveSecondAccountSlug = resolve;
        });
      }
      return Promise.resolve("");
    });

    const view = renderENSSection();

    await waitFor(() => expect(mockUseENSRegistrationStatus).toHaveBeenCalledWith("forest"));
    expect(screen.getByTestId("ens-progress")).toHaveTextContent("forest");

    mockRegistrationData = undefined;
    view.rerender(
      createElement(
        IntlProvider,
        { locale: "en", messages: {} },
        createElement(ENSSection, { primaryAddress: SECONDARY_ADDRESS })
      )
    );

    await waitFor(() => expect(mockUseENSRegistrationStatus).toHaveBeenLastCalledWith(undefined));
    expect(
      localStorage.getItem("gg:ens:slug:11155111:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
    ).toBeNull();

    resolveSecondAccountSlug?.("");
  });
});
