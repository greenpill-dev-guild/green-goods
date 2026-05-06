import "./storybook.css";
import type { Preview } from "@storybook/react";
import { withAdminStoryIsolation, withI18n, withQueryClient, withTheme } from "./decorators";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true }, // Handled by theme decorator
  },
  decorators: [withAdminStoryIsolation, withQueryClient, withI18n, withTheme],
};

export default preview;
