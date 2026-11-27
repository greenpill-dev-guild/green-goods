import {
  CREATE_ASSESSMENT_ROUTE_ITEM,
  CREATE_HYPERCERT_ROUTE_ITEM,
  SUBMIT_WORK_ROUTE_ITEM,
} from "@green-goods/shared/utils/navigation/admin-routes";
import type { Meta, StoryObj } from "@storybook/react";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../../shared/.storybook/decorators";
import { ReviewFlowDialogs } from "./ReviewFlowDialogs";

const meta = {
  title: "Admin/Workflows/Review/ReviewFlowDialogs",
  component: ReviewFlowDialogs,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withDataRouter("/review/assess"),
  ],
} satisfies Meta<typeof ReviewFlowDialogs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SubmitWork: Story = { args: { item: SUBMIT_WORK_ROUTE_ITEM } };
export const CreateAssessment: Story = { args: { item: CREATE_ASSESSMENT_ROUTE_ITEM } };
export const CreateHypercert: Story = { args: { item: CREATE_HYPERCERT_ROUTE_ITEM } };
