/** @vitest-environment jsdom */
import { getStablecoinSendableTokens } from "@green-goods/shared/config";
import type { useCeloWallet } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { CeloWalletCard } from "../../views/Home/WalletDrawer/Send/CeloWalletCard";

type Wallet = ReturnType<typeof useCeloWallet>;
type Receipt = Wallet["receipts"][number];

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
const wallet: Wallet = {
  token: {
    ...getStablecoinSendableTokens(42220).find((token) => token.symbol === "G$")!,
    balance: 25n * 10n ** 18n,
    errored: false,
  },
  balanceLoading: false,
  balanceError: null,
  deliveryEnabled: true,
  deliveryLoading: false,
  deliveryError: null,
  readiness: "ready",
  receipts: [receipt],
  historyLoading: false,
  historyError: null,
  canSend: true,
  isOffline: false,
  refetch: vi.fn(async () => {}),
};

function show(overrides: Partial<Wallet> = {}, locale = "en", messages = en) {
  return render(
    <IntlProvider locale={locale} messages={messages}>
      <CeloWalletCard
        wallet={{ ...wallet, ...overrides }}
        sponsored
        onSend={vi.fn()}
        onReceive={vi.fn()}
      />
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

  it("keeps loaded receipts when history or balance refresh fails", () => {
    show({ historyError: new Error("unavailable"), balanceError: new Error("unavailable") });
    expect(screen.getByText("Restore the garden beds")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your support history couldn't refresh. Any receipts already loaded are still shown."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("25 G$")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Celo wallet" })).toBeInTheDocument();
  });

  it("keeps balance, account, and history loading visible without showing empty or zero", () => {
    show({
      balanceLoading: true,
      readiness: "loading",
      deliveryLoading: true,
      historyLoading: true,
      receipts: [],
      token: { ...wallet.token, balance: null },
      canSend: false,
    });
    expect(screen.getAllByText("Checking your Celo wallet…")).toHaveLength(2);
    expect(screen.getByText("Loading your support history…")).toBeInTheDocument();
    expect(screen.queryByText("0 G$")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Support sent to you by gardens will appear here.")
    ).not.toBeInTheDocument();
  });

  it.each([
    ["en", en, "Receive G$ on Celo", "Recent support"],
    ["es", es, "Recibir G$ en Celo", "Apoyo reciente"],
    ["pt", pt, "Receber G$ na Celo", "Apoio recente"],
  ])("renders translated controls and complete Celo copy in %s", (locale, messages, receive, history) => {
    show({}, locale as string, messages as typeof en);
    expect(screen.getByRole("button", { name: receive as string })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: history as string })).toBeInTheDocument();
    for (const key of Object.keys(en).filter((id) => id.startsWith("app.celoWallet."))) {
      expect((messages as Record<string, string>)[key]).toBeTruthy();
    }
  });
});
