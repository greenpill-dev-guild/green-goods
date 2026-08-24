import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../../shared/.storybook/decorators";
import { SubmitWorkFlow } from "./SubmitWorkFlow";

const meta = {
  title: "Admin/Workflows/Garden/SubmitWorkFlow",
  component: SubmitWorkFlow,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withRouter(["/hub/work/submit"]),
    withCanvasFrame({ workspace: "garden", heightClassName: "h-[760px]" }),
  ],
  args: {
    layout: "page",
    auth: { authMode: null, isAuthenticated: false, primaryAddress: null },
    onCancel: fn(),
    onSuccess: fn(),
  },
} satisfies Meta<typeof SubmitWorkFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectWallet: Story = {};
