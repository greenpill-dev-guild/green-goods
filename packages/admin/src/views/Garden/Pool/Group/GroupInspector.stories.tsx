import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { groupCommitmentsForDisplay } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { Meta, StoryObj } from "@storybook/react";
import { createIntl, IntlProvider } from "react-intl";
import { expect, screen } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import type { PoolCommitmentGroup } from "../poolCommitmentRows";
import {
  STORY_GROUP_COPIES,
  STORY_GROUP_EVENTS,
  STORY_GROUP_METADATA,
  STORY_GROUP_TITLES,
  STORY_GROUP_WAITING_ON_YOU,
  STORY_NOW,
  STORY_PRICE_STATE,
} from "../poolStoryFixtures";
import { GroupInspector } from "./GroupInspector";
import { groupSetAt } from "./groupInspectorModel";
import { groupReward, groupTerms } from "./groupTerms";

const intl = createIntl({ locale: "en", messages: {} });

function groupOf(copies: typeof STORY_GROUP_COPIES) {
  const [group] = groupCommitmentsForDisplay({
    commitments: copies,
    metadataByCID: STORY_GROUP_TITLES,
  }) as [PoolCommitmentGroup];
  return group;
}

function termsOf(group: PoolCommitmentGroup, events = STORY_GROUP_EVENTS, termsIntl = intl) {
  return groupTerms({
    intl: termsIntl,
    children: group.children,
    metadata: STORY_GROUP_METADATA,
    reward: groupReward(group.children, STORY_GROUP_TITLES),
    price: STORY_PRICE_STATE,
    setAt: groupSetAt(group.children, events),
    now: Number(STORY_NOW) * 1000,
  });
}

const SURVEY = groupOf(STORY_GROUP_COPIES);
/** A newer group: two taken, none kept, so its reward can still change (D14). */
const NEWER = groupOf([...STORY_GROUP_COPIES.slice(0, 4), ...STORY_GROUP_COPIES.slice(5, 7)]);

const meta: Meta<typeof GroupInspector> = {
  title: "Admin/Pool/GroupInspector",
  component: GroupInspector,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The group inspector (PRD-1022 screen 14): the group's terms, its counts and filters, then a row for each person who took a copy, led by their name with the state on the right, and one row for the copies nobody has taken. It fits the screen: on wide screens the terms stay put and only the list scrolls; on narrow ones they scroll away with it. There is no group approval: every row opens that promise's own inspector. Edit Reward sits beside Seed More Like This until one copy is kept.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    group: SURVEY,
    title: "Household water survey",
    cycleName: "Season of First Rains",
    chainId: DEFAULT_CHAIN_ID,
    terms: termsOf(SURVEY),
    rewarded: true,
    canEditReward: false,
    events: STORY_GROUP_EVENTS,
    waitingOnYou: STORY_GROUP_WAITING_ON_YOU,
    onOpenCommitment: () => undefined,
    onSeedMore: () => undefined,
    onEditReward: () => undefined,
  },
  decorators: [withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS)],
};

export default meta;
type Story = StoryObj<typeof GroupInspector>;

/** Five days in: two kept, so the reward is settled and only Seed More Like This is offered. */
export const FiveDaysIn: Story = {
  play: async () => {
    await expect(await screen.findByText("4 not taken up yet")).toBeInTheDocument();
    await expect(screen.queryByRole("button", { name: "Edit Reward" })).not.toBeInTheDocument();
  },
};

export const EditRewardOpen: Story = {
  args: { group: NEWER, terms: termsOf(NEWER), canEditReward: true },
};

/** Without the pool's activity the dates are left out; what the records say still shows. */
export const WithoutActivity: Story = { args: { events: [], terms: termsOf(SURVEY, []) } };

export const Spanish: Story = {
  decorators: [
    (Story) => (
      <IntlProvider locale="es" messages={es}>
        <Story />
      </IntlProvider>
    ),
  ],
  args: {
    title: "Encuesta sobre el agua en los hogares",
    cycleName: "Temporada de las primeras lluvias",
    terms: termsOf(SURVEY, STORY_GROUP_EVENTS, createIntl({ locale: "es", messages: es })),
  },
};

export const Portuguese: Story = {
  decorators: [
    (Story) => (
      <IntlProvider locale="pt" messages={pt}>
        <Story />
      </IntlProvider>
    ),
  ],
  args: {
    title: "Pesquisa sobre a água das famílias",
    cycleName: "Temporada das primeiras chuvas",
    terms: termsOf(SURVEY, STORY_GROUP_EVENTS, createIntl({ locale: "pt", messages: pt })),
  },
};
