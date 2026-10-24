import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { AdminCard, AdminCardBody, AdminCardHeader } from "@/components/AdminCard";
import { CookieJarPayoutCard, type JarSettingField } from "./CookieJarPayoutCard";

// ⚠ VISUAL HARNESS — not the real CookieJarPayoutPanel.
// The real panel renders nothing until `useGardenCookieJars` (wagmi reads)
// returns a configured jar list, and it owns the deposit and claim dialogs.
// This harness keeps the panel chrome and renders the real
// `CookieJarPayoutCard` for each injected jar, a list of item rows that each
// open the jar's page, so the rows are the shipping ones and only the data
// source is faked.

const GARDEN = "0x1111111111111111111111111111111111111111";
// The default chain's DAI and WETH, so the claim-limit rule recognises the assets.
const DAI = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address as Address;
const WETH = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "weth")?.address as Address;

interface MockPayoutPanelProps {
  jars: CookieJar[];
}

function CookieJarPayoutPanelHarness({ jars }: MockPayoutPanelProps) {
  const [editing, setEditing] = useState<{ jarAddress: Address; field: JarSettingField } | null>(
    null
  );
  if (jars.length === 0) return null;

  return (
    <AdminCard density="none" className="overflow-hidden">
      <AdminCardHeader>
        <div>
          <h3 className="type-label-sm text-text-strong sm:type-title-md">Cookie Jars</h3>
          <p className="mt-1 type-body text-text-sub">
            Gardeners claim rewards from cookie jars for completed work
          </p>
        </div>
      </AdminCardHeader>

      <AdminCardBody className="space-y-3">
        <div className="flex flex-col gap-(--gg-list-gap)">
          {jars.map((jar) => (
            <CookieJarPayoutCard
              key={jar.jarAddress}
              jar={jar}
              gardenAddress={GARDEN}
              gardenName="Riverbend Garden"
              allocationCount={4}
              signer={{ canSign: true, isResolved: true }}
              editingField={editing?.jarAddress === jar.jarAddress ? editing.field : null}
              onEdit={(field) => setEditing(field ? { jarAddress: jar.jarAddress, field } : null)}
              onDeposit={fn()}
              onClaim={fn()}
            />
          ))}
        </div>
      </AdminCardBody>
    </AdminCard>
  );
}

const WETH_JAR: CookieJar = {
  jarAddress: "0x2C4F000000000000000000000000000000009b10",
  gardenAddress: GARDEN,
  assetAddress: WETH,
  currency: WETH,
  balance: 420_000_000_000_000_000n,
  decimals: 18,
  maxWithdrawal: 10_000_000_000_000_000n,
  withdrawalInterval: 86_400n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: true,
};

const JARS: CookieJar[] = [
  WETH_JAR,
  {
    ...WETH_JAR,
    jarAddress: "0x7A3d0000000000000000000000000000000041C2",
    assetAddress: DAI,
    currency: DAI,
    balance: 9_980_000_000_000_000_000n,
  },
];

const meta: Meta<typeof CookieJarPayoutPanelHarness> = {
  title: "Admin/Workflows/Hub/CookieJarPayoutPanel",
  component: CookieJarPayoutPanelHarness,
  tags: ["autodocs", "visual-harness"],
  decorators: [withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `CookieJarPayoutPanel`. The panel chrome around the real `CookieJarPayoutCard`s, with injected jars: one item row per jar, each opening the jar's page beneath it. The real panel is gated by wagmi reads inside `useGardenCookieJars` and owns the deposit and claim dialogs.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CookieJarPayoutPanelHarness>;

/** The live Arbitrum shape: a sensible WETH jar beside a DAI jar capped at one cent. */
export const WithJars: Story = {
  args: {
    jars: JARS,
  },
};

/** One jar's page open beneath its row; the other jar stays a row. */
export const WithOneJarOpen: Story = {
  tags: ["storybook-ci"],
  args: {
    jars: JARS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [weth, dai] = canvas.getAllByRole("button", { expanded: false });
    await userEvent.click(dai);
    await expect(dai).toHaveAttribute("aria-expanded", "true");
    await expect(weth).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.getByRole("button", { name: "Edit Per-Claim Limit" })).toBeVisible();
    // Every jar row keeps one height, whichever page is open.
    const heights = [weth, dai].map((row) => Math.round(row.getBoundingClientRect().height));
    await expect(heights[0]).toBe(heights[1]);
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
