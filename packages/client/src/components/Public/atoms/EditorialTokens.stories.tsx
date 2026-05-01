import type { Meta, StoryObj } from "@storybook/react";

/**
 * Token-grid stories for the browser editorial dialect.
 *
 * These swatches verify the L0 tokens defined in
 * `packages/client/src/styles/editorial.css` resolve through Tailwind v4's
 * `@theme` block. Use them as a visual contract: if a hue drifts, this page
 * shows it before any view does.
 */

interface SwatchProps {
  name: string;
  className: string;
  description: string;
  inkClassName?: string;
}

const Swatch = ({ name, className, description, inkClassName }: SwatchProps) => (
  <figure className="flex flex-col gap-2">
    <div
      className={`flex h-24 items-end rounded-2xl border border-stroke-soft-200 p-3 ${className}`}
    >
      <span
        className={`font-mono text-[10px] uppercase tracking-wide ${inkClassName ?? "text-text-strong-950"}`}
      >
        {name}
      </span>
    </div>
    <figcaption className="text-xs text-text-sub-600">{description}</figcaption>
  </figure>
);

const meta: Meta = {
  title: "Client/Public/Editorial Tokens",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Browser-only editorial tokens. Domain palette + warm/walnut surfaces. " +
          "Defined at `packages/client/src/styles/editorial.css`; admin and PWA never import these.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const DomainPalette: Story = {
  render: () => (
    <section className="bg-bg-weak-50 p-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
          § Domain palette
        </p>
        <h2 className="mt-1 font-serif text-2xl text-text-strong-950">
          One ink + one soft surface per domain.
        </h2>
        <p className="mt-2 max-w-prose text-sm text-text-sub-600">
          Filter chips and editorial plates use these to give each domain its own quiet identity,
          freeing the green accent for primary action only.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Swatch
          name="domain-solar"
          className="bg-domain-solar"
          inkClassName="text-static-white"
          description="Warm umber — Solar ink."
        />
        <Swatch
          name="domain-solar-soft"
          className="bg-domain-solar-soft"
          description="Pale amber — Solar plate / chip surface."
        />
        <Swatch
          name="domain-agro"
          className="bg-domain-agro"
          inkClassName="text-static-white"
          description="Deep moss — Agroforestry ink."
        />
        <Swatch
          name="domain-agro-soft"
          className="bg-domain-agro-soft"
          description="Pale sage — Agroforestry plate / chip surface."
        />
        <Swatch
          name="domain-education"
          className="bg-domain-education"
          inkClassName="text-static-white"
          description="Slate violet — Education ink."
        />
        <Swatch
          name="domain-education-soft"
          className="bg-domain-education-soft"
          description="Pale violet — Education plate / chip surface."
        />
        <Swatch
          name="domain-waste"
          className="bg-domain-waste"
          inkClassName="text-static-white"
          description="Harbour blue — Waste ink."
        />
        <Swatch
          name="domain-waste-soft"
          className="bg-domain-waste-soft"
          description="Pale harbour — Waste plate / chip surface."
        />
      </div>
    </section>
  ),
};

export const EditorialSurfaces: Story = {
  render: () => (
    <section className="bg-bg-weak-50 p-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
          § Editorial surfaces
        </p>
        <h2 className="mt-1 font-serif text-2xl text-text-strong-950">Warm linen and walnut.</h2>
        <p className="mt-2 max-w-prose text-sm text-text-sub-600">
          Two extra warm surfaces beyond the canvas neutral. Used for the proof band and the dark
          Get In Touch section on Home and Impact.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Swatch
          name="editorial-warm"
          className="bg-editorial-warm"
          description="Warmer linen — Living Public Record / proof band."
        />
        <Swatch
          name="editorial-deep"
          className="bg-editorial-deep"
          inkClassName="text-editorial-deep-fg"
          description="Walnut — Get In Touch dark section."
        />
        <Swatch
          name="editorial-deep-fg"
          className="bg-editorial-deep-fg"
          description="On-walnut foreground tint."
        />
      </div>
    </section>
  ),
};

export const HeroAnimations: Story = {
  render: () => (
    <section className="bg-bg-weak-50 p-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
          § Hero overlap reveal
        </p>
        <h2 className="mt-1 font-serif text-2xl text-text-strong-950">
          The four-stage editorial settle.
        </h2>
        <p className="mt-2 max-w-prose text-sm text-text-sub-600">
          Panel rises (<code>editorial-hero-in</code>), then headline / lede / CTAs stagger in (
          <code>editorial-fade-up-1/2/3</code>). All gated behind{" "}
          <code>prefers-reduced-motion</code>.
        </p>
      </header>
      <div
        key={Math.random()}
        className="editorial-hero-in mx-auto max-w-xl rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-6 shadow-md"
      >
        <p className="editorial-fade-up-1 font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
          § Demo
        </p>
        <h3 className="editorial-fade-up-2 mt-2 font-serif text-3xl text-text-strong-950">
          A quiet cinematic settle.
        </h3>
        <p className="editorial-fade-up-3 mt-4 text-sm text-text-sub-600">
          The panel rises first, then the kicker, headline, and lede stagger in over the next
          several hundred milliseconds.
        </p>
      </div>
    </section>
  ),
};
