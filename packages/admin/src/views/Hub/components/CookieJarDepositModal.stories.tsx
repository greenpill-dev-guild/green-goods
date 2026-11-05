import { Alert, type AlertVariant } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import {
  TxHoldFeedback,
  TxInlineFeedback,
} from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";

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
  /** The selected jar's per-claim limit is under the floor: warn, and offer the fix first. */
  lowLimit?: { limit: string; symbol: string };
  /** An earlier deposit into this jar nobody can confirm, which pauses the next one. */
  held?: boolean;
  /** The jars can't be funded yet: this stands in for the form, with Cancel alone in the footer. */
  readNotice?: { variant: AlertVariant; title?: string; body: string };
}

function CookieJarDepositModalHarness({
  isOpen,
  onClose,
  jars,
  walletBalance,
  isPending = false,
  error = null,
  lowLimit,
  held = false,
  readNotice,
}: CookieJarDepositModalHarnessProps) {
  const [jarAddress, setJarAddress] = useState(jars[0]?.jarAddress ?? "");
  const [amount, setAmount] = useState("");

  const selected = jars.find((j) => j.jarAddress === jarAddress);

  if (readNotice) {
    return (
      <AdminDialog
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        title="Fund Cookie Jar"
        description="Fund a jar from your connected wallet."
        actions={
          <Button type="button" emphasis="tertiary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        }
      >
        <Alert variant={readNotice.variant} title={readNotice.title}>
          {readNotice.body}
        </Alert>
      </AdminDialog>
    );
  }

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      title="Fund Cookie Jar"
      actions={
        lowLimit ? (
          <>
            <Button type="button" emphasis="secondary" size="sm" onClick={fn()}>
              Deposit Anyway
            </Button>
            <Button size="sm" type="button" onClick={fn()}>
              Fix Limit First
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {held ? (
          <TxHoldFeedback
            title="We couldn’t confirm your last deposit."
            message="It could still land, so deposits here are paused until you check again or move on. If it lands after you move on, you’ll have deposited twice."
            detail="You tried to deposit 5 DAI. This jar holds 41 DAI now."
            hasUnreadValues={false}
            isSettling={false}
            onCheckAgain={fn()}
            onMoveOn={fn()}
          />
        ) : null}
        {jars.length > 1 && (
          <div>
            <p className="mb-1.5 block type-body font-medium text-text-strong">Cookie Jar</p>
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
            <p className="type-label-sm text-text-soft">Jar Balance</p>
            <p className="mt-1 type-title-lg font-semibold tabular-nums text-text-strong">
              {formatTokenAmount(selected.balance, selected.decimals)}{" "}
              <span className="type-title-md font-medium text-text-sub">{selected.symbol}</span>
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="mock-deposit-amount"
            className="block type-body font-medium text-text-strong"
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
            className="mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 type-body text-text-strong"
          />
        </div>

        <div className="space-y-1">
          <p className="type-meta text-text-soft">
            Wallet balance:{" "}
            {walletBalance
              ? `${formatTokenAmount(walletBalance.value, walletBalance.decimals)} ${walletBalance.symbol}`
              : "--"}
          </p>
        </div>

        {lowLimit ? (
          <Alert
            variant="warning"
            title={`This jar pays out ${lowLimit.limit} ${lowLimit.symbol} per claim`}
          >
            Each gardener can claim once a day. At that limit, 25 {lowLimit.symbol} takes 2,500
            claims to reach them.
          </Alert>
        ) : null}

        <Button
          emphasis="secondary"
          className="w-full"
          loading={isPending}
          disabled={!selected || amount.trim() === "" || held}
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

/** An earlier deposit nobody can confirm pauses the next one until it lands or the person moves on. */
export const HeldDeposit: Story = {
  args: { jars: [JARS[1]], held: true },
};

/** Funding a jar capped at one cent warns; the deposit still goes through. */
export const LowLimitWarning: Story = {
  args: { jars: [JARS[1]], lowLimit: { limit: "0.01", symbol: "DAI" } },
};

/** Fund Cookie Jar opened before the jars were read, as on a reload with its route item (DL-140). */
export const CheckingJars: Story = {
  args: {
    jars: [],
    readNotice: { variant: "info", body: "Checking which cookie jars you can access…" },
  },
};

export const JarsReadFailed: Story = {
  args: {
    jars: [],
    readNotice: {
      variant: "error",
      title: "Couldn't read this garden's cookie jars",
      body: "Refresh the page to try again.",
    },
  },
};

export const Closed: Story = {
  args: { isOpen: false },
};
