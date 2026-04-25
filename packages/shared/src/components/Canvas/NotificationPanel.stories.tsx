import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { NotificationPanel } from "./NotificationPanel";

const meta: Meta<typeof NotificationPanel> = {
  title: "Shared/Canvas/NotificationPanel",
  component: NotificationPanel,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof NotificationPanel>;

export const Default: Story = {
  render: () => (
    <IntlProvider locale="en" messages={{}}>
      <div className="max-w-sm rounded-2xl bg-bg-white">
        <NotificationPanel />
      </div>
    </IntlProvider>
  ),
};
