import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function packageScopedAliasPlugin(adminSrc: string, clientSrc: string): Plugin {
  const adminRoot = resolve(adminSrc, "..");
  const clientRoot = resolve(clientSrc, "..");

  return {
    name: "storybook-test-package-scoped-alias",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.startsWith("@/") || !importer) return null;

      const relative = source.slice(2);
      let rewritten: string | null = null;

      if (importer.includes(adminRoot)) {
        rewritten = resolve(adminSrc, relative);
      } else if (importer.includes(clientRoot)) {
        rewritten = resolve(clientSrc, relative);
      }

      if (!rewritten) return null;

      const resolved = await this.resolve(rewritten, importer, { skipSelf: true });
      return resolved || null;
    },
  };
}

const adminSrc = resolve(__dirname, "../admin/src");
const clientSrc = resolve(__dirname, "../client/src");
const sharedSrc = resolve(__dirname, "src");
const contractsDir = resolve(__dirname, "../contracts");

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          tailwindcss(),
          react({ jsxRuntime: "automatic" }),
          packageScopedAliasPlugin(adminSrc, clientSrc),
          storybookTest({
            configDir: resolve(__dirname, ".storybook"),
            storybookScript: "bun run storybook -- --no-open",
            tags: {
              include: ["storybook-ci"],
              exclude: ["visual-harness"],
            },
          }),
        ],
        resolve: {
          alias: {
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
          },
          dedupe: ["react", "react-dom"],
        },
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
          isolate: false,
        },
      },
    ],
  },
});
