import React, { useEffect } from "react";
import type { ComponentType } from "react";
import "./storybook.css";
import type { Preview } from "@storybook/react";
import { useGlobals } from "storybook/preview-api";
import { IntlProvider } from "react-intl";
import messages from "../src/i18n/en.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

// I18n decorator - provides react-intl context for all stories
const I18nDecorator = (Story: ComponentType) => (
  <IntlProvider locale="en" messages={messages}>
    <Story />
  </IntlProvider>
);

// React Query decorator - provides query context for all stories
const QueryDecorator = (Story: ComponentType) => (
  <QueryClientProvider client={queryClient}>
    <Story />
  </QueryClientProvider>
);

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
  decorators: [QueryDecorator, I18nDecorator, ThemeDecorator],
};

export default preview;
