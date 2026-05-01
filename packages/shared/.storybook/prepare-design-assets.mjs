import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const storybookDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(storybookDir, "../../..");
const outputDir = resolve(repoRoot, "tmp/storybook-design-assets");
const legacyOutputDir = resolve(storybookDir, "public/design");
const publicUrl = "https://design.greengoods.app";

const files = [
  {
    from: "DESIGN.md",
    to: "DESIGN.md",
    role: "Canonical Warm Earth DesignMD source",
  },
  {
    from: "packages/client/DESIGN.browser.md",
    to: "DESIGN.browser.md",
    role: "Public browser dialect overlay",
  },
  {
    from: "packages/client/DESIGN.pwa.md",
    to: "DESIGN.pwa.md",
    role: "Installed PWA dialect overlay",
  },
  {
    from: "packages/admin/DESIGN.md",
    to: "DESIGN.admin.md",
    role: "Admin dialect overlay",
  },
  {
    from: "docs/DESIGN.md",
    to: "DESIGN.docs.md",
    role: "Docs dialect overlay",
  },
  {
    from: "packages/shared/src/styles/theme.css",
    to: "theme.css",
    role: "Runtime token projection",
  },
  {
    from: "packages/shared/src/styles/design-md.generated.css",
    to: "design-md.generated.css",
    role: "Generated CSS tokens",
  },
  {
    from: "packages/shared/src/styles/design-md.generated.json",
    to: "design-md.generated.json",
    role: "Generated machine-readable DesignMD tokens",
  },
];

const assetFiles = [
  {
    from: "docs/static/img/green-goods-logo.png",
    to: "green-goods-logo.png",
    role: "Storybook chrome logo",
  },
  {
    from: "packages/shared/.storybook/social-card.png",
    to: "social-card.png",
    role: "Open Graph and Twitter social preview image",
  },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

rmSync(outputDir, { recursive: true, force: true });
rmSync(legacyOutputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of files) {
  copyFileSync(resolve(repoRoot, file.from), resolve(outputDir, file.to));
}

for (const file of assetFiles) {
  copyFileSync(resolve(repoRoot, file.from), resolve(outputDir, file.to));
}

const generatedTokens = readJson(
  resolve(repoRoot, "packages/shared/src/styles/design-md.generated.json"),
);
const sourceRepository =
  process.env.GITHUB_REPOSITORY ||
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : "greenpill-dev-guild/green-goods");
const sourceCommit =
  process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || readGitCommit();

const manifest = {
  schemaVersion: 1,
  name: "Green Goods Component Library",
  description:
    "Storybook-backed component library and Warm Earth design exports for Green Goods.",
  preferredDialect: "public-browser",
  publicUrl,
  designBundleUrl: publicUrl,
  socialPreviewImage: "./social-card.png",
  generatedAt: new Date().toISOString(),
  source: {
    repository: sourceRepository,
    commit: sourceCommit,
  },
  storybook: {
    storyIndex: "./index.json",
    previewFrame: "./iframe.html",
    localDevCommand: "bun --cwd packages/shared run storybook",
    mcpAddon: "@storybook/addon-mcp",
    mcpScope: "Local Storybook development server",
  },
  design: {
    canonical: "./DESIGN.md",
    browserDialect: "./DESIGN.browser.md",
    pwaDialect: "./DESIGN.pwa.md",
    adminDialect: "./DESIGN.admin.md",
    docsDialect: "./DESIGN.docs.md",
    runtimeCss: "./theme.css",
    generatedCss: "./design-md.generated.css",
    generatedJson: "./design-md.generated.json",
    tokenSummary: {
      colors: Object.keys(generatedTokens.colors ?? {}),
      typography: Object.keys(generatedTokens.typography ?? {}),
      rounded: Object.keys(generatedTokens.rounded ?? {}),
      spacing: Object.keys(generatedTokens.spacing ?? {}),
    },
  },
  componentNamespaces: [
    {
      storyPrefix: "Shared/Primitives",
      importSurface: "@green-goods/shared/components",
      purpose: "Reusable component foundations.",
    },
    {
      storyPrefix: "Shared/Canvas",
      importSurface: "@green-goods/shared/components",
      purpose: "Shared shell, sheet, navigation, and workbench foundations.",
    },
    {
      storyPrefix: "Shared/Tokens",
      importSurface: "@green-goods/shared/styles/theme.css",
      purpose: "Visual token documentation and runtime token references.",
    },
    {
      storyPrefix: "Client/Public",
      importSurface: "packages/client/src",
      purpose: "Public browser shell, route frames, and navigation states.",
    },
    {
      storyPrefix: "Client/PWA",
      importSurface: "packages/client/src",
      purpose: "Installed PWA shell and mobile field-tool states.",
    },
    {
      storyPrefix: "Admin/Primitives",
      importSurface: "packages/admin/src/components/Admin*.tsx",
      purpose: "Admin Material 3 wrapper primitives.",
    },
  ],
  toolImports: [
    {
      tool: "Google Stitch",
      load: [
        "./DESIGN.md",
        "./DESIGN.browser.md",
        "./design-md.generated.json",
      ],
      note: "Use the root DesignMD file plus the public-browser dialect for browser-facing component work.",
    },
    {
      tool: "Claude Design",
      load: [
        "./README.md",
        "./DESIGN.md",
        "./DESIGN.browser.md",
        "./index.json",
      ],
      note: "Use the Storybook story index for component names and states; use DesignMD files for styling rules.",
    },
    {
      tool: "Storybook MCP",
      load: ["bun --cwd packages/shared run storybook"],
      note: "The MCP addon is intended for local dev server use; static deploys still expose the story index and design assets.",
    },
  ],
  files: files.map((file) => ({
    path: `./${file.to}`,
    source: file.from,
    role: file.role,
  })),
  assets: assetFiles.map((file) => ({
    path: `./${file.to}`,
    source: file.from,
    role: file.role,
  })),
};

writeFileSync(
  resolve(outputDir, "storybook-design-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

writeFileSync(
  resolve(outputDir, "README.md"),
  `# Green Goods Storybook Design Exports

Use this folder as the import surface for design and agent tools.

- Deployed base: \`${publicUrl}/\`.
- \`DESIGN.md\` is the canonical Warm Earth DesignMD source.
- \`DESIGN.browser.md\` is the preferred dialect for the deployed component library.
- \`design-md.generated.json\` is the machine-readable token export.
- \`theme.css\` is the runtime CSS projection used by components.
- \`storybook-design-manifest.json\` links these files to Storybook's \`./index.json\`.
- \`social-card.png\` is the 1200x630 preview image used by shared Storybook links.

For Google Stitch, load \`${publicUrl}/DESIGN.md\`, \`${publicUrl}/DESIGN.browser.md\`, and \`${publicUrl}/design-md.generated.json\`.
For Claude Design, load this README, both DesignMD files, and the Storybook \`${publicUrl}/index.json\`.
For component states, use the Storybook sidebar or \`./index.json\` rather than guessing component names.
`,
);

console.log(`Prepared Storybook design assets in ${outputDir}`);
