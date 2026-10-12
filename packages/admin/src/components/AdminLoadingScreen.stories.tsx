import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../shared/.storybook/decorators";
import { AdminLoadingScreen } from "./AdminLoadingScreen";

const meta = {
  title: "Admin/Shell/AdminLoadingScreen",
  component: AdminLoadingScreen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    withCanvasFrame({ workspace: "home", className: "-m-4 p-0", heightClassName: "min-h-dvh" }),
  ],
  args: { label: "Opening your workspace…", locale: "en" },
} satisfies Meta<typeof AdminLoadingScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Spanish: Story = {
  args: { label: "Abriendo tu espacio de trabajo…", locale: "es" },
};
export const Portuguese: Story = {
  args: { label: "Abrindo seu espaço de trabalho…", locale: "pt" },
};
