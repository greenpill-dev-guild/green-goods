# AI UI Brief

Reusable prompt contract for asking an AI agent or design tool to build strong Green Goods user interfaces. This is saved guidance, not a one-time prompt. Use it as the durable brief, then fill in the task-specific surface, goal, constraints, and done criteria for each screen or component.

## How To Use This Brief

1. Start with this file when the request is UI, CSS, layout, animation, accessibility, or visual polish.
2. Add the repo sources for the target surface:
   - Root `DESIGN.md`
   - `packages/admin/DESIGN.md` for admin
   - `packages/client/DESIGN.pwa.md` for installed PWA
   - `packages/client/DESIGN.browser.md` for public browser
   - `docs/DESIGN.md` for docs
   - `prompt-contract.md` for admin or `client-prompt-contract.md` for client
3. For implementation or review work, refresh repo Modern Web Guidance with `bun run agentic:guidance` before making browser-facing CSS decisions when tooling access allows.
4. Ask for one screen or component per pass.
5. Treat generated UI as a draft. Map it back to existing Green Goods primitives and prove it in Storybook or a real browser before shipping.

Do not paste long external articles into every prompt. The references below are a role map: they tell the agent which authority to use for which design dimension. Retrieve current browser guidance through the repo tooling when implementing browser-facing CSS, then apply the repo rules.

## Reference Role Map

| Source | Use For | How The Agent Should Apply It |
|--------|---------|-------------------------------|
| [web.dev CSS](https://web.dev/learn/css) and [Baseline](https://web.dev/baseline) | Native CSS, browser support, semantic HTML, responsive layout, performance-safe animation, progressive enhancement | Prefer platform primitives first: semantic elements, CSS Grid/Flexbox, container queries, logical properties, `clamp()`, dynamic viewport units, `@property`, View Transitions when supported, and reduced-motion fallbacks. Target Baseline Widely Available unless a task explicitly accepts a newer feature with fallback. |
| [Refactoring UI](https://www.refactoringui.com/) | Visual craft for developers: hierarchy, spacing, typography, contrast, density, polish | Make the hierarchy obvious before adding decoration. Use spacing, type weight/size, alignment, and contrast to show priority. Avoid equal-weight cards, vague gray text, arbitrary borders, and visual noise. |
| [Material Design 3](https://m3.material.io/) | Component anatomy, states, shape, color roles, adaptive layout, motion discipline | Use M3 as the structural backbone for components and state layers. For admin, M3 anatomy is strict. For client, borrow shape, color, and motion principles through Warm Earth rather than raw M3 styling. |
| [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) | Content-first layout, clarity, safe areas, platform comfort, material/layer restraint, meaningful motion | Keep content primary and controls supportive. Respect safe areas and touch targets. Use motion for continuity and feedback, not spectacle. Use material/layers to clarify hierarchy, not as decoration. |
| Green Goods Warm Earth | Product identity, surface dialect, tokens, primitives, validation | This repo decides the final dialect: canvas/ink/stone/accent roles, concentric geometry, spring tokens, surface-specific chrome, Storybook, i18n, and browser proof. |

## Reusable Prompt

```text
Build a Green Goods UI.

Goal:
[State the user outcome and the screen/component to build.]

Surface:
[admin | client PWA | public browser | docs]

Source context:
- Follow root DESIGN.md and the matching surface DESIGN.md.
- Follow the matching prompt contract when the surface is admin or client.
- Before browser-facing CSS or accessibility implementation, use repo Modern Web Guidance (`bun run agentic:guidance`) to retrieve current browser guidance when available; if blocked, report the blocker and rely on repo-local guidance.
- Use the AI UI Brief reference role map:
  - web.dev/Baseline for native CSS, responsive layout, accessibility, and safe browser features.
  - Refactoring UI for visual hierarchy, spacing, typography, and polish.
  - Material 3 for component anatomy, state layers, shape, color roles, and adaptive behavior.
  - Apple HIG for content-first layout, safe areas, platform comfort, meaningful motion, and material restraint.
  - Green Goods Warm Earth for final tokens, components, copy voice, validation, and proof.

Constraints:
- Use existing Green Goods primitives before inventing components.
- Use semantic tokens only. Do not hardcode colors, radii, durations, or cubic-beziers.
- Use CSS/native platform capabilities before adding JavaScript or dependencies.
- Use container queries for component-internal responsiveness; use viewport breakpoints for page composition.
- Animate transform, opacity, color, blur, or view transitions with `--spring-*` tokens only.
- Respect `prefers-reduced-motion`; motion must not be the only carrier of meaning.
- Include loading, empty, error, disabled, hover, focus-visible, keyboard, dark-mode, and mobile states where relevant.
- Add or update Storybook stories for reusable/shared/admin UI.
- Add user-facing strings to en, es, and pt.

Surface rules:
- Admin: restrained operator cockpit. Command Surface, solid dense content, strict M3 anatomy, Plus Jakarta Sans, one dominant workspace, inspectors over card mosaics, utility copy only.
- Client PWA: gardener field tool. Bottom AppBar, Inter, expressive Warm Earth allowed, offline/sync states visible, warm community copy.
- Public browser: editorial public record. SiteHeader only, real Garden imagery, Fraunces for editorial heroes, no wallet header CTA, no admin dashboard/KPI feel.
- Docs: readable reference surface. Preserve Docusaurus structure, long-form readability, compact callouts, concrete commands and paths.

Done when:
- The UI fits and reads clearly at mobile, tablet, desktop, and the relevant container widths.
- Text does not overflow or overlap controls.
- Keyboard and screen-reader paths are clear.
- The validation path is explicit and uses the lightest repo checks that prove the changed surface.
- Storybook/design checks pass for the touched surface.
- Browser-visible changes are proven with real rendered evidence.
```

## Agent Decision Checklist

- What is the target surface and dialect?
- What is the primary user job?
- Which existing primitive should carry the interaction?
- Which information is glance, scan, engage, and deep dive?
- What should be solid versus material/glass?
- What should move, why should it move, and what is the reduced-motion equivalent?
- What must be true at 320-375px, tablet, desktop, and inside a narrow container?
- Which story, test, or browser proof will show the result is real?

## What Not To Do

- Do not ask for a generic modern UI.
- Do not blend admin cockpit, PWA, public browser, and docs dialects.
- Do not use external references as visual skins. Use them as authority lenses, then express the result through Green Goods tokens and primitives.
- Do not accept generated code that invents component libraries, raw palette values, unlocalized strings, or ornamental animation.
- Do not ship from a static screenshot alone. The browser, Storybook, or route must render correctly.
