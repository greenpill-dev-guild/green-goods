import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";
import { Button } from "@green-goods/shared/components/Button";
import { TxInlineFeedback } from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
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
  const [jarAddress, setJarAddress] = useState(jars[0]?.jarAddress ?? "");
  const [amount, setAmount] = useState("");

  const selected = jars.find((j) => j.jarAddress === jarAddress);

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      title="Fund Cookie Jar"
    >
      <div className="space-y-4">
        {jars.length > 1 && (
          <div>
            <p className="mb-1.5 block text-sm font-medium text-text-strong">Cookie Jar</p>
            <AdminChoiceGroup
              ariaLabel="Cookie Jar"
              columns={2}
              value={jarAddress || null}
              onChange={setJarAddress}
              options={jars.map((jar) => ({
                value: jar.jarAddress,
                label: jar.symbol,
                description: `${formatTokenAmount(jar.balance, jar.decimals)} ${jar.symbol}`,
              }))}
            />
          </div>
        )}

        {selected && (
          <div className="rounded-lg bg-bg-weak px-4 py-3">
            <p className="text-xs font-medium text-text-soft">Jar Balance</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-strong">
              {formatTokenAmount(selected.balance, selected.decimals)}{" "}
              <span className="text-base font-medium text-text-sub">{selected.symbol}</span>
            </p>
          </div>
        )}

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
        </div>

        <Button
          variant="secondary"
          className="w-full"
          loading={isPending}
          disabled={!selected || amount.trim() === ""}
          onClick={fn()}
        >
          Deposit
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
    symbol: "WETH",
    balance: 2_500_000_000_000_000_000n,
    decimals: 18,
  },
  {
    jarAddress: "0xaaa2",
    symbol: "DAI",
    balance: 120_000_000_000_000_000_000n,
    decimals: 18,
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
    walletBalance: { value: 3_100_000_000_000_000_000n, decimals: 18, symbol: "WETH" },
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
