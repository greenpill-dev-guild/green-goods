import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withClientAppRuntime, withInstalledPwa } from "../../../shared/.storybook/decorators";

/**
 * Hero Moments reference scaffold.
 *
 * Documentation fixture for the seven canonical client-PWA hero moments
 * declared in `.claude/skills/design/language.md § Hero Moments`. Each row
 * pins the moment to its canonical surface and the amplification grammar
 * (shape × color × motion × typography × material).
 *
 * Read this story when prompting Stitch / Claude Design / Figma Make for a
 * client celebratory flow — it is the positive vocabulary anchor that the
 * client prompt contract references but never visualizes.
 *
 * Hero moments NEVER appear on admin surfaces. See
 * `.claude/skills/design/prompt-contract.md § Hero Moments Live in the
 * Client, Not the Cockpit`.
 */

type Amplification = {
  shape: string;
  color: string;
  motion: string;
  typography: string;
  material: string;
};

type HeroMoment = {
  name: string;
  surface: string;
  expression: "Full" | "High" | "Medium";
  amplification: Amplification;
};

const HERO_MOMENTS: HeroMoment[] = [
  {
    name: "Garden creation",
    surface: "Garden creation wizard final step",
    expression: "Full",
    amplification: {
      shape: "Organic morph (capsule → growth)",
      color: "Full chroma — bright tertiary accent leads",
      motion: "Expressive spring (bouncy, delightful overshoot)",
      typography: "Display weight — `app-title` scaled up",
      material: "Dramatic — ultrathin glass over vivid background",
    },
  },
  {
    name: "First work submission",
    surface: "`/home/garden` capture-verify-submit",
    expression: "High",
    amplification: {
      shape: "Capsule expand into chain link",
      color: "Tertiary accent ignites the value-flow chain",
      motion: "Expressive spring (confetti-staged sequence)",
      typography: "Display weight on the celebration headline",
      material: "Thick → solid as the work commits",
    },
  },
  {
    name: "Hypercert minting",
    surface: "Hypercert wizard mint completion",
    expression: "Full",
    amplification: {
      shape: "Certificate reveal — squircle morph + organic edge",
      color: "Full chroma + Sky accent for chain confirmation",
      motion: "Expressive spring (reveal + chain settle)",
      typography: "Display + variable weight oscillation",
      material: "Ultrathin glass over the certificate gradient",
    },
  },
  {
    name: "Vault deposit",
    surface: "Vault deposit flow confirmation",
    expression: "High",
    amplification: {
      shape: "Amount morph into position card",
      color: "Tertiary accent flows end-to-end",
      motion: "Expressive spring (flow visualization)",
      typography: "Tabular display weight on amount",
      material: "Regular → thick as funds settle",
    },
  },
  {
    name: "Seasonal transitions",
    surface: "Garden home — season changeover",
    expression: "Medium",
    amplification: {
      shape: "Loading shape morphs to seasonal organic form",
      color: "Ambient color shift — Amber for fall, etc.",
      motion: "Expressive spring (drift)",
      typography: "Body — only the season label amplifies",
      material: "Thin glass with seasonal gradient hint",
    },
  },
  {
    name: "Assessment completion",
    surface: "Evaluator publishes assessment",
    expression: "Medium",
    amplification: {
      shape: "Capsule flows into impact chain",
      color: "Tertiary accent + Sky for evaluation context",
      motion: "Expressive spring (chain settle)",
      typography: "Title — assessment headline amplifies",
      material: "Regular glass over impact summary",
    },
  },
  {
    name: "Role milestone",
    surface: "Capability badge earned (Profile)",
    expression: "Medium",
    amplification: {
      shape: "Organic unfurl on badge reveal",
      color: "Tertiary accent — badge gradient",
      motion: "Expressive spring (unfurl + settle)",
      typography: "Title — capability name amplifies",
      material: "Thick glass behind the badge",
    },
  },
];

function HeroMomentsCatalog() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-text-strong-950">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Client PWA — Hero Moments</h1>
        <p className="mt-2 text-sm text-text-sub-600">
          Seven canonical celebratory flows. Hero moments combine shape × color × motion ×
          typography × material amplification simultaneously. Never used on admin surfaces.
        </p>
        <p className="mt-2 text-xs text-text-sub-600">
          Reference:{" "}
          <code className="rounded bg-bg-soft-200 px-1 py-0.5">
            .claude/skills/design/language.md § Hero Moments
          </code>
          .
        </p>
      </header>
      <ul className="flex flex-col gap-6">
        {HERO_MOMENTS.map((moment) => (
          <li
            key={moment.name}
            data-testid={`hero-moment-${moment.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{moment.name}</h2>
              <span className="text-xs uppercase tracking-wide text-text-sub-600">
                Expression: {moment.expression}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-sub-600">{moment.surface}</p>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="font-medium text-text-strong-950">Shape</dt>
              <dd className="text-text-sub-600">{moment.amplification.shape}</dd>
              <dt className="font-medium text-text-strong-950">Color</dt>
              <dd className="text-text-sub-600">{moment.amplification.color}</dd>
              <dt className="font-medium text-text-strong-950">Motion</dt>
              <dd className="text-text-sub-600">{moment.amplification.motion}</dd>
              <dt className="font-medium text-text-strong-950">Typography</dt>
              <dd className="text-text-sub-600">{moment.amplification.typography}</dd>
              <dt className="font-medium text-text-strong-950">Material</dt>
              <dd className="text-text-sub-600">{moment.amplification.material}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}

const meta = {
  title: "Client/PWA/HeroMoments",
  component: HeroMomentsCatalog,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
  decorators: [withInstalledPwa(), withClientAppRuntime],
} satisfies Meta<typeof HeroMomentsCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Client PWA — Hero Moments" })).toBeVisible();
    for (const moment of HERO_MOMENTS) {
      const id = `hero-moment-${moment.name.toLowerCase().replace(/\s+/g, "-")}`;
      const row = canvas.getByTestId(id);
      await expect(row).toBeVisible();
      await expect(within(row).getByRole("heading", { name: moment.name })).toBeVisible();
    }
  },
};
