---
version: alpha
name: Green Goods Docs Dialect
description: Documentation-site overlay for the Warm Earth core DesignMD tokens. Preserves the current Docusaurus identity.
extends: ../DESIGN.md
surface: docs
dialect: documentation
designSystem: warm-earth-docs
typography:
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.65
  body-strong:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.65
  display-title:
    fontFamily: Bricolage Grotesque
    fontSize: 38px
    fontWeight: 800
    lineHeight: 1.12
  section-title:
    fontFamily: Bricolage Grotesque
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.18
  code:
    fontFamily: IBM Plex Mono
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.6
colors:
  primary: "#171717"
  secondary: "#5C5C5C"
  background: "#FFFFFF"
  surface: "#F7F7F7"
  text: "#171717"
  community-accent: "#1A7544"
  builder-accent: "#0F766E"
  code-surface: "#F5F5F5"
darkColors:
  background: "#171717"
  surface: "#232323"
  text: "#F5F7FA"
  text-secondary: "#CACFD8"
  border: "#3D3D3D"
  community-accent: "#2EBB6B"
  builder-accent: "#2DD4BF"
  link: "#45C97E"
  link-hover: "#7ADAA5"
  code-surface: "#292929"
roleAccents:
  gardener: "#1A7544"
  operator: "#335CFF"
  assessment: "#7D52F4"
  funder: "#E6A819"
  builder: "#0F766E"
rounded:
  sm: 8px
  md: 10px
  lg: 12px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  doc-page:
    width: 860px
    typography: "{typography.body-md}"
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
  doc-heading:
    typography: "{typography.display-title}"
    textColor: "{colors.primary}"
  metadata-label:
    typography: "{typography.body-strong}"
    textColor: "{colors.secondary}"
    padding: "{spacing.sm}"
  callout:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    padding: "{spacing.md}"
    rounded: "{rounded.lg}"
  code-block:
    backgroundColor: "{colors.code-surface}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    padding: "{spacing.md}"
    rounded: "{rounded.sm}"
  community-active-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.community-accent}"
    rounded: "{rounded.sm}"
  builders-active-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.builder-accent}"
    rounded: "{rounded.sm}"
---

# Green Goods Docs — Design Brief

> Documentation dialect for Docusaurus pages. Use with the root `DESIGN.md`; lint this overlay and the root file separately. This file preserves the current docs identity instead of restyling docs into the client browser or admin dialects.

## Surface Identity

| Surface | Audience | Metaphor | Paradigm | Navigation |
|---------|----------|----------|----------|------------|
| **Docs** | Community members, gardeners, operators, funders, builders | Field manual and builder reference | Readable reference surface | Docusaurus navbar, sidebar, table of contents |

**Hard rule:** Docs stay docs. Preserve Docusaurus structure, long-form readability, compact reference patterns, and clear sidebars. Do not import admin cockpit chrome, installed-PWA bottom navigation, or public-site marketing hero treatment unless the docs home explicitly needs a concise opening moment.

---

## Current Identity

The docs site keeps its existing Docusaurus identity:

- Body: Manrope
- Display headings: Bricolage Grotesque
- Code and inline reference text: IBM Plex Mono
- Layout: neutral Docusaurus document shell with navbar, sidebar, article content, and table of contents
- Accents: community green for community docs, builder teal for builder docs
- Role accents: gardener green, operator blue, assessment violet, funder gold, builder teal

The docs dialect is quieter than the public browser site. It supports learning and reference, not campaign storytelling.

## Writing And Layout Rules

**Readable long-form content**
- Keep article width comfortable and preserve the current `860px` content max width.
- Favor short sections, concrete steps, and source-backed claims.
- Tables and diagrams should scroll horizontally rather than forcing the page wider.

**Compact callouts**
- Use callouts for prerequisites, warnings, and next actions.
- Keep callouts compact; they should interrupt just enough to guide, not become page furniture.
- Role-specific guide openers may use role accents, but the article canvas remains neutral.

**Code and reference clarity**
- Code blocks use IBM Plex Mono and neutral code surfaces.
- Reference pages should prioritize exact names, paths, commands, and current package boundaries.
- Builder docs may use teal accents for active navigation and technical wayfinding.

**Community and builder accents**
- Community pages default to community green.
- Builder pages use builder teal for active sidebar and technical accents.
- Role accents are local signals only; do not recolor whole pages by role.

## Do's And Don'ts

**Do:**
- Preserve the Docusaurus navbar, sidebar, article, and table-of-contents rhythm.
- Keep docs visual changes grounded in `docs/src/css/custom.css` and docs components.
- Use real screenshots, command names, package paths, and role names when they help comprehension.
- Keep docs copy calm, instructional, and source-aware.

**Don't:**
- Use admin-only language such as operator cockpit, workbench row, KPI tile, or utility copy as the docs design frame.
- Use installed-PWA chrome such as bottom `AppBar`, standalone-app safe areas, or PWA-only navigation.
- Use public browser lookbook treatment, oversized marketing heroes, or editorial image-first pages unless the docs home explicitly calls for it.
- Blend PWA and browser shell rules into docs examples; name the surface being documented.
