import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../../../docs/static/img"],
  viteFinal: async (config) => {
    // Ensure automatic JSX runtime is used
    config.plugins = config.plugins?.filter(
      (plugin) =>
        !(Array.isArray(plugin) ? plugin[0] : plugin)?.name?.includes("react")
    );
    config.plugins?.push(
      // Tailwind CSS v4 Vite plugin for CSS-first configuration
      tailwindcss(),
      react({
        jsxRuntime: "automatic",
      })
    );
    return config;
  },
};

export default config;
