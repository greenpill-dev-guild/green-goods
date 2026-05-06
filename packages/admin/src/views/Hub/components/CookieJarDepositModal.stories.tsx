import { AdminDialog } from "@/components/AdminDialog";
import {
  Button,
  formatTokenAmount,
  NativeSelect,
  TextInput,
  TxInlineFeedback,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real CookieJarDepositModal.
// The real component calls `useGardenCookieJars` (wagmi
// `useReadContract` chain), wagmi `useBalance`, and
// `useCookieJarDeposit` (wagmi mutation). Seeding jar data would
// require intercepting wagmi's internal query cache. This harness
// mirrors the dialog body with plain props so every state is
// reviewable. Treat as a design-system surface.

interface MockJar {
  jarAddress: string;
  symbol: string;
  balance: bigint;
  decimals: number;
  minDeposit: bigint;
}

interface CookieJarDepositModalHarnessProps {
  isOpen: boolean;
  onClose: () => void;
  jars: MockJar[];
  walletBalance?: { value: bigint; decimals: number; symbol: string };
  isPending?: boolean;
  error?: string | null;
}

function CookieJarDepositModalHarness({
  isOpen,
  onClose,
  jars,
  walletBalance,
  isPending = false,
  error = null,
}: CookieJarDepositModalHarnessProps) {
  const [jarAddress, setJarAddress] = useState("");
  const [amount, setAmount] = useState("");

  const selected = jars.find((j) => j.jarAddress === jarAddress);

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      title="Fund Cookie Jar"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="mock-deposit-jar" className="block text-sm font-medium text-text-strong">
            Cookie Jar
          </label>
          <NativeSelect
            id="mock-deposit-jar"
            surface="admin"
            value={jarAddress}
            onChange={(e) => setJarAddress(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong"
          >
            <option value="">--</option>
            {jars.map((jar) => (
              <option key={jar.jarAddress} value={jar.jarAddress}>
                {jar.symbol} ({formatTokenAmount(jar.balance, jar.decimals)})
              </option>
            ))}
          </NativeSelect>
        </div>

        <div>
          <label
            htmlFor="mock-deposit-amount"
            className="block text-sm font-medium text-text-strong"
          >
            Amount
          </label>
          <TextInput
            id="mock-deposit-amount"
            surface="admin"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-text-soft">
            Wallet balance:{" "}
            {walletBalance
              ? `${formatTokenAmount(walletBalance.value, walletBalance.decimals)} ${walletBalance.symbol}`
              : "--"}
          </p>
          {selected && selected.minDeposit > 0n && (
            <p className="text-xs text-text-soft">
              Min Deposit: {formatTokenAmount(selected.minDeposit, selected.decimals)}{" "}
              {selected.symbol}
            </p>
          )}
        </div>

        <Button
          variant="secondary"
          className="w-full"
          loading={isPending}
          disabled={!selected || amount.trim() === ""}
          onClick={fn()}
        >
          {isPending ? "Depositing…" : "Deposit"}
        </Button>

        <TxInlineFeedback
          visible={Boolean(error)}
          severity="error"
          title="Transaction failed"
          message={error ?? ""}
          reserveClassName="min-h-[5.5rem]"
        />
      </div>
    </AdminDialog>
  );
}

const JARS: MockJar[] = [
  {
    jarAddress: "0xaaa1",
    symbol: "USDC",
    balance: 1_500_000_000n,
    decimals: 6,
    minDeposit: 10_000_000n,
  },
  {
    jarAddress: "0xaaa2",
    symbol: "DAI",
    balance: 2_500_000_000_000_000_000_000n,
    decimals: 18,
    minDeposit: 0n,
  },
];

const meta: Meta<typeof CookieJarDepositModalHarness> = {
  title: "Admin/Workflows/Hub/CookieJarDepositModal",
  component: CookieJarDepositModalHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `CookieJarDepositModal`. Renders the same dialog body with injected jar list + optional wallet balance. The real component reads via wagmi (`useGardenCookieJars`, `useBalance`) and mutates via `useCookieJarDeposit`.",
      },
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    jars: JARS,
  },
};

export default meta;
type Story = StoryObj<typeof CookieJarDepositModalHarness>;

export const Default: Story = {};

export const WithWalletBalance: Story = {
  args: {
    walletBalance: { value: 2_000_000_000n, decimals: 6, symbol: "USDC" },
  },
};

export const Submitting: Story = {
  args: { isPending: true },
};

export const WithError: Story = {
  args: { error: "User rejected the request." },
};

export const Closed: Story = {
  args: { isOpen: false },
};
