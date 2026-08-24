import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Storybook alias map for `@green-goods/shared`, derived from the package's own
 * `exports` field.
 *
 * The declared subpaths are the public API (CLAUDE.md Rule 11), so they are the
 * only correct source for this map. A hand-maintained list was kept here
 * previously and drifted: it guessed that every subpath lives at
 * `src/<subpath>`, which is false for fourteen of them — `./public` resolves to
 * `src/hooks/public/publicSurfaceState.ts`, `./cards` to
 * `src/components/Cards/`, `./toast` to `src/components/toast.ts`, `./testing`
 * into `src/__tests__/`, and so on. Those guesses pointed at paths that do not
 * exist, so any story importing one failed to resolve.
 *
 * Keys are emitted longest-first because Vite matches object aliases by prefix:
 * `.../mocks/browser` has to be tried before `.../mocks`, and
 * `.../styles/utilities.css` before `.../styles`, or the shorter key would
 * swallow the longer path and rewrite it to a nonsense target.
 */
function sharedSubpathAliases(sharedDir: string): Record<string, string> {
  const { exports: declared } = JSON.parse(
    readFileSync(resolve(sharedDir, "package.json"), "utf8"),
  ) as { exports: Record<string, string> };

  return Object.entries(declared)
    .filter(([subpath]) => subpath !== ".")
    .sort(([a], [b]) => b.length - a.length)
    .reduce<Record<string, string>>((aliases, [subpath, target]) => {
      aliases[`@green-goods/shared/${subpath.slice(2)}`] = resolve(sharedDir, target);
      return aliases;
    }, {});
}
const isStaticBuild = process.env.STORYBOOK_STATIC_BUILD === "true";
const addons: NonNullable<StorybookConfig["addons"]> = [
  "@storybook/addon-a11y",
  "@storybook/addon-docs",
  "@storybook/addon-vitest",
  "@storybook/addon-mcp",
];

if (!isStaticBuild) {
  addons.push("@chromatic-com/storybook");
}

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
  addons,
  docs: {
    autodocs: "tag",
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: isStaticBuild
    ? []
    : [
        { from: "../../../tmp/storybook-design-assets", to: "/" },
      ],
  typescript: {
    // TypeScript 7 (native port) dropped the JS compiler-API enums that
    // react-docgen-typescript reads, so its TS-based parser can't run under TS7. Use
    // the JS-based react-docgen engine instead. (A companion patch,
    // patches/react-docgen-typescript@2.4.0.patch, keeps @storybook/react's static
    // import of that package from crashing at load.) Revert both when
    // react-docgen-typescript supports TS7-native.
    reactDocgen: "react-docgen",
  },
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
      // Declared subpaths first, longest-first; the bare package name below is
      // the fallback for the root export only.
      ...sharedSubpathAliases(resolve(sharedSrc, "..")),
      "@green-goods/shared": sharedSrc,
      "@green-goods/contracts/deployments": resolve(contractsDir, "deployments"),
      "@green-goods/contracts/abis": resolve(contractsDir, "abis"),
    };

    return config;
  },
};

export default config;
