import { Button, Card, formatTokenAmount } from "@green-goods/shared";
import { RiCupLine, RiHandCoinLine, RiSettings3Line, RiWalletLine } from "@remixicon/react";
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
  decimals: number;
  isPaused: boolean;
}

interface MockPayoutPanelProps {
  jars: MockJarChip[];
  canManage: boolean;
}

function CookieJarPayoutPanelHarness({ jars, canManage }: MockPayoutPanelProps) {
  if (jars.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-lighter">
              <RiCupLine className="h-5 w-5 text-warning-dark" />
            </div>
            <div>
              <h3 className="label-md text-text-strong sm:text-lg">Cookie Jars</h3>
              <p className="mt-0.5 text-sm text-text-sub">
                Gardeners claim rewards from cookie jars for completed work.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {jars.map((jar) => (
              <span
                key={jar.jarAddress}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  jar.isPaused
                    ? "bg-warning-lighter text-warning-dark"
                    : "bg-success-lighter text-success-dark"
                }`}
              >
                {formatTokenAmount(jar.balance, jar.decimals)} {jar.symbol}
              </span>
            ))}
          </div>
        </div>
      </Card.Header>

      <Card.Body>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="md" onClick={fn()}>
            <RiHandCoinLine className="h-4 w-4" />
            Withdraw
          </Button>
          <Button variant="secondary" size="md" onClick={fn()}>
            <RiWalletLine className="h-4 w-4" />
            Fund Jars
          </Button>
          {canManage && (
            <Button variant="ghost" size="md" onClick={fn()}>
              <RiSettings3Line className="h-4 w-4" />
              Manage Jars
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

const JARS: MockJarChip[] = [
  {
    jarAddress: "0xaaa1",
    symbol: "USDC",
    balance: 1_500_000_000n,
    decimals: 6,
    isPaused: false,
  },
  {
    jarAddress: "0xaaa2",
    symbol: "DAI",
    balance: 2_500_000_000_000_000_000_000n,
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
    canManage: true,
  },
};

export const ManagerWithoutOwnerControls: Story = {
  args: {
    jars: JARS,
    canManage: false,
  },
};

export const WithPausedJar: Story = {
  args: {
    jars: [JARS[0], { ...JARS[1], isPaused: true }],
    canManage: true,
  },
};

export const EmptyHidden: Story = {
  args: {
    jars: [],
    canManage: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Component returns null when no jars are configured. Story renders nothing.",
      },
    },
  },
};
