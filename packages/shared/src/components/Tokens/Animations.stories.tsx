import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useState } from "react";

/**
 * Living documentation for the Warm Earth motion contract.
 *
 * Root DESIGN.md is the canonical DesignMD source. theme.css is the runtime
 * projection that exposes the spring aliases component authors should consume.
 * New UI should use the six named --spring-* families below instead of raw
 * duration or easing literals.
 */

type SpringFamily = "spatial" | "effects";

type SpringToken = {
  name: string;
  variable: string;
  durationVariable: string;
  easingVariable: string;
  family: SpringFamily;
  use: string;
  description: string;
};

const springTokens: SpringToken[] = [
  {
    name: "Spatial",
    variable: "--spring-spatial",
    durationVariable: "--spring-spatial-duration",
    easingVariable: "--spring-spatial-easing",
    family: "spatial",
    use: "Default layout movement",
    description: "Route content, sheets, cards, and layout pieces moving through space.",
  },
  {
    name: "Spatial Fast",
    variable: "--spring-spatial-fast",
    durationVariable: "--spring-spatial-fast-duration",
    easingVariable: "--spring-spatial-fast-easing",
    family: "spatial",
    use: "Immediate spatial response",
    description:
      "Pressed, tapped, selected, or small hover movement where feedback must feel crisp.",
  },
  {
    name: "Spatial Slow",
    variable: "--spring-spatial-slow",
    durationVariable: "--spring-spatial-slow-duration",
    easingVariable: "--spring-spatial-slow-easing",
    family: "spatial",
    use: "Larger spatial movement",
    description:
      "Panel entrances, sheet changes, and larger transitions that need extra settle time.",
  },
  {
    name: "Effects",
    variable: "--spring-effects",
    durationVariable: "--spring-effects-duration",
    easingVariable: "--spring-effects-easing",
    family: "effects",
    use: "Default visual effects",
    description: "Opacity, background color, border color, shadow, and blur changes.",
  },
  {
    name: "Effects Fast",
    variable: "--spring-effects-fast",
    durationVariable: "--spring-effects-fast-duration",
    easingVariable: "--spring-effects-fast-easing",
    family: "effects",
    use: "Small visual effects",
    description: "Subtle color, icon, badge, and affordance changes.",
  },
  {
    name: "Effects Slow",
    variable: "--spring-effects-slow",
    durationVariable: "--spring-effects-slow-duration",
    easingVariable: "--spring-effects-slow-easing",
    family: "effects",
    use: "Sustained visual effects",
    description: "Ambient shimmer, loading, and longer opacity or material changes.",
  },
];

type LegacyUtility = {
  className: string;
  preferredToken: string;
  note: string;
};

const legacyUtilities: LegacyUtility[] = [
  {
    className: ".animate-fade-in-up",
    preferredToken: "--spring-spatial-slow",
    note: "Legacy entrance helper. New component CSS should use spring tokens directly.",
  },
  {
    className: ".animate-fade-in-scale",
    preferredToken: "--spring-spatial",
    note: "Legacy card entrance helper. Prefer a transition or animation wired to a named spring.",
  },
  {
    className: ".toast-enter",
    preferredToken: "--spring-spatial",
    note: "Legacy toast entrance helper retained for existing surfaces.",
  },
  {
    className: ".toast-exit",
    preferredToken: "--spring-effects-fast",
    note: "Legacy toast exit helper retained for existing surfaces.",
  },
  {
    className: ".modal-slide-enter",
    preferredToken: "--spring-spatial-slow",
    note: "Legacy modal helper retained while modal components move to direct token usage.",
  },
];

function SpringTokenCard({ token }: { token: SpringToken }) {
  const isSpatial = token.family === "spatial";
  const transitionTarget = isSpatial ? "transform" : "opacity, background-color, box-shadow";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-label-sm font-medium text-text-strong-950">{token.name}</div>
          <div className="mt-1 text-paragraph-xs text-text-sub-600">{token.description}</div>
        </div>
        <span className="shrink-0 rounded-full border border-stroke-soft-200 bg-bg-soft-200 px-2 py-1 text-[10px] font-medium uppercase text-text-soft-400">
          {token.family}
        </span>
      </div>

      <div className="grid gap-2 text-[11px] text-text-soft-400 sm:grid-cols-3">
        <code className="rounded bg-bg-weak-50 px-2 py-1">{token.variable}</code>
        <code className="rounded bg-bg-weak-50 px-2 py-1">{token.durationVariable}</code>
        <code className="rounded bg-bg-weak-50 px-2 py-1">{token.easingVariable}</code>
      </div>

      <div className="rounded-md border border-stroke-soft-200 bg-bg-weak-50 p-3">
        <code className="block overflow-x-auto text-[11px] text-text-sub-600">
          {`transition: ${transitionTarget} var(${token.variable});`}
        </code>
      </div>

      <div className="text-paragraph-xs text-text-sub-600">{token.use}</div>
    </div>
  );
}

function MotionPreview({ token }: { token: SpringToken }) {
  const [active, setActive] = useState(false);
  const isSpatial = token.family === "spatial";

  const replay = useCallback(() => {
    setActive(false);
    requestAnimationFrame(() => setActive(true));
  }, []);

  return (
    <div className="flex w-56 flex-col items-center gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4">
      <div className="flex h-28 w-full items-center justify-center rounded-lg bg-bg-weak-50">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-stroke-soft-200 bg-primary text-[10px] font-medium text-primary-foreground shadow-regular-sm"
          style={{
            opacity: isSpatial || active ? 1 : 0.45,
            transform:
              active && isSpatial ? "translateY(-0.5rem) scale(1.04)" : "translateY(0) scale(1)",
            transition: isSpatial
              ? `transform var(${token.variable})`
              : `opacity var(${token.variable}), box-shadow var(${token.variable})`,
          }}
        >
          Go
        </div>
      </div>
      <button
        type="button"
        onClick={replay}
        className="rounded-lg border border-stroke-soft-200 bg-bg-soft-200 px-3 py-1.5 text-label-xs text-text-strong-950 active:scale-95"
      >
        Play {token.name}
      </button>
      <code className="text-center text-[10px] text-text-soft-400">{token.variable}</code>
    </div>
  );
}

function LegacyUtilityList() {
  return (
    <div className="space-y-3">
      {legacyUtilities.map((utility) => (
        <div
          key={utility.className}
          className="grid gap-2 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3 sm:grid-cols-[12rem_12rem_1fr]"
        >
          <code className="text-[11px] text-text-strong-950">{utility.className}</code>
          <code className="text-[11px] text-text-sub-600">{utility.preferredToken}</code>
          <span className="text-paragraph-xs text-text-sub-600">{utility.note}</span>
        </div>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: "Shared/Tokens/Animations",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Warm Earth motion is documented through named spring tokens. Component authors should consume the runtime aliases from theme.css instead of hardcoding durations or easing curves.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="text-paragraph-sm text-text-sub-600">
        Root <code>DESIGN.md</code> is the canonical DesignMD source.{" "}
        <code>packages/shared/src/styles/theme.css</code> projects that source into runtime aliases,
        including the six spring families component CSS should use.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {springTokens.map((token) => (
          <SpringTokenCard key={token.variable} token={token} />
        ))}
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="text-paragraph-sm text-text-sub-600">
        The previews use each token through <code>var(--spring-*)</code>. Spatial tokens move the
        square; effects tokens fade it.
      </p>
      <div className="flex flex-wrap gap-4">
        {springTokens.map((token) => (
          <MotionPreview key={token.variable} token={token} />
        ))}
      </div>
    </div>
  ),
};

export const LegacyUtilities: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-paragraph-sm text-text-sub-600">
        Existing utility classes can stay for compatibility, but they are not the source of truth
        for new motion work. New CSS should use the named spring families directly.
      </p>
      <LegacyUtilityList />
    </div>
  ),
};
