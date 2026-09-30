import { useYourWorkCount } from "@green-goods/shared/hooks/work/useYourWorkCount";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, within } from "storybook/test";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { WorkDashboardIcon } from "./Icon";

const withCount = (count: number) => () => {
  mocked(useYourWorkCount).mockReturnValue({ count });
  return resetHookMocks(useYourWorkCount);
};

/**
 * Home's Your Work button (D1): its badge counts everything still on this
 * phone, drafts, work to upload and unsent proof, and leaves out sent work
 * waiting for a review.
 */
const meta: Meta<typeof WorkDashboardIcon> = {
  title: "Client/Work/WorkDashboardIcon",
  component: WorkDashboardIcon,
  decorators: [withRouter(["/home"])],
};

export default meta;
type Story = StoryObj<typeof WorkDashboardIcon>;

/** Frame `home`: eight on this phone. */
export const EightOnThisPhone: Story = {
  tags: ["storybook-ci"],
  beforeEach: withCount(8),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("notification-badge")).toHaveTextContent("8");
  },
};

/** Nothing on this phone: no badge. */
export const NothingOnThisPhone: Story = {
  beforeEach: withCount(0),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId("notification-badge")).toBeNull();
  },
};
