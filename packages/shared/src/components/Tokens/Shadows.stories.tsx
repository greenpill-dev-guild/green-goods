import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Visual documentation of the Green Goods shadow / elevation system.
 *
 * Shadows are defined in `storybook.css` via `@theme` blocks and consumed
 * through both Tailwind `shadow-*` utilities and CSS utility classes
 * (`.shadow-regular-xs`, `.shadow-fancy-buttons-primary`, etc.).
 *
 * Three tiers: regular elevation, button focus rings, and fancy button borders.
 * Component-specific shadows for toggle switches, tooltips, and thumbs.
 */

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type ShadowToken = {
  name: string;
  cssVar: string;
  className: string;
  value: string;
};

const regularShadows: ShadowToken[] = [
  {
    name: "Regular XS",
    cssVar: "--shadow-regular-xs",
    className: "shadow-regular-xs",
    value: "0 1px 2px 0 rgba(10, 13, 20, 0.03)",
  },
  {
    name: "Regular SM",
    cssVar: "--shadow-regular-sm",
    className: "shadow-regular-sm",
    value: "0 2px 4px rgba(27, 28, 29, 0.04)",
  },
  {
    name: "Regular MD",
    cssVar: "--shadow-regular-md",
    className: "shadow-regular-md",
    value: "0 16px 32px -12px rgba(14, 18, 27, 0.1)",
  },
];

const buttonFocusShadows: ShadowToken[] = [
  {
    name: "Primary Focus",
    cssVar: "--shadow-button-primary-focus",
    className: "shadow-button-primary-focus",
    value: "0 0 0 2px bg-white-0, 0 0 0 4px primary-alpha-10",
  },
  {
    name: "Important Focus",
    cssVar: "--shadow-button-important-focus",
    className: "shadow-button-important-focus",
    value: "0 0 0 2px bg-white-0, 0 0 0 4px neutral-alpha-16",
  },
  {
    name: "Error Focus",
    cssVar: "--shadow-button-error-focus",
    className: "shadow-button-error-focus",
    value: "0 0 0 2px bg-white-0, 0 0 0 4px red-alpha-10",
  },
];

const fancyShadows: ShadowToken[] = [
  {
    name: "Fancy Neutral",
    cssVar: "--shadow-fancy-buttons-neutral",
    className: "shadow-fancy-buttons-neutral",
    value: "0 1px 2px 0 rgba(27, 28, 29, 0.48), 0 0 0 1px #242628",
  },
  {
    name: "Fancy Primary",
    cssVar: "--shadow-fancy-buttons-primary",
    className: "shadow-fancy-buttons-primary",
    value: "0 1px 2px 0 rgba(14, 18, 27, 0.24), 0 0 0 1px primary-base",
  },
  {
    name: "Fancy Error",
    cssVar: "--shadow-fancy-buttons-error",
    className: "shadow-fancy-buttons-error",
    value: "0 1px 2px 0 rgba(14, 18, 27, 0.24), 0 0 0 1px error-base",
  },
  {
    name: "Fancy Stroke",
    cssVar: "--shadow-fancy-buttons-stroke",
    className: "shadow-fancy-buttons-stroke",
    value: "0 1px 3px 0 rgba(14, 18, 27, 0.12), 0 0 0 1px stroke-soft-200",
  },
];

const componentShadows: ShadowToken[] = [
  {
    name: "Toggle Switch",
    cssVar: "--shadow-toggle-switch",
    className: "shadow-toggle-switch",
    value: "0 6px 10px 0 rgba(14, 18, 27, 0.06), 0 2px 4px 0 rgba(14, 18, 27, 0.03)",
  },
  {
    name: "Switch Thumb",
    cssVar: "--shadow-switch-thumb",
    className: "shadow-switch-thumb",
    value: "0 4px 8px 0 rgba(27, 28, 29, 0.06), 0 2px 4px 0 rgba(14, 18, 27, 0.08)",
  },
  {
    name: "Tooltip",
    cssVar: "--shadow-tooltip",
    className: "shadow-tooltip",
    value: "0 12px 24px 0 rgba(14, 18, 27, 0.06), 0 1px 2px 0 rgba(14, 18, 27, 0.03)",
  },
];

const allGroups = [
  { label: "Regular Elevation", tokens: regularShadows },
  { label: "Button Focus Rings", tokens: buttonFocusShadows },
  { label: "Fancy Button Shadows", tokens: fancyShadows },
  { label: "Component Shadows", tokens: componentShadows },
];

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

function ShadowCard({ token }: { token: ShadowToken }) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`w-48 h-28 rounded-xl bg-bg-white-0 ${token.className} flex items-center justify-center`}
      >
        <span className="text-label-xs text-text-soft-400">{token.name}</span>
      </div>
      <div className="space-y-0.5 max-w-[12rem]">
        <div className="text-label-xs text-text-strong-950 font-mono">.{token.className}</div>
        <div className="text-[10px] text-text-soft-400 font-mono leading-tight break-all">
          {token.value}
        </div>
      </div>
    </div>
  );
}

function ShadowGroup({ label, tokens }: { label: string; tokens: ShadowToken[] }) {
  return (
    <section className="mb-10">
      <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
        {label}
      </h3>
      <div className="flex flex-wrap gap-8">
        {tokens.map((t) => (
          <ShadowCard key={t.name} token={t} />
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Design Tokens/Shadows & Elevation",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The shadow system provides depth and elevation cues. Three tiers: regular elevation (xs/sm/md), button focus rings (double-ring pattern), and fancy button borders (inset glow + border). Component-specific shadows for toggles, thumbs, and tooltips.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

/** All shadow tokens grouped by category. */
export const Default: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Shadows are defined as <code>@theme</code> tokens in <code>storybook.css</code> and applied
        via utility classes. They use low-opacity, cool-tinted rgba values for a natural depth feel.
      </p>
      {allGroups.map((g) => (
        <ShadowGroup key={g.label} label={g.label} tokens={g.tokens} />
      ))}
    </div>
  ),
};

/** Button focus ring variants isolated for comparison. */
export const ButtonFocusVariants: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Focus shadows use a double-ring pattern: an inner ring matching the page background and an
        outer ring using the button's accent color at low opacity. This creates a clear, accessible
        focus indicator that works on any background.
      </p>
      <div className="flex flex-wrap gap-6">
        {buttonFocusShadows.map((t) => (
          <div key={t.name} className="flex flex-col items-center gap-3">
            <button
              type="button"
              className={`px-6 py-2.5 rounded-lg text-label-sm ${t.className} ${
                t.name.includes("Primary")
                  ? "bg-primary text-primary-foreground"
                  : t.name.includes("Error")
                    ? "bg-error-base text-static-white"
                    : "bg-bg-strong-950 text-text-white-0"
              }`}
            >
              {t.name.replace(" Focus", "")}
            </button>
            <span className="text-[10px] text-text-soft-400 font-mono">.{t.className}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Comprehensive gallery with all shadows side by side. */
export const Gallery: Story = {
  render: () => (
    <div>
      <h2 className="text-title-h5 text-text-strong-950 mb-6">Shadow Reference</h2>

      <section className="mb-10">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Elevation Scale
        </h3>
        <p className="text-paragraph-sm text-text-sub-600 mb-4">
          The three regular shadows form an elevation progression. Use
          <code> xs </code> for subtle depth (cards at rest), <code>sm </code>
          for hover states, and <code>md </code> for popovers and dropdowns.
        </p>
        <div className="flex items-end gap-8">
          {regularShadows.map((t, i) => (
            <div key={t.name} className="flex flex-col items-center gap-2">
              <div
                className={`rounded-xl bg-bg-white-0 ${t.className} flex items-center justify-center`}
                style={{ width: 120 + i * 20, height: 80 + i * 16 }}
              >
                <span className="text-label-xs text-text-soft-400">{t.name.split(" ")[1]}</span>
              </div>
              <span className="text-[10px] text-text-soft-400 font-mono">{t.className}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Fancy Buttons
        </h3>
        <div className="flex flex-wrap gap-4">
          {fancyShadows.map((t) => (
            <div key={t.name} className="flex flex-col items-center gap-2">
              <div
                className={`px-6 py-2.5 rounded-lg text-label-sm ${t.className} ${
                  t.name.includes("Neutral")
                    ? "bg-bg-strong-950 text-text-white-0"
                    : t.name.includes("Primary")
                      ? "bg-primary text-primary-foreground"
                      : t.name.includes("Error")
                        ? "bg-error-base text-static-white"
                        : "bg-bg-white-0 text-text-strong-950"
                }`}
              >
                {t.name.replace("Fancy ", "")}
              </div>
              <span className="text-[10px] text-text-soft-400 font-mono">.{t.className}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Component Shadows
        </h3>
        <div className="flex flex-wrap gap-8">
          {componentShadows.map((t) => (
            <ShadowCard key={t.name} token={t} />
          ))}
        </div>
      </section>
    </div>
  ),
};

/** Shadows rendered with dark theme for contrast verification. */
export const DarkMode: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Shadows in dark mode rely on the same rgba values, but they sit on darker backgrounds. Some
        shadows (like focus rings) reference semantic tokens that adapt automatically. Use the
        toolbar theme toggle to compare.
      </p>
      {allGroups.map((g) => (
        <ShadowGroup key={g.label} label={g.label} tokens={g.tokens} />
      ))}
    </div>
  ),
};
