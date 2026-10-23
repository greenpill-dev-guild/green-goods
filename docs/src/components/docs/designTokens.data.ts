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

/**
 * Variable product faces for the type samples. Docs loads these stylesheets while the client
 * serves the same faces locally. The type samples need variable weights because
 * the brand kit's files (static/brand/v3/typography) carry the regular weight only, so a sample at
 * 500, 600, or 700 drawn from those files would be a weight the browser made up.
 */
export const PRODUCT_FONT_STYLESHEETS = [
  "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&display=swap",
] as const;

/** Map DesignMD family names onto the product's fonts, with the brand kit's regular files behind them. */
export const FONT_STACKS: Record<string, string> = {
  Inter: 'Inter, "Green Goods Inter", "Segoe UI", sans-serif',
  Fraunces: 'Fraunces, "Green Goods Fraunces", Georgia, serif',
};
