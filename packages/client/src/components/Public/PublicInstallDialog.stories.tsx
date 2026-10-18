import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { InstallGuidance } from "@green-goods/shared/hooks/app/useInstallGuidance";
import { PublicInstallDialog } from "./PublicInstallDialog";
const guidance = (ios: boolean): InstallGuidance => ({
  browserInfo: {
    browser: ios ? "safari" : "chrome",
    supportsNativePWA: !ios,
    isRecommendedBrowser: true,
    isInAppBrowser: false,
    displayName: ios ? "Safari" : "Chrome",
  },
  scenario: "manual-install-available",
  primaryAction: { type: "show-manual-steps", label: "Install" },
  secondaryAction: null,
  showBrowserOption: true,
  manualInstructions: ios
    ? [
        {
          stepNumber: 1,
          icon: "share",
          title: "Step 1",
          description: "Tap the **Share** button in your browser bar.",
        },
        {
          stepNumber: 2,
          icon: "add",
          title: "Step 2",
          description: "Scroll down and tap **Add to Home Screen**.",
        },
      ]
    : [
        {
          stepNumber: 1,
          icon: "menu",
          title: "Step 1",
          description: "Tap the **Menu** button (three dots).",
        },
        {
          stepNumber: 2,
          icon: "install",
          title: "Step 2",
          description: "Select **Add to Home Screen** or **Install App**.",
        },
      ],
  browserSwitchReason: null,
  openInBrowserUrl: null,
});
const meta: Meta<typeof PublicInstallDialog> = {
  title: "Public/Documentation/Install",
  component: PublicInstallDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    mode: "mobileSteps",
    launchUrl: "https://greengoods.app",
    guidance: guidance(true),
    onOpenChange: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof PublicInstallDialog>;
export const IPhone: Story = {};
export const Android: Story = { args: { guidance: guidance(false) } };
