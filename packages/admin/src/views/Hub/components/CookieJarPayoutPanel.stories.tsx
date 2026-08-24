import { Card } from "@green-goods/shared/components/Cards/CardBase";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { RiHandCoinLine, RiWalletLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real CookieJarPayoutPanel.
// Real component renders nothing until `useGardenCookieJars` (wagmi
// reads) returns a configured jar list, then opens three modals
// (deposit / withdraw / manage). This harness mirrors the card +
// balance chips layout with injected jar data so the visual header is
// reviewable.

interface MockJarChip {
  jarAddress: string;
  symbol: string;
  balance: bigint;
  maxWithdrawal: bigint;
  withdrawalInterval: string;
  decimals: number;
  isPaused: boolean;
}

interface MockPayoutPanelProps {
  jars: MockJarChip[];
}

function CookieJarPayoutPanelHarness({ jars }: MockPayoutPanelProps) {
  if (jars.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <Card.Header>
        <div>
          <h3 className="label-md text-text-strong sm:text-lg">Cookie Jars</h3>
          <p className="mt-1 body-sm text-text-sub">
            Gardeners claim rewards from cookie jars for completed work
          </p>
        </div>
      </Card.Header>

      <Card.Body className="space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {jars.map((jar) => (
            <AdminCard
              key={jar.jarAddress}
              variant="outlined"
              className="flex min-h-64 flex-col gap-4 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-lg font-semibold text-text-strong" title={jar.symbol}>
                    {jar.symbol}
                  </h4>
                  <p className="mt-1 truncate text-xs text-text-soft">{jar.jarAddress}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    jar.isPaused
                      ? "bg-warning-lighter text-warning-dark"
                      : "bg-success-lighter text-success-dark"
                  }`}
                >
                  {jar.isPaused ? "Paused" : "Active"}
                </span>
              </div>

              <div className="rounded-lg bg-bg-weak px-4 py-3">
                <p className="text-xs font-medium text-text-soft">Jar Balance</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-text-strong">
                  {formatTokenAmount(jar.balance, jar.decimals)}{" "}
                  <span className="text-base font-medium text-text-sub">{jar.symbol}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-bg-weak px-3 py-2">
                  <p className="body-xs text-text-soft">Available now</p>
                  <p className="mt-1 font-semibold tabular-nums text-text-strong">
                    {formatTokenAmount(jar.maxWithdrawal, jar.decimals)} {jar.symbol}
                  </p>
                </div>
                <div className="rounded-md bg-bg-weak px-3 py-2">
                  <p className="body-xs text-text-soft">Withdrawal interval</p>
                  <p className="mt-1 font-semibold tabular-nums text-text-strong">
                    {jar.withdrawalInterval}
                  </p>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2">
                <AdminButton
                  variant="tonal"
                  size="sm"
                  leadingIcon={<RiWalletLine />}
                  onClick={fn()}
                >
                  Deposit
                </AdminButton>
                <AdminButton
                  variant="filled"
                  size="sm"
                  leadingIcon={<RiHandCoinLine />}
                  onClick={fn()}
                  disabled={jar.isPaused}
                >
                  Withdraw
                </AdminButton>
              </div>
            </AdminCard>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

const JARS: MockJarChip[] = [
  {
    jarAddress: "0xaaa1",
    symbol: "WETH",
    balance: 2_500_000_000_000_000_000n,
    maxWithdrawal: 500_000_000_000_000_000n,
    withdrawalInterval: "7d",
    decimals: 18,
    isPaused: false,
  },
  {
    jarAddress: "0xaaa2",
    symbol: "DAI",
    balance: 120_000_000_000_000_000_000n,
    maxWithdrawal: 25_000_000_000_000_000_000n,
    withdrawalInterval: "7d",
    decimals: 18,
    isPaused: false,
  },
];

const meta: Meta<typeof CookieJarPayoutPanelHarness> = {
  title: "Admin/Workflows/Hub/CookieJarPayoutPanel",
  component: CookieJarPayoutPanelHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `CookieJarPayoutPanel`. Header showing cookie-jar balance chips + deposit / withdraw / manage buttons. Real component is gated by wagmi reads inside `useGardenCookieJars`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CookieJarPayoutPanelHarness>;

export const WithJars: Story = {
  args: {
    jars: JARS,
  },
};

export const WithPausedJar: Story = {
  args: {
    jars: [JARS[0], { ...JARS[1], isPaused: true }],
  },
};

export const EmptyHidden: Story = {
  args: {
    jars: [],
  },
  parameters: {
    docs: {
      description: {
        story: "Component returns null when no jars are configured. Story renders nothing.",
      },
    },
  },
};
