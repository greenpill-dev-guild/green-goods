import { RiExternalLinkLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { AdminCard, AdminCardBody, AdminCardHeader } from "@/components/AdminCard";

// ⚠ VISUAL HARNESS — not the real VaultContractDetails.
// The real component self-fetches through `useGardenVaults` (React Query +
// wagmi contract reads) and renders every address through `EnsAddressText`
// (an ENS reverse-resolution hook). None of that chain is seedable in
// Storybook, so this harness accepts the already-resolved contract rows
// directly and reproduces the exact AdminCard + stacked-row layout. Treat it as a
// design-system surface, NOT a real-component behavior test.

interface ContractRow {
  label: string;
  display: string;
  href: string;
}

interface VaultContractDetailsHarnessProps {
  rows: ContractRow[];
}

const rowClass = "rounded-md border border-stroke-soft bg-bg-weak px-3 py-2";
const linkClass = "mt-0.5 inline-flex items-center gap-1 body-xs text-primary-dark hover:underline";

function VaultContractDetailsHarness({ rows }: VaultContractDetailsHarnessProps) {
  if (rows.length === 0) return null;

  return (
    <AdminCard density="none">
      <AdminCardHeader>
        <h3 className="label-md text-text-strong">Contract Details</h3>
      </AdminCardHeader>
      <AdminCardBody className="space-y-2">
        {rows.map((row) => (
          <div key={row.href} className={rowClass}>
            <p className="body-xs text-text-soft">{row.label}</p>
            <a href={row.href} target="_blank" rel="noreferrer" className={linkClass}>
              {row.display}
              <RiExternalLinkLine className="h-3 w-3" />
            </a>
          </div>
        ))}
      </AdminCardBody>
    </AdminCard>
  );
}

const explorer = (address: string) => `https://arbiscan.io/address/${address}`;
const trunc = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const usdcVault: ContractRow = {
  label: "USDC Vault",
  display: trunc("0x1f98431c8ad98523631ae4a59f267346ea31f984"),
  href: explorer("0x1f98431c8ad98523631ae4a59f267346ea31f984"),
};
const wethVault: ContractRow = {
  label: "WETH Vault",
  display: trunc("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
  href: explorer("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
};
const registryRow: ContractRow = {
  label: "Vault Registry",
  display: trunc("0x9e1a8fB0BdeCc86B0FE3F1B6E9dD2f9a5b1c0dEa"),
  href: explorer("0x9e1a8fB0BdeCc86B0FE3F1B6E9dD2f9a5b1c0dEa"),
};
const aaveRow: ContractRow = {
  label: "Aave V3 Pool",
  display: trunc("0x794a61358d6845594f94dc1db02a252b5b4814ad"),
  href: explorer("0x794a61358d6845594f94dc1db02a252b5b4814ad"),
};

const meta: Meta<typeof VaultContractDetailsHarness> = {
  title: "Admin/Workflows/Vault/VaultContractDetails",
  component: VaultContractDetailsHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `VaultContractDetails`. Renders the same always-visible contract-address reference (an `AdminCard` of stacked label-over-address rows for the narrow endowment rail) using plain props. The real component self-fetches via `useGardenVaults` and resolves each address through `EnsAddressText`, a chain that terminates in wagmi reads not seedable in Storybook.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VaultContractDetailsHarness>;

export const WithVaults: Story = {
  args: { rows: [usdcVault, wethVault, registryRow, aaveRow] },
};

export const SingleVault: Story = {
  args: { rows: [usdcVault] },
  parameters: {
    docs: {
      description: {
        story:
          "A garden with one endowment vault and no registry or Aave pool wired — only the vault row renders.",
      },
    },
  },
};

export const EmptyHidden: Story = {
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        story:
          "The component returns null when there are no vault contracts. Expect an empty render surface.",
      },
    },
  },
};
