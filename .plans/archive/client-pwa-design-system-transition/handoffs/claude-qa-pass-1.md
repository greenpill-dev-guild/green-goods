# QA Pass 1 Handoff

Date: 2026-04-29
Actor: Codex completion pass
Scope: source/browser/story visual review for Stage 0 through Stage 4

## Outcome

QA Pass 1 source and Storybook/browser evidence is complete for the automated/local surfaces that
can be exercised from this checkout. On 2026-04-29, the human owner waived final installed-phone
PWA signoff and media overlay contrast over real bright outdoor thumbnails/video thumbnails as
archive blockers.

## Evidence Reviewed

- Stage 0 readiness: `handoffs/qa-evidence/stage-0-readiness.md`
- Stage 1 color foundation: `handoffs/qa-evidence/stage-1-color-foundation.md`
- Stage 1 public browser smoke: `handoffs/qa-evidence/stage-1-browser-smoke.md`
- Stage 2 drawers: `handoffs/qa-evidence/stage-2-drawers.md`
- Stage 3 loading: `handoffs/qa-evidence/stage-3-loading.md`
- Stage 3 media: `handoffs/qa-evidence/stage-3-media.md`
- Stage 4 controls/cards/forms: `handoffs/qa-evidence/stage-4-controls.md`
- Final installed-phone waiver note: `handoffs/qa-evidence/final-phone-signoff.md`

## Completion Fixes

- `packages/client/src/styles/animation.css`: replaced raw `rgb(var(--primary-base) / ...)`
  animation alphas with existing `--color-primary-alpha-*` runtime aliases and `transparent`.
- `packages/client/src/components/Cards/Work/DraftCard.tsx`: removed invalid nested button markup
  discovered during visual capture; the card body and delete action are now separate buttons.
- `packages/client/src/components/Cards/Work/DraftCard.stories.tsx`: updated the Storybook
  argType description to match the non-button root.
- `packages/client/src/__tests__/views/Intro.test.tsx`: added the missing `localizeAction` mock
  export so the full client test suite reflects the current shared API surface.
- `docs/docs/builders/packages/client-pwa-token-audit.generated.md`: refreshed after the generated
  artifact check reported drift.

## Visual Evidence Captured

- Stage 3 loading:
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-default-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-username-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-error-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-loading-reduced-motion-375x812.png`
- Stage 3 media/progress:
  - `output/playwright/client-pwa-design-system-transition/stage-3/garden-work-capture-375x812.png`
- Stage 4 controls/cards/profile:
  - `output/playwright/client-pwa-design-system-transition/stage-4/action-card-gallery-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-4/draft-card-gallery-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-4/pwa-profile-375x812.png`

The exploratory `splash-gallery-375x812.png` artifact is excluded because it rendered a Storybook
router fixture error.

## Validation

- Passed: `node scripts/harness/plan-hub.mjs validate`
- Passed: `bun run check:design-tokens`
- Passed: `bun run lint:vocab`
- Passed after gated regeneration: `bun run check:design-generated`
- Passed: `bun run --cwd packages/shared check:stories`
- Passed: `bun run --cwd packages/shared check:story-quality`
- Passed: `bun run --filter @green-goods/client test` with approved escalation for the package's
  Node 20 test shim.
- Passed: `bun run --filter @green-goods/client build` with approved root `.env` read and safe
  ephemeral dummy values for `VITE_PINATA_JWT`, `PINATA_JWT`, `TELEGRAM_BOT_TOKEN`,
  `ENCRYPTION_SECRET`, and `AGENT_PUBLIC_ALLOWED_ORIGINS`.

## Proof Limits / Waivers

- Final installed-phone signoff is not captured. It would require a real device or simulator
  installed PWA run across the matrix in `eval.md`; the human owner waived this proof gap on
  2026-04-29.
- Real bright outdoor-thumbnail and video-thumbnail overlay contrast was not proven by the
  available Storybook fixtures. The source uses token overlay plus `static-white`; the human owner
  waived this proof gap on 2026-04-29.
- Shared Storybook logged static asset 404s for client public assets such as `/icon.png` and
  `/placeholder-tree.jpg` because `packages/shared/.storybook/main.ts` only serves the shared
  design-asset folder. The client production build passed, so these are fixture limitations.
- A plain client build without ephemeral Varlock secret values still prompts/fails through
  1Password for `VITE_PINATA_JWT` in this environment; the validation build did not edit `.env`.
