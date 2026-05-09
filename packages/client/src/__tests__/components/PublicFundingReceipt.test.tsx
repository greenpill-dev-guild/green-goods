/**
 * PublicFundingReceipt success state tests.
 *
 * Locks the Phase 1 wayfinding promise: when a public visitor lands on a
 * successful funding receipt, they always have a clear next step into the
 * funding catalogue (`/fund`) and the public evidence stream (`/impact`).
 * Without these links the receipt is a dead-end, which the website UX flow
 * plan explicitly cited as a blocker.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  logger: { warn: mockLoggerWarn, info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/routes/receipt-token", () => ({
  RECEIPT_TOKEN_SESSION_KEY: "gg.receiptToken",
  scrubReceiptTokenFragmentFromLocation: vi.fn(),
}));

vi.mock("@/components/Public/PublicInstallAction", () => ({
  PublicInstallAction: ({
    children,
  }: {
    children: (props: {
      label: string;
      href: string;
      onClick: () => void;
      dataInstallAction: string;
    }) => unknown;
  }) =>
    children({
      label: "Open app",
      href: "#install",
      onClick: () => undefined,
      dataInstallAction: "install_pwa",
    }),
}));

import { PublicFundingReceipt } from "../../components/Public/PublicFundingReceipt";

const messages: Record<string, string> = {
  "public.fund.receipt.label": "Funding receipt",
  "public.fund.receipt.intent": "Intent",
  "public.fund.receipt.amount": "Amount",
  "public.fund.receipt.status": "Status",
  "public.fund.receipt.intent.endow": "Endow",
  "public.fund.receipt.intent.donate": "Donate",
  "public.fund.receipt.status.confirmed_onchain": "Confirmed",
  "public.fund.receipt.endowRecovery":
    "Your Endow position lives in a recoverable wallet. Install the app to manage Vault shares and recovery options.",
  "public.fund.receipt.supportAnother": "Support another Garden",
  "public.fund.receipt.viewImpact": "View public evidence",
};

const baseReceipt = {
  id: "intent-123",
  status: "confirmed_onchain",
  garden: { id: "0xabc", name: "Aiyeloja Family Garden", location: "Lagos, NG" },
  destination: { type: "vault", address: "0xdef" },
  fundingIntent: "endow",
  amount: {
    amountUsd: "25.00",
    token: "0x000000000000000000000000000000000000beef",
    chainId: 42161,
  },
  updatedAt: "2026-05-08T00:00:00.000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

function renderReceipt() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(PublicFundingReceipt, { intentId: "intent-123" })
      )
    )
  );
}

describe("PublicFundingReceipt success state", () => {
  beforeEach(() => {
    window.sessionStorage.setItem("gg.receiptToken", "tok_test");
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, publicReceipt: baseReceipt }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the loading state before the fetch resolves", () => {
    const { container } = renderReceipt();
    expect(container.textContent).toMatch(/loading/i);
  });

  it("offers wayfinding to /fund and /impact when the receipt loads", async () => {
    const { container } = renderReceipt();

    await waitFor(
      () => {
        expect(container.textContent).toContain("Aiyeloja Family Garden");
      },
      { timeout: 3000 }
    );

    const supportAnother = screen.getByRole("link", { name: /support another garden/i });
    expect(supportAnother).toHaveAttribute("href", "/fund");

    const viewImpact = screen.getByRole("link", { name: /view public evidence/i });
    expect(viewImpact).toHaveAttribute("href", "/impact");

    expect(fetchMock).toHaveBeenCalled();
  });
});
