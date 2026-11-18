import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { STORY_ANA, STORY_GARDEN, STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import { EditConfirmersDialog } from "./EditConfirmersDialog";

const meta: Meta<typeof EditConfirmersDialog> = {
  title: "Admin/Pool/EditConfirmersDialog",
  component: EditConfirmersDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Edit Confirmers, from a group's inspector while any copy is untaken, or a single promise's while nobody has taken it. It names one group and threshold for every copy nobody has taken, so a steward can name the account that replaced a lost one; the copies already taken keep the confirmers they were taken up with, because the contract fixes them at take-up. A passkey is asked once per copy.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    onChanged: () => undefined,
    chainId: DEFAULT_CHAIN_ID,
    garden: STORY_GARDEN,
    isProtocol: false,
    title: "Complete the climate course",
    available: [
      { commitmentId: 21n, protocolFallbackEnabled: true },
      { commitmentId: 22n, protocolFallbackEnabled: true },
      { commitmentId: 23n, protocolFallbackEnabled: true },
    ],
    current: { confirmers: [STORY_MARIA, STORY_JOAO], confirmationThreshold: 1 },
    direction: "REQUEST",
    taken: 4,
  },
  decorators: [withAdminIdentity, withSeededQueryClient([...STORYBOOK_ADMIN_SHELL_SEEDS])],
};

export default meta;
type Story = StoryObj<typeof EditConfirmersDialog>;

/** Three still available, four taken: the four keep the confirmers they were taken up with. */
export const FourTaken: Story = {};

/** One promise on its own, in its own inspector. */
export const SinglePromise: Story = {
  args: {
    title: "Clinic rides on Thursdays",
    available: [{ commitmentId: 11n, protocolFallbackEnabled: false }],
    current: { confirmers: [STORY_ANA], confirmationThreshold: 1 },
    direction: "OFFER",
    taken: 0,
  },
};

/** Nobody named yet: the one who asked confirms, until the steward names a group. */
export const OrdinaryRule: Story = {
  args: { current: { confirmers: [], confirmationThreshold: 1 }, taken: 0 },
};

/** An earlier change didn't reach every copy, so saving the same group is allowed. */
export const MixedAvailable: Story = { args: { mixed: true } };

export const Spanish: Story = {
  args: { title: "Completar el curso sobre el clima" },
  decorators: [
    (Story) => (
      <IntlProvider locale="es" messages={es}>
        <Story />
      </IntlProvider>
    ),
  ],
};

export const Portuguese: Story = {
  args: { title: "Concluir o curso sobre o clima" },
  decorators: [
    (Story) => (
      <IntlProvider locale="pt" messages={pt}>
        <Story />
      </IntlProvider>
    ),
  ],
};
