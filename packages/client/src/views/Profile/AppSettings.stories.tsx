import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import type { Meta, StoryObj } from "@storybook/react";
import { AppSettings } from "./AppSettings";
/** The production settings rows, with the preview's real idle update state. */
const meta: Meta<typeof AppSettings> = {
  title: "Client/Documentation/AppSettings",
  component: AppSettings,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <ServiceWorkerUpdateProvider>
          <Story />
        </ServiceWorkerUpdateProvider>
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof AppSettings>;
export const Current: Story = {};
