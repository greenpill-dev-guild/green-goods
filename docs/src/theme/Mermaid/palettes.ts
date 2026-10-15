/**
 * Mermaid theme variables, one palette per color mode. The Docusaurus theme config can hold only
 * one set, so the swizzled Mermaid component picks the palette at render time. Both palettes build
 * on mermaid's `base` theme and cover flowcharts, sequence diagrams, and state diagrams, which are
 * the three diagram kinds the docs use.
 */
export type MermaidPalette = Record<string, string | boolean>;

export const SHARED_THEME_VARIABLES = {
  fontFamily: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',
} satisfies MermaidPalette;

export const LIGHT_THEME_VARIABLES = {
  darkMode: false,
  background: '#ffffff',
  // Primary (green): nodes and default elements
  primaryColor: '#dcfce7',
  primaryTextColor: '#14532d',
  primaryBorderColor: '#16a34a',
  lineColor: '#16a34a',
  textColor: '#14532d',
  titleColor: '#14532d',
  // Secondary (blue) and tertiary (violet)
  secondaryColor: '#dbeafe',
  secondaryTextColor: '#1e3a5f',
  secondaryBorderColor: '#1d4ed8',
  tertiaryColor: '#ede9fe',
  tertiaryTextColor: '#4c1d95',
  tertiaryBorderColor: '#7c3aed',
  // Notes (amber), clusters, edge labels
  noteBkgColor: '#fffbeb',
  noteTextColor: '#92400e',
  noteBorderColor: '#f59e0b',
  clusterBkg: '#f0fdf4',
  clusterBorder: '#bbf7d0',
  edgeLabelBackground: '#f5f5f5',
  // Sequence diagrams
  actorBkg: '#dcfce7',
  actorBorder: '#16a34a',
  actorTextColor: '#14532d',
  actorLineColor: '#16a34a',
  signalColor: '#16a34a',
  signalTextColor: '#14532d',
  labelBoxBkgColor: '#dcfce7',
  labelBoxBorderColor: '#16a34a',
  labelTextColor: '#14532d',
  loopTextColor: '#14532d',
  activationBkgColor: '#dbeafe',
  activationBorderColor: '#1d4ed8',
  // State diagrams
  stateBkg: '#dcfce7',
  stateLabelColor: '#14532d',
  transitionColor: '#16a34a',
  transitionLabelColor: '#14532d',
  labelBackgroundColor: '#f5f5f5',
  compositeBackground: '#f0fdf4',
  compositeTitleBackground: '#dcfce7',
  compositeBorder: '#16a34a',
} satisfies MermaidPalette;

export const DARK_THEME_VARIABLES = {
  darkMode: true,
  background: '#171717',
  primaryColor: '#14532d',
  primaryTextColor: '#dcfce7',
  primaryBorderColor: '#4ade80',
  lineColor: '#86efac',
  textColor: '#d1fae5',
  titleColor: '#f5f7fa',
  secondaryColor: '#1e3a5f',
  secondaryTextColor: '#dbeafe',
  secondaryBorderColor: '#60a5fa',
  tertiaryColor: '#2e1065',
  tertiaryTextColor: '#ede9fe',
  tertiaryBorderColor: '#a78bfa',
  noteBkgColor: '#451a03',
  noteTextColor: '#fde68a',
  noteBorderColor: '#f59e0b',
  clusterBkg: '#052e16',
  clusterBorder: '#166534',
  edgeLabelBackground: '#262626',
  actorBkg: '#14532d',
  actorBorder: '#4ade80',
  actorTextColor: '#dcfce7',
  actorLineColor: '#4ade80',
  signalColor: '#86efac',
  signalTextColor: '#d1fae5',
  labelBoxBkgColor: '#14532d',
  labelBoxBorderColor: '#4ade80',
  labelTextColor: '#dcfce7',
  loopTextColor: '#dcfce7',
  activationBkgColor: '#1e3a5f',
  activationBorderColor: '#60a5fa',
  stateBkg: '#14532d',
  stateLabelColor: '#dcfce7',
  transitionColor: '#86efac',
  transitionLabelColor: '#d1fae5',
  labelBackgroundColor: '#262626',
  compositeBackground: '#052e16',
  compositeTitleBackground: '#14532d',
  compositeBorder: '#4ade80',
} satisfies MermaidPalette;

export function themeVariablesFor(colorMode: 'light' | 'dark'): MermaidPalette {
  return {
    ...SHARED_THEME_VARIABLES,
    ...(colorMode === 'dark' ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES),
  };
}
