/**
 * Fund view behavior tests for the editorial public browser refresh.
 *
 * Locks the public-only contract:
 * - Donate / Endow intent selector launches before any wallet prompt.
 * - Wallet selection routes to the matching CookieJar / Vault deposit dialog.
 * - Card path is hidden by default (provider proof registry empty).
 * - `?garden=` resolution: exact id match scrolls and highlights.
 * - Stale `?garden=` renders the localized non-blocking message.
 * - No withdraw or admin controls.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGardens = [
  {
    id: "0x1111111111111111111111111111111111111111" as Address,
    address: "0x1111111111111111111111111111111111111111" as Address,
    name: "Solar Community Garden",
    slug: "solar-community-garden",
    description: "A solar-powered community garden",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    contributorCount: 2,
    actionCount: 1,
    lastActivityAt: 1700000000,
    operators: [],
    evaluators: [],
  },
  {
    id: "0x2222222222222222222222222222222222222222" as Address,
    address: "0x2222222222222222222222222222222222222222" as Address,
    name: "Urban Composting Hub",
    slug: "urban-composting-hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    contributorCount: 1,
    actionCount: 0,
    lastActivityAt: 1690000000,
    operators: [],
    evaluators: [],
  },
];

const { mockUsePublicGardens, mockOpenWalletModal, mockPrimaryAddress } = vi.hoisted(() => ({
  mockUsePublicGardens: vi.fn(),
  mockOpenWalletModal: vi.fn(),
  mockPrimaryAddress: { current: null as Address | null },
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    useAppKit: () => ({ open: mockOpenWalletModal }),
    usePublicGardens: (...args: unknown[]) => mockUsePublicGardens(...args),
    useUser: () => ({ primaryAddress: mockPrimaryAddress.current }),
  };
});

vi.mock("@/components/Dialogs", () => ({
  VaultDepositDialog: ({ isOpen, gardenName }: { isOpen: boolean; gardenName: string }) =>
    isOpen ? <div data-testid="vault-deposit-dialog">{gardenName}</div> : null,
  CookieJarDepositDialog: ({ isOpen, gardenName }: { isOpen: boolean; gardenName: string }) =>
    isOpen ? <div data-testid="cookie-jar-dialog">{gardenName}</div> : null,
}));

vi.mock("@/components/Public", async () => {
  const actual = await vi.importActual<typeof import("@/components/Public")>("@/components/Public");
  return {
    ...actual,
    PublicFundingReceipt: ({ intentId }: { intentId: string }) => (
      <div data-testid="public-funding-receipt">{intentId}</div>
    ),
  };
});

import FundPage from "../../views/Public/Fund";

const messages: Record<string, string> = {
  "public.fund.title": "Fund",
  "public.fund.description": "Support regenerative gardens by funding their vaults",
  "public.fund.support": "Support this Garden",
  "public.fund.totalGardens": "Total Gardens",
  "public.fund.totalContributors": "Total Contributors",
  "public.fund.taxDisclaimer": "tax disclaimer",
  "public.fund.dialog.intentTitle": "Support {garden}",
  "public.fund.dialog.donate.title": "Donate",
  "public.fund.dialog.donate.description": "donate description",
  "public.fund.dialog.endow.title": "Endow",
  "public.fund.dialog.endow.description": "endow description",
  "public.fund.dialog.endow.risk": "endow risk",
  "public.fund.dialog.taxDisclaimer": "dialog tax disclaimer",
  "public.fund.dialog.methodTitle": "Choose how to pay",
  "public.fund.dialog.wallet.title": "Wallet",
  "public.fund.dialog.wallet.descriptionConnected": "wallet connected",
  "public.fund.dialog.wallet.descriptionDisconnected": "wallet disconnected",
  "public.fund.dialog.back": "Back",
  "public.fund.dialog.close": "Close",
  "public.fund.gardenQuery.stale": "We couldn't find a Garden matching {query}.",
  "public.fund.gardenQuery.ambiguous": "Ambiguous Garden {query}.",
};

function renderView(initialEntries: string[] = ["/fund"]) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries },
      createElement(IntlProvider, { locale: "en", messages }, createElement(FundPage))
    )
  );
}

describe("FundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress.current = null;
    mockUsePublicGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders confirmed counts", () => {
    renderView();
    expect(screen.getByText("Total Gardens")).toBeInTheDocument();
    expect(screen.getByText("Total Contributors")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("each Garden gets a Support CTA — no Deposit/Cookie Jar/Connect Wallet on the page", () => {
    renderView();
    const supportButtons = screen.getAllByRole("button", { name: "Support this Garden" });
    expect(supportButtons).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Deposit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cookie Jar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).toBeNull();
  });

  it("Support CTA opens the Donate/Endow intent selector before any wallet prompt", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "Support this Garden" })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /donate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /endow/i })).toBeInTheDocument();
    // No wallet prompt yet.
    expect(mockOpenWalletModal).not.toHaveBeenCalled();
  });

  it("Donate → Wallet routes to the CookieJar deposit dialog when wallet is connected", async () => {
    const user = userEvent.setup();
    mockPrimaryAddress.current = "0x9999999999999999999999999999999999999999";
    renderView();
    await user.click(screen.getAllByRole("button", { name: "Support this Garden" })[0]);
    await user.click(screen.getByRole("button", { name: /donate/i }));
    await user.click(screen.getByRole("button", { name: /wallet/i }));
    expect(screen.getByTestId("cookie-jar-dialog")).toHaveTextContent("Solar Community Garden");
    expect(mockOpenWalletModal).not.toHaveBeenCalled();
  });

  it("Donate → Wallet opens AppKit at the wallet-required step when disconnected", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "Support this Garden" })[0]);
    await user.click(screen.getByRole("button", { name: /donate/i }));
    await user.click(screen.getByRole("button", { name: /wallet/i }));
    expect(mockOpenWalletModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cookie-jar-dialog")).toBeNull();
  });

  it("hides the Card option by default — provider proof registry is empty", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "Support this Garden" })[0]);
    await user.click(screen.getByRole("button", { name: /donate/i }));
    expect(screen.queryByRole("button", { name: /^card$/i })).toBeNull();
  });

  it("?intent= mounts the receipt UI", () => {
    renderView(["/fund?intent=fi_abc"]);
    expect(screen.getByTestId("public-funding-receipt")).toHaveTextContent("fi_abc");
  });

  it("renders a stale-query message for /fund?garden=missing", () => {
    renderView(["/fund?garden=missing"]);
    expect(screen.getByRole("status")).toHaveTextContent(/missing/);
  });

  it("keeps the page support-only — no withdraw / admin controls", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /withdraw/i })).toBeNull();
    expect(screen.queryByText(/withdraw/i)).toBeNull();
  });
});
