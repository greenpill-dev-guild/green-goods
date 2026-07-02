import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { formatTokenAmount } from "@green-goods/shared";
import { RiPencilLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real CookieJarManageModal.
// Visual skeleton of the manage dialog. Real component wires six
// wagmi mutation hooks (pause / unpause / emergencyWithdraw /
// updateMaxWithdrawal / updateInterval) plus `useGardenCookieJars`
// (wagmi reads). Not seedable in Storybook without intercepting wagmi
// internals.

interface MockJar {
  jarAddress: string;
  symbol: string;
  balance: bigint;
  decimals: number;
  maxWithdrawal: bigint;
  withdrawalInterval: bigint;
  isPaused: boolean;
  emergencyWithdrawalEnabled: boolean;
}

interface MockManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  jars: MockJar[];
  canManage: boolean;
  isOwner: boolean;
}

function cooldown(seconds: bigint) {
  const s = Number(seconds);
  if (s >= 86_400) return `${Math.floor(s / 86_400)}d`;
  if (s >= 3_600) return `${Math.floor(s / 3_600)}h`;
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  return `${s}s`;
}

function CookieJarManageModalHarness({
  isOpen,
  onClose,
  jars,
  canManage,
  isOwner,
}: MockManageModalProps) {
  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Manage Cookie Jars"
      description="Review balances, pause state, withdrawal limits, and cooldowns."
    >
      <div className="space-y-3">
        {jars.map((jar) => (
          <AdminCard variant="outlined" key={jar.jarAddress} density="compact">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-strong">{jar.symbol}</p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    jar.isPaused
                      ? "bg-warning-lighter text-warning-dark"
                      : "bg-success-lighter text-success-dark"
                  }`}
                >
                  {jar.isPaused ? "Paused" : "Active"}
                </span>
              </div>
              <div className="flex gap-2">
                {canManage && (
                  <AdminButton variant="tonal" size="sm" onClick={fn()}>
                    {jar.isPaused ? "Resume jar" : "Pause jar"}
                  </AdminButton>
                )}
                {isOwner && jar.emergencyWithdrawalEnabled && (
                  <AdminButton variant="danger" size="sm" onClick={fn()}>
                    Emergency withdraw
                  </AdminButton>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-1.5 text-xs text-text-sub">
              <div className="flex items-center gap-1.5">
                <span className="whitespace-nowrap">Max Withdrawal:</span>
                <span>{formatTokenAmount(jar.maxWithdrawal, jar.decimals)}</span>
                {canManage && (
                  <AdminButton
                    variant="text"
                    size="sm"
                    className="h-5 w-5 min-w-0 rounded p-0"
                    onClick={fn()}
                    aria-label="Edit max withdrawal"
                  >
                    <RiPencilLine className="h-3 w-3" />
                  </AdminButton>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="whitespace-nowrap">Withdrawal Cooldown:</span>
                <span>{cooldown(jar.withdrawalInterval)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Jar Balance: {formatTokenAmount(jar.balance, jar.decimals)}</span>
              </div>
            </div>
          </AdminCard>
        ))}

        {jars.length === 0 && (
          <p className="py-6 text-center text-sm text-text-soft">
            No cookie jars found for this garden
          </p>
        )}
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
    maxWithdrawal: 200_000_000n,
    withdrawalInterval: 86_400n,
    isPaused: false,
    emergencyWithdrawalEnabled: true,
  },
  {
    jarAddress: "0xaaa2",
    symbol: "DAI",
    balance: 2_500_000_000_000_000_000_000n,
    decimals: 18,
    maxWithdrawal: 100_000_000_000_000_000_000n,
    withdrawalInterval: 21_600n,
    isPaused: true,
    emergencyWithdrawalEnabled: false,
  },
];

const meta: Meta<typeof CookieJarManageModalHarness> = {
  title: "Admin/Workflows/Hub/CookieJarManageModal",
  component: CookieJarManageModalHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `CookieJarManageModal`. Dialog listing cookie jars with inline edit controls, pause/resume, and emergency-withdraw actions. Real component wires six wagmi mutations plus `useGardenCookieJars`.",
      },
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    jars: JARS,
    canManage: true,
    isOwner: true,
  },
};

export default meta;
type Story = StoryObj<typeof CookieJarManageModalHarness>;

export const OwnerView: Story = {};

export const ManagerView: Story = {
  args: { isOwner: false },
};

export const ReadOnly: Story = {
  args: { canManage: false, isOwner: false },
};

export const Empty: Story = {
  args: { jars: [] },
};
