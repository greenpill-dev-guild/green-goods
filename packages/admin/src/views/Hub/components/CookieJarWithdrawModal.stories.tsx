import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { Button, formatTokenAmount, TxInlineFeedback } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real CookieJarWithdrawModal.
// Real component wires `useCookieJarWithdraw` + `useGardenCookieJars`
// (both wagmi-backed, not seedable in Storybook without intercepting
// wagmi internals). This harness mirrors the dialog body with injected
// jars and pending/error flags.

interface MockJar {
  jarAddress: string;
  symbol: string;
  balance: bigint;
  decimals: number;
  isPaused: boolean;
  maxWithdrawal: bigint;
}

interface CookieJarWithdrawModalHarnessProps {
  isOpen: boolean;
  onClose: () => void;
  jars: MockJar[];
  isPending?: boolean;
  error?: string | null;
}

function CookieJarWithdrawModalHarness({
  isOpen,
  onClose,
  jars,
  isPending = false,
  error = null,
}: CookieJarWithdrawModalHarnessProps) {
  const [jarAddress, setJarAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");

  const activeJars = jars.filter((j) => !j.isPaused);
  const selected = activeJars.find((j) => j.jarAddress === jarAddress);

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      title="Cookie Jar Withdrawal"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="mock-withdraw-jar" className="block text-sm font-medium text-text-strong">
            Cookie Jar
          </label>
          <select
            id="mock-withdraw-jar"
            value={jarAddress}
            onChange={(e) => setJarAddress(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong"
          >
            <option value="">--</option>
            {activeJars.map((jar) => (
              <option key={jar.jarAddress} value={jar.jarAddress}>
                {jar.symbol} ({formatTokenAmount(jar.balance, jar.decimals)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="mock-withdraw-amount"
            className="block text-sm font-medium text-text-strong"
          >
            Amount
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="mock-withdraw-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong"
            />
            <AdminButton
              variant="outlined"
              size="sm"
              onClick={() => {
                if (!selected) return;
                const max =
                  selected.maxWithdrawal < selected.balance
                    ? selected.maxWithdrawal
                    : selected.balance;
                setAmount(formatTokenAmount(max, selected.decimals));
              }}
            >
              Max
            </AdminButton>
          </div>
        </div>

        <div>
          <label
            htmlFor="mock-withdraw-purpose"
            className="block text-sm font-medium text-text-strong"
          >
            Purpose
          </label>
          <textarea
            id="mock-withdraw-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Describe what these funds will be used for…"
            className="mt-1.5 w-full resize-none rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong"
            rows={2}
          />
        </div>

        <Button
          variant="primary"
          className="w-full"
          loading={isPending}
          disabled={!selected || amount.trim() === ""}
          onClick={fn()}
        >
          {isPending ? "Withdrawing…" : "Withdraw"}
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
    isPaused: false,
    maxWithdrawal: 200_000_000n,
  },
  {
    jarAddress: "0xaaa2",
    symbol: "DAI",
    balance: 2_500_000_000_000_000_000_000n,
    decimals: 18,
    isPaused: true,
    maxWithdrawal: 100_000_000_000_000_000_000n,
  },
];

const meta: Meta<typeof CookieJarWithdrawModalHarness> = {
  title: "Admin/Workflows/Hub/CookieJarWithdrawModal",
  component: CookieJarWithdrawModalHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `CookieJarWithdrawModal`. Paused jars filtered out of the select. Real component runs `useCookieJarWithdraw`; this harness uses stub callbacks.",
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
type Story = StoryObj<typeof CookieJarWithdrawModalHarness>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isPending: true },
};

export const WithError: Story = {
  args: { error: "User rejected the request." },
};

export const AllPaused: Story = {
  args: {
    jars: JARS.map((j) => ({ ...j, isPaused: true })),
  },
};
