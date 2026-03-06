import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Custom Vite plugin to resolve `@/` imports based on the importing file's package.
 * Both admin and client use `@/` as an alias to their own `src/` directory.
 * A static alias can only point to one, so we resolve dynamically based on the
 * importer's filesystem path.
 */
function packageScopedAliasPlugin(
  adminSrc: string,
  clientSrc: string,
): Plugin {
  const adminRoot = resolve(adminSrc, "..");
  const clientRoot = resolve(clientSrc, "..");

  return {
    name: "package-scoped-alias",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.startsWith("@/") || !importer) return null;

      const relative = source.slice(2); // strip "@/"
      let rewritten: string | null = null;

      if (importer.includes(adminRoot)) {
        rewritten = resolve(adminSrc, relative);
      } else if (importer.includes(clientRoot)) {
        rewritten = resolve(clientSrc, relative);
      }

      if (!rewritten) return null;

      // Delegate back to Vite's resolver to handle extensions (.tsx, .ts, /index.tsx)
      const resolved = await this.resolve(rewritten, importer, { skipSelf: true });
      return resolved || null;
    },
  };
}

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "../../../packages/admin/src/**/*.stories.@(ts|tsx)",
    "../../../packages/client/src/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-actions",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../../../docs/static/img"],
  viteFinal: async (config) => {
    const adminSrc = resolve(__dirname, "../../admin/src");
    const clientSrc = resolve(__dirname, "../../client/src");
    const sharedSrc = resolve(__dirname, "../src");
    const contractsDir = resolve(__dirname, "../../contracts");

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
      }),
      // Dynamic @/ alias resolution — admin and client both use @/ -> ./src
      packageScopedAliasPlugin(adminSrc, clientSrc),
    );

    // Cross-package aliases for shared and contracts
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@green-goods/shared": sharedSrc,
      "@green-goods/shared/components": resolve(sharedSrc, "components"),
      "@green-goods/shared/hooks": resolve(sharedSrc, "hooks"),
      "@green-goods/shared/providers": resolve(sharedSrc, "providers"),
      "@green-goods/shared/modules": resolve(sharedSrc, "modules"),
      "@green-goods/shared/utils": resolve(sharedSrc, "utils"),
      "@green-goods/shared/config": resolve(sharedSrc, "config"),
      "@green-goods/shared/types": resolve(sharedSrc, "types"),
      "@green-goods/shared/stores": resolve(sharedSrc, "stores"),
      "@green-goods/shared/mocks": resolve(sharedSrc, "mocks"),
      "@green-goods/shared/i18n": resolve(sharedSrc, "i18n"),
      "@green-goods/shared/workflows": resolve(sharedSrc, "workflows"),
      "@green-goods/shared/constants": resolve(sharedSrc, "constants"),
      "@green-goods/contracts/deployments": resolve(contractsDir, "deployments"),
      "@green-goods/contracts/abis": resolve(contractsDir, "abis"),
    };

    return config;
  },
};

export default config;
