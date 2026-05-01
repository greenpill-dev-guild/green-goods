import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { EditorialGhostButton, EditorialPrimaryLink } from "./atoms";
import { PublicEditorialHero } from "./PublicEditorialHero";

/**
 * Stories cover the four canonical hero shapes:
 *  - Home: with kicker + dual actions
 *  - Gardens: kickerless, narrative headline + dual actions
 *  - Impact: read-only (no actions, photo credit + lede)
 *  - Fund: lede + visible disclaimer
 *  - Actions: minimal (no kicker, no photo credit, no actions)
 *
 * Each story renders the hero plus a placeholder section below so the
 * editorial overlap is visible — visit the story to confirm the card's
 * lower edge lands cleanly on the next section's linen surface.
 */

const HERO_IMG =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2200&q=80";
const HERO_FALLBACK = "/images/no-image-placeholder.png";

const NextSection = ({ children }: { children: React.ReactNode }) => (
  <section className="bg-bg-weak-50 px-6 pt-32 pb-24 sm:px-10 md:pt-48">
    <div className="mx-auto max-w-7xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
        § Next section preview
      </p>
      <h2 className="mt-3 font-serif text-3xl text-text-strong-950">{children}</h2>
      <p className="mt-3 max-w-prose text-sm text-text-sub-600">
        The hero card protrudes from the image plate above into this linen surface. The card&apos;s
        bottom edge lands here, around the area where this lede sits.
      </p>
    </div>
  </section>
);

const meta: Meta<typeof PublicEditorialHero> = {
  title: "Client/Public/PublicEditorialHero",
  component: PublicEditorialHero,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Canonical editorial hero — image plate + overlapping linen card. " +
          "Pair with a section that has `pt-32 md:pt-48` so the protruding " +
          "card lands cleanly. See `PublicEditorialHeroProps` for the slot API.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicEditorialHero>;

export const Home: Story = {
  render: () => (
    <>
      <PublicEditorialHero
        imageSrc={HERO_IMG}
        imageFallbackSrc={HERO_FALLBACK}
        imageAlt=""
        titleId="story-home-title"
        title={
          <>
            From good intentions to <em className="font-serif italic">green outcomes</em>.
          </>
        }
        lede="Communities document, verify, and fund regenerative work — Garden by Garden. A quiet, public record of what restores soil, water, and the people who tend them."
        photoCredit="Riverbend Commons — Hudson Valley, NY"
        actions={
          <>
            <EditorialPrimaryLink to="/gardens">Explore Gardens</EditorialPrimaryLink>
            <EditorialGhostButton>Install App</EditorialGhostButton>
          </>
        }
      />
      <NextSection>Tended places, openly recorded.</NextSection>
    </>
  ),
};

export const Gardens: Story = {
  render: () => (
    <>
      <PublicEditorialHero
        imageSrc={HERO_IMG}
        imageFallbackSrc={HERO_FALLBACK}
        imageAlt=""
        titleId="story-gardens-title"
        title="Explore the Gardens growing the public record."
        lede="Each Garden is a real place where communities document regenerative Work, gather evidence, and make support visible."
        actions={
          <>
            <EditorialPrimaryLink to="/gardens#archive">Start exploring</EditorialPrimaryLink>
            <EditorialGhostButton>View impact record</EditorialGhostButton>
          </>
        }
      />
      <NextSection>Browse the living archive.</NextSection>
    </>
  ),
};

export const Impact: Story = {
  render: () => (
    <>
      <PublicEditorialHero
        imageSrc={HERO_IMG}
        imageFallbackSrc={HERO_FALLBACK}
        imageAlt=""
        titleId="story-impact-title"
        title="See how Garden work becomes evidence."
        lede="Green Goods turns documented regenerative work into public evidence through Assessments and, when ready, Impact Certificates."
        photoCredit="Vol. 01 — A living public record"
      />
      <NextSection>The evidence pipeline.</NextSection>
    </>
  ),
};

export const Fund: Story = {
  render: () => (
    <>
      <PublicEditorialHero
        imageSrc={HERO_IMG}
        imageFallbackSrc={HERO_FALLBACK}
        imageAlt=""
        titleId="story-fund-title"
        title="A small gesture today, growing over many seasons."
        lede="Direct support reaches a Garden's Cookie Jar. Quiet endowment places support into a Vault designed so yield helps the Garden over time."
        disclaimer="Funding supports the Garden directly. It is not tax-deductible, charitable, or nonprofit-backed unless separately configured."
      />
      <NextSection>Donate or Endow — both are first-class.</NextSection>
    </>
  ),
};

export const Actions: Story = {
  render: () => (
    <>
      <PublicEditorialHero
        imageSrc={HERO_IMG}
        imageFallbackSrc={HERO_FALLBACK}
        imageAlt=""
        titleId="story-actions-title"
        title="A field guide for regenerative work."
        lede="Actions are the templates Gardens use to document work across solar, agroforestry, education, and waste."
      />
      <NextSection>The four domains.</NextSection>
    </>
  ),
};

export const FallbackImage: Story = {
  render: () => (
    <>
      <PublicEditorialHero
        imageSrc="/images/this-path-is-broken-on-purpose.png"
        imageFallbackSrc={HERO_FALLBACK}
        imageAlt=""
        titleId="story-fallback-title"
        title="Image fallback path."
        lede="If the curated hero image fails to load, the fallback path renders the placeholder asset instead of breaking the layout."
      />
      <NextSection>Fallback rendered above.</NextSection>
    </>
  ),
};
