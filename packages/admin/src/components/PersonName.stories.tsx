import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminInputChip } from "./AdminInputChip";
import { PersonName } from "./PersonName";

const LINA = "0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d" as Address;
const MARA = "0x2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e" as Address;
const UNNAMED = "0x7e21f9c04a7e21f9c04a7e21f9c04a7e21f9c04a" as Address;

/**
 * The two lookups answered ahead of time, so no story reaches for an RPC: Lina
 * has a Green Goods name, Mara only an ENS name, and the third address neither.
 */
function WithNames({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const seeded = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    seeded.setQueryData(queryKeys.ens.protocolName(LINA.toLowerCase()), "lina.greengoods.eth");
    seeded.setQueryData(queryKeys.ens.protocolName(MARA.toLowerCase()), null);
    seeded.setQueryData(queryKeys.ens.name(MARA.toLowerCase()), "mara.eth");
    seeded.setQueryData(queryKeys.ens.protocolName(UNNAMED.toLowerCase()), null);
    seeded.setQueryData(queryKeys.ens.name(UNNAMED.toLowerCase()), null);
    return seeded;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta: Meta<typeof PersonName> = {
  title: "Admin/Components/PersonName",
  component: PersonName,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <WithNames>
        <Story />
      </WithNames>
    ),
    withAdminPrimitiveFrame,
  ],
  parameters: {
    docs: {
      description: {
        component:
          "What the cockpit calls a person (PRD-1025 D11): their Green Goods name first, then their ENS name, then a short address, never a raw hex string. One lookup and one style, 14px semibold, so a confirmer chip, a member suggestion and a Review Promises row name the same person the same way. The full address stays in the hover title.",
      },
    },
  },
  args: { address: LINA },
};

export default meta;
type Story = StoryObj<typeof PersonName>;

export const GreenGoodsName: Story = {};

export const EnsName: Story = { args: { address: MARA } };

/** Nobody named this account, so it reads as a short address. */
export const AddressOnly: Story = { args: { address: UNNAMED } };

/** A caller that builds its own element around the name, as a confirmer chip does. */
export const InAChip: Story = {
  args: {
    children: (name: string) => (
      <AdminInputChip
        label={name}
        text={name}
        avatar="L"
        removeLabel={`Remove ${name}`}
        onRemove={() => {}}
      />
    ),
  },
};
