/**
 * How the design page groups the core DesignMD tokens. The groups and pairings are a reading
 * order, not new design facts: every key must exist in docs/src/data/design-tokens.json, and the
 * pairings mirror the root DESIGN.md components so each sample shows a real contract.
 */
export const COLOR_GROUPS = [
  {label: "Ink", keys: ["primary", "primary-inverse", "secondary", "secondary-inverse"]},
  {label: "Canvas", keys: ["neutral", "neutral-dark"]},
  {
    label: "Green",
    keys: ["tertiary", "tertiary-action", "tertiary-action-hover", "tertiary-dark", "tertiary-dark-hover"],
  },
  {label: "On green", keys: ["on-tertiary", "on-tertiary-action", "on-tertiary-dark"]},
  {label: "Signals", keys: ["amber", "sky"]},
] as const;

export const PAIRINGS = [
  {label: "Canvas text", fg: "primary", bg: "neutral"},
  {label: "Dark canvas text", fg: "primary-inverse", bg: "neutral-dark"},
  {label: "Primary button", fg: "on-tertiary-action", bg: "tertiary-action"},
  {label: "Primary button, PWA dark", fg: "on-tertiary-dark", bg: "tertiary-dark"},
  {label: "Warning badge", fg: "neutral-dark", bg: "amber"},
  {label: "Info badge", fg: "neutral-dark", bg: "sky"},
] as const;

/** Brand fonts ship with the docs (static/brand/v3/typography); map DesignMD family names onto them. */
export const FONT_STACKS: Record<string, string> = {
  Inter: '"Green Goods Inter", Inter, "Segoe UI", sans-serif',
  Fraunces: '"Green Goods Fraunces", Fraunces, Georgia, serif',
};
