/** @vitest-environment jsdom */
import type { ComponentProps } from "react";
import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { WalletSupportHistory } from "../../views/Home/WalletDrawer/Send/WalletSupportHistory";

type History = ComponentProps<typeof WalletSupportHistory>;
type Receipt = History["receipts"][number];

const receipt: Receipt = {
  id: "receipt-1",
  sourceChainId: 42161,
  chainId: 42220,
  payoutPlanId: 3n,
  commitmentId: 42n,
  contributor: "0x1111111111111111111111111111111111111111",
  recipient: "0x1111111111111111111111111111111111111111",
  amount: 5n * 10n ** 18n,
  createdAt: 1788643200,
  updatedAt: 1788643200,
  metadataCID: "commitment-metadata",
  title: "Restore the garden beds",
  delivery: { status: "queued" },
  metadataUnavailable: false,
};
const history: History = {
  receipts: [receipt],
  decimals: 18,
  isLoading: false,
  isError: false,
  isOffline: false,
  onRetry: vi.fn(),
};
function show(overrides: Partial<History> = {}, locale = "en", messages = en) {
  return render(
    <IntlProvider locale={locale} messages={messages}>
      <WalletSupportHistory {...history} {...overrides} />
    </IntlProvider>
  );
}

describe("Celo contributor receipts", () => {
  it.each([
    ["queued", "Queued"],
    ["dispatched", "Sent from the garden"],
    ["delivery-delayed", "Taking longer than expected"],
    ["executed-acknowledgment-pending", "Waiting for confirmation"],
    ["not-started", "Being prepared"],
    ["unknown", "Checking progress"],
  ] as const)("keeps %s support on its way until authenticated source confirmation", (status, detail) => {
    show({ receipts: [{ ...receipt, delivery: { status } }] });
    expect(screen.getByRole("listitem")).toHaveTextContent(`Support on its way · ${detail}`);
    expect(screen.queryByText("Arrived")).not.toBeInTheDocument();
  });

  it("shows arrived only for a confirmed receipt", () => {
    show({ receipts: [{ ...receipt, delivery: { status: "confirmed" } }] });
    expect(screen.getByText("Arrived")).toBeInTheDocument();
  });

  it("explains a confirmed failure without claiming that support arrived", () => {
    show({ receipts: [{ ...receipt, delivery: { status: "failed", failureCode: 1 } }] });
    expect(screen.getByText("Support is being rearranged")).toBeInTheDocument();
    expect(screen.queryByText("Arrived")).not.toBeInTheDocument();
  });

  it("shows a cancelled receipt", () => {
    show({ receipts: [{ ...receipt, delivery: { status: "cancelled", from: "queued" } }] });
    expect(screen.getByText("Support cancelled")).toBeInTheDocument();
  });

  it("retains a receipt with neutral commitment text when metadata is unavailable", () => {
    show({ receipts: [{ ...receipt, title: null, metadataUnavailable: true }] });
    expect(screen.getByText("Commitment 42")).toBeInTheDocument();
    expect(screen.getByText("5 G$")).toBeInTheDocument();
  });

  it("keeps loaded receipts when history refresh fails", () => {
    show({ isError: true });
    expect(screen.getByText("Restore the garden beds")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your support history couldn't refresh. Any receipts already loaded are still shown."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps history loading visible without claiming it is empty", () => {
    show({ isLoading: true, receipts: [] });
    expect(screen.getByText("Loading your support history…")).toBeInTheDocument();
    expect(
      screen.queryByText("Support sent to you by gardens will appear here.")
    ).not.toBeInTheDocument();
  });

  it.each([
    ["en", en, "Recent support"],
    ["es", es, "Apoyo reciente"],
    ["pt", pt, "Apoio recente"],
  ])("renders translated controls and complete Celo copy in %s", (locale, messages, title) => {
    show({}, locale as string, messages as typeof en);
    expect(screen.getByRole("heading", { name: title as string })).toBeInTheDocument();
    for (const key of Object.keys(en).filter((id) => id.startsWith("app.celoWallet."))) {
      expect((messages as Record<string, string>)[key]).toBeTruthy();
    }
  });
});
