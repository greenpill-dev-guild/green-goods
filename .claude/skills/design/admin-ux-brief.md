# Admin UX Brief — canonical (Afo, 2026-08-16)

The standing brief for all admin-console UI work: the shipped console in `packages/admin`,
admin-surface prototypes (the commitment-pooling hifi set and successors), and any AI-generated
admin design. Written by Afo during the 2026-08-16 admin prototype review; supersedes nothing —
it fills the interaction-design layer the skill previously left implicit. The repo-specific
codification of these principles (with shipped-code citations) is
[interaction-patterns.md](./interaction-patterns.md); this file is the source brief and the
authoritative external-reference list.

Improve the existing product — not just its visual styling — so it becomes simpler, more
consistent, accessible, responsive, and efficient for frequent administrative work. Continue from
the repository's current state. Preserve existing functionality, routes, permissions, data
contracts, and approved work unless a change is necessary to improve usability or fix an
inconsistency.

## Authoritative design references

Do not copy the visual branding of these systems. Extract their usability principles and adapt
them to our product, brand, users, and technical stack.

1. **Nielsen Norman Group's usability heuristics** — https://www.nngroup.com/articles/ten-usability-heuristics/
   Apply: clear system status and timely feedback · familiar language instead of implementation
   terminology · user control, cancellation, undo, and safe exits · consistent controls and
   established conventions · error prevention before error messaging · recognition rather than
   reliance on memory · efficient workflows for both new and experienced users · minimal, relevant
   presentation · specific, actionable error recovery · contextual help where users may need it.
2. **GOV.UK Design System** — https://design-system.service.gov.uk/
   Study its task-focused patterns for: forms and field grouping · validation and error summaries ·
   transactional workflows · confirmation states · clear content hierarchy · progressive
   disclosure · plain-language instructions · accessible, predictable controls.
3. **U.S. Web Design System** — https://designsystem.digital.gov/
   Reference for: accessible and mobile-friendly components · consistent navigation and page
   structure · forms, filters, tables, alerts, and status messages · inclusive interaction
   patterns · semantic HTML and progressive enhancement.
4. **Laws of UX** — https://lawsofux.com/
   Apply: Hick's Law (reduce and organize choices) · Fitts's Law (make important targets easy to
   reach and select) · Jakob's Law (follow familiar interface conventions) · Tesler's Law (manage
   unavoidable complexity instead of passing it to users) · Cognitive Load (reveal information at
   the moment it becomes useful) · Proximity and common-region (visually group related information).
5. **web.dev Responsive Design** — https://web.dev/learn/design
   Modern responsive-layout practice. The console must remain usable at every supported viewport
   without unintended page overflow, clipped actions, unreadable content, or broken navigation.
6. **Refactoring UI** — https://refactoringui.com/
   Practical guidance for: visual hierarchy · spacing and alignment · typography · color and
   contrast · component polish · reducing unnecessary borders · using emphasis intentionally ·
   creating rhythm and consistency.

## Process: audit before substantial change

1. Inspect the existing application shell, navigation, routes, screens, components, styles, and
   design tokens.
2. Identify the most important administrative tasks and the screens supporting them.
3. Find inconsistent patterns, duplicated components, unclear hierarchy, unnecessary complexity,
   accessibility problems, and responsive failures.
4. Reuse sound existing components and conventions instead of rebuilding everything.
5. Provide a concise implementation plan ordered by user impact.

Do not stop after the audit. Proceed with implementation unless a genuinely product-level
decision requires clarification.

## Design direction

The console should feel: clear, calm, professional, and dependable · simple without hiding
essential administrative information · efficient for repeat users · approachable for less
experienced users · cohesive across all screens · purposeful rather than decorative · data-dense
where the work requires it, but never visually chaotic.

Avoid generic AI-generated dashboard styling: excessive cards around every section · large
decorative gradients · oversized headings that reduce usable workspace · arbitrary shadows,
radii, colors, or spacing · too many pills, badges, icons, and containers · low-information hero
areas · animations that delay administrative work · destructive actions placed beside routine
actions without separation · replacing clear labels with ambiguous icons.

## System and component requirements

Use semantic tokens for color roles, typography, spacing, radii, borders, elevation, layout
widths, responsive breakpoints, and focus/interaction states. Do not scatter unexplained raw
colors, font sizes, spacing values, or one-off component styles.

Standardize recurring components: application shell and navigation · page headers and
breadcrumbs · buttons and action groups · forms and validation messages · search, filters, and
sorting · tables, pagination, and bulk actions · tabs and secondary navigation · dialogs,
drawers, and menus · alerts, notices, and confirmations · empty, loading, success, and error
states · status indicators and badges · destructive-action confirmation · permission-restricted
states. **Use one consistent component for the same concept throughout the console.**

## Admin-console UX requirements

- Make the page's purpose and primary action immediately clear.
- Keep common actions visible; place secondary actions in predictable locations.
- Organize complex settings into understandable groups; progressive disclosure for advanced or
  infrequent options.
- Preserve useful information density in tables and operational screens.
- Keep filters discoverable, show which are active, and make them easy to clear.
- Make row selection and bulk actions unambiguous.
- Clearly distinguish navigation, actions, and status information.
- Separate destructive actions from safe actions; explain destructive consequences before
  confirmation; use specific labels ("Delete workspace"), never vague ones ("Confirm").
- Provide success feedback after important operations; preserve user input when recoverable
  errors occur.
- Never use color as the only status indicator.

**Every applicable screen or component must account for**: default · hover · keyboard focus ·
active/selected · disabled · loading · empty · error · success · long content ·
permission-restricted content · small and large supported viewports.

## Accessibility

Semantic HTML and accessible primitives. Full keyboard operation · visible focus indicators ·
logical focus order · proper labels and accessible names · appropriate headings and landmarks ·
sufficient color contrast · useful validation messages · correct dialog focus management ·
accessible table headers and controls · reduced-motion preferences respected · reasonably sized
touch and pointer targets. Do not add ARIA when native HTML already supplies the semantics.

## Responsive behavior

Prioritize the viewports the product actually supports, degrading gracefully narrower: navigation
may collapse without hiding destinations · actions may wrap or move into an overflow menu without
disappearing · forms use readable widths · tables may scroll horizontally intentionally when data
cannot be responsibly collapsed · never hide critical data solely to fake mobile-friendliness ·
no accidental horizontal page overflow on any modified screen.

## Verification

After implementation: run the application and visually inspect every materially changed screen ·
test supported viewports · test keyboard navigation and focus · exercise loading, empty,
validation, error, success, and destructive-action states · run formatter, linter, type checker,
tests, and production build · fix regressions rather than reporting them · confirm existing
functionality and data behavior intact.

## Final report contract

A concise summary of improvements · the principal usability problems resolved · design-system or
component decisions introduced · screens and files materially changed · verification commands and
results · remaining limitations or product decisions requiring human input.

Prioritize coherent workflows and reusable patterns over isolated visual polish. A successful
result makes the console easier to understand and operate while making future screens easier for
both humans and coding agents to build consistently.
