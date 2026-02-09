import React, { useEffect } from "react";
import type { ComponentType } from "react";
import "./storybook.css";
import type { Preview } from "@storybook/react";
import { useGlobals } from "@storybook/preview-api";

// Theme toggle decorator - syncs with Storybook toolbar
const ThemeDecorator = (Story: ComponentType) => {
  const [{ theme }] = useGlobals();
  const currentTheme = theme || "light";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
  }, [currentTheme]);

  return (
    <div data-theme={currentTheme} className="p-4 min-h-screen bg-bg-white-0 text-text-strong-950">
      <Story />
    </div>
  );
};

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
  decorators: [ThemeDecorator],
};

export default preview;
