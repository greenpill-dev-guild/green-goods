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
    // Viewport toolbar (built into Storybook 10 core — no addon dependency). Lets
    // any story be rendered at mobile/tablet widths so media queries respond,
    // which is how we verify the admin flows' bottom-sheet + two-column breakpoints.
    viewport: {
      options: {
        mobile: { name: "Mobile (375)", styles: { width: "375px", height: "812px" }, type: "mobile" },
        tablet: { name: "Tablet (768)", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        desktop: { name: "Desktop (1280)", styles: { width: "1280px", height: "800px" }, type: "desktop" },
      },
    },
  },
  decorators: [withAdminStoryIsolation, withQueryClient, withI18n, withTheme],
};

export default preview;
