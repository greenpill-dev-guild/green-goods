import type { Meta, StoryObj } from "@storybook/react";

const storybookUrl = "https://design.greengoods.app";

const importFiles = [
  {
    label: "DesignMD core",
    path: `${storybookUrl}/DESIGN.md`,
    use: "Canonical Warm Earth tokens, voice, and role model.",
  },
  {
    label: "Browser dialect",
    path: `${storybookUrl}/DESIGN.browser.md`,
    use: "Preferred dialect for public browser and deployed Storybook work.",
  },
  {
    label: "Token JSON",
    path: `${storybookUrl}/design-md.generated.json`,
    use: "Machine-readable colors, type, radius, and spacing.",
  },
  {
    label: "Runtime CSS",
    path: `${storybookUrl}/theme.css`,
    use: "CSS custom properties and Tailwind theme projection used by components.",
  },
  {
    label: "Story index",
    path: `${storybookUrl}/index.json`,
    use: "Storybook component and state catalog for agents and design tools.",
  },
  {
    label: "Manifest",
    path: `${storybookUrl}/storybook-design-manifest.json`,
    use: "Single machine-readable map across design files, stories, and import surfaces.",
  },
];

const componentRoots = [
  {
    root: "Shared/Tokens",
    source: "@green-goods/shared/styles/theme.css",
    use: "Design tokens, motion, material roles, typography, and shadows.",
  },
  {
    root: "Shared/Primitives",
    source: "@green-goods/shared/components",
    use: "Reusable foundations for forms, cards, feedback, display, and controls.",
  },
  {
    root: "Shared/Canvas",
    source: "@green-goods/shared/components",
    use: "Shell, sheets, navigation, workbench rows, and shared canvas foundations.",
  },
  {
    root: "Client/Public",
    source: "packages/client/src",
    use: "Browser website shell, route frames, and public navigation states.",
  },
  {
    root: "Client/PWA",
    source: "packages/client/src",
    use: "Installed field-tool shell, status, and protected route states.",
  },
  {
    root: "Admin/Primitives",
    source: "packages/admin/src/components/Admin*.tsx",
    use: "Operator cockpit primitives, kept separate from the browser dialect.",
  },
];

const meta = {
  title: "Shared/Tokens/Design Tool Imports",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Import map for Google Stitch, Claude Design, Storybook MCP, and other tools that need Green Goods styles plus component states.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ImportRow({ label, path, use }: (typeof importFiles)[number]) {
  return (
    <div className="grid gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4 sm:grid-cols-[12rem_1fr]">
      <div>
        <div className="text-label-sm font-medium text-text-strong-950">{label}</div>
        <code className="mt-1 block break-all text-[11px] text-text-soft-400">{path}</code>
      </div>
      <p className="text-paragraph-sm text-text-sub-600">{use}</p>
    </div>
  );
}

function ComponentRootRow({ root, source, use }: (typeof componentRoots)[number]) {
  return (
    <div className="grid gap-3 border-b border-stroke-soft-200 py-3 last:border-b-0 sm:grid-cols-[11rem_16rem_1fr]">
      <div className="text-label-sm font-medium text-text-strong-950">{root}</div>
      <code className="break-all text-[11px] text-text-soft-400">{source}</code>
      <div className="text-paragraph-sm text-text-sub-600">{use}</div>
    </div>
  );
}

export const ImportMap: Story = {
  render: () => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-5">
        <p className="max-w-3xl text-paragraph-md text-text-sub-600">
          Load the root DesignMD file, then the browser dialect, then the Storybook story index.
          That gives design tools the visual rules and the actual component/state names without
          inventing parallel component contracts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title-h5 text-text-strong-950">Import Files</h2>
        <div className="grid gap-3">
          {importFiles.map((file) => (
            <ImportRow key={file.path} {...file} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h2 className="text-title-h5 text-text-strong-950">Component Roots</h2>
        <div className="mt-4">
          {componentRoots.map((root) => (
            <ComponentRootRow key={root.root} {...root} />
          ))}
        </div>
      </section>
    </div>
  ),
};

export const ToolRecipes: Story = {
  render: () => (
    <div className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h2 className="text-title-h5 text-text-strong-950">Google Stitch</h2>
        <p className="mt-3 text-paragraph-sm text-text-sub-600">
          Import <code>DESIGN.md</code>, <code>DESIGN.browser.md</code>, and{" "}
          <code>design-md.generated.json</code>. Treat Storybook as the component catalog, not a
          separate design source.
        </p>
      </article>

      <article className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h2 className="text-title-h5 text-text-strong-950">Claude Design</h2>
        <p className="mt-3 text-paragraph-sm text-text-sub-600">
          Load the design README, the two DesignMD files, and <code>index.json</code>. Use the
          browser dialect unless the work explicitly targets installed PWA or admin.
        </p>
      </article>

      <article className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h2 className="text-title-h5 text-text-strong-950">Storybook MCP</h2>
        <p className="mt-3 text-paragraph-sm text-text-sub-600">
          Run <code>bun --cwd packages/shared run storybook</code> for local MCP access. The static
          deploy still exposes the story index and design files for shareable review.
        </p>
      </article>
    </div>
  ),
};
