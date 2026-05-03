import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties, ReactNode } from "react";

const meta: Meta = {
  title: "Admin/Tokens/Admin Revamp (Tier 1a)",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Reference page for the Warm-Earth admin token aliases introduced in Tier 1a of the admin design handoff. " +
          "Source-of-truth values: design_handoff_admin-revamp/screens/tokens.css. " +
          "Decision log: docs/admin-revamp/audit.md §5.1. " +
          "These tokens are additive — no existing runtime values changed.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type SwatchSpec = { name: string; cssVar: string; note?: string };

function Swatch({ spec }: { spec: SwatchSpec }) {
  const tile: CSSProperties = {
    width: "5.5rem",
    height: "3.5rem",
    borderRadius: "var(--r-md)",
    background: `var(${spec.cssVar})`,
    boxShadow: "var(--e1)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "5.5rem" }}>
      <div style={tile} aria-label={spec.name} />
      <div style={{ font: "500 11px/1.3 var(--font-sans)", color: "var(--ink)" }}>
        <code style={{ font: "500 11px/1.3 var(--font-mono, ui-monospace, monospace)" }}>
          {spec.cssVar}
        </code>
      </div>
      {spec.note ? (
        <div style={{ font: "400 10px/1.3 var(--font-sans)", color: "var(--stone)" }}>
          {spec.note}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h3
        style={{
          font: "600 14px/1.4 var(--font-sans)",
          color: "var(--ink)",
          marginBottom: "0.75rem",
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>{children}</div>
    </section>
  );
}

const SURFACE_TOKENS: SwatchSpec[] = [
  { name: "canvas", cssVar: "--canvas", note: "#FAF8F5 in light, neutral-950 in dark" },
  { name: "ink", cssVar: "--ink", note: "primary text" },
  { name: "stone", cssVar: "--stone", note: "secondary text / muted labels" },
  { name: "surface-raised", cssVar: "--surface-raised", note: "elevated cards" },
  { name: "surface-sunken", cssVar: "--surface-sunken", note: "depressed areas" },
  { name: "surface-quiet", cssVar: "--surface-quiet", note: "hover background" },
  { name: "outline", cssVar: "--outline" },
  { name: "outline-strong", cssVar: "--outline-strong" },
  { name: "hairline", cssVar: "--hairline" },
];

const GREEN_ROLE_TOKENS: SwatchSpec[] = [
  { name: "g-action", cssVar: "--g-action", note: "filled action / FAB" },
  { name: "g-action-hover", cssVar: "--g-action-hover" },
  { name: "g-action-ring", cssVar: "--g-action-ring", note: "focus halo" },
  { name: "g-soft-bg", cssVar: "--g-soft-bg", note: "pill / active nav fill" },
  { name: "g-soft-fg", cssVar: "--g-soft-fg", note: "text on g-soft-bg" },
  { name: "g-on-action", cssVar: "--g-on-action", note: "text on g-action" },
];

export const SurfaceAliases: Story = {
  render: () => (
    <Section title="Surface aliases">
      {SURFACE_TOKENS.map((spec) => (
        <Swatch key={spec.cssVar} spec={spec} />
      ))}
    </Section>
  ),
};

export const HubGreenRoleChain: Story = {
  render: () => (
    <Section title="Hub green role chain (1–3% accent budget)">
      {GREEN_ROLE_TOKENS.map((spec) => (
        <Swatch key={spec.cssVar} spec={spec} />
      ))}
    </Section>
  ),
};

export const RadiusScale: Story = {
  render: () => (
    <Section title="Radius aliases (--r-*)">
      {(["xs", "sm", "md", "lg", "xl", "full"] as const).map((size) => (
        <div key={size} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div
            aria-label={`r-${size}`}
            style={{
              width: "5.5rem",
              height: "3.5rem",
              background: "var(--surface-raised)",
              borderRadius: `var(--r-${size})`,
              boxShadow: "var(--e2)",
            }}
          />
          <code
            style={{
              font: "500 11px/1.3 var(--font-mono, ui-monospace, monospace)",
              color: "var(--ink)",
            }}
          >
            --r-{size}
          </code>
        </div>
      ))}
    </Section>
  ),
};

export const WarmShadowElevation: Story = {
  render: () => (
    <Section title="Warm-shadow elevation (--e1, --e2, --e3, --e-float)">
      {(["e1", "e2", "e3", "e-float"] as const).map((step) => (
        <div
          key={step}
          style={{ display: "flex", flexDirection: "column", gap: "0.375rem", padding: "1rem" }}
        >
          <div
            aria-label={step}
            style={{
              width: "7rem",
              height: "4rem",
              background: "var(--surface-raised)",
              borderRadius: "var(--r-lg)",
              boxShadow: `var(--${step})`,
            }}
          />
          <code
            style={{
              font: "500 11px/1.3 var(--font-mono, ui-monospace, monospace)",
              color: "var(--ink)",
            }}
          >
            --{step}
          </code>
        </div>
      ))}
    </Section>
  ),
};

function ToneCanvas({ tone, strength, label }: { tone: string; strength: string; label: string }) {
  return (
    <div
      data-tone={tone}
      data-tone-strength={strength}
      style={{
        width: "11rem",
        height: "7rem",
        background: "var(--tone-canvas, var(--canvas))",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--e1), 0 0 0 1px var(--hairline)",
        padding: "0.875rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ font: "600 13px/1.2 var(--font-sans)", color: "var(--ink)" }}>{tone}</div>
      <div style={{ font: "500 10px/1.3 var(--font-sans)", color: "var(--stone)" }}>
        <code>{label}</code>
      </div>
    </div>
  );
}

export const ToneStrengthMatrix: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {(["off", "subtle", "default"] as const).map((strength) => (
        <Section key={strength} title={`Tone × strength = ${strength}`}>
          {(["hub", "garden", "community", "actions"] as const).map((tone) => (
            <ToneCanvas
              key={`${tone}-${strength}`}
              tone={tone}
              strength={strength}
              label={`[data-tone="${tone}"][data-tone-strength="${strength}"]`}
            />
          ))}
        </Section>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Each tone (hub/garden/community/actions) at three strengths. " +
          "off → no wash (canvas only). subtle → 50% saturation (default in dark mode). default → full spec. " +
          "Tone touches the canvas only — never headers, cards, buttons, or status colors.",
      },
    },
  },
};
