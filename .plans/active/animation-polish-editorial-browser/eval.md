# Evaluation

## Acceptance Checks

- **Dialog open boundary**: from `/` and `/gardens`, clicking a featured garden card
  produces a coherent card-to-dialog transition with no flash of unanimated body content.
- **Dialog close boundary**: close button, backdrop click, and Escape return to a stable
  browser surface without a one-frame content disappearance.
- **Direct route boundary**: direct navigation to `/gardens/:id` shows the skeleton before
  detail data lands and does not rely on an originating card.
- **Section reveal boundary**: newly animated public sections reveal once, cascade inner
  content, and do not animate when reduced motion is enabled.
- **Microinteraction boundary**: link arrows, editorial buttons, cards, search focus, and
  image fade-in share restrained timing using existing motion tokens.

## Browser QA

- Desktop browser pass on `/`, `/gardens`, and `/gardens/:id`.
- Mobile-width browser pass on `/`, `/gardens`, and `/gardens/:id`.
- Reduced-motion check.
- Keyboard/focus sweep for the dialog.

## Validation Commands

- `bun run lint:vocab`
- `bun run format:check`
- `bun lint`
- Targeted tests for any hook or component behavior touched.

## TDD / Proof Notes

This is primarily UI behavior work. When promoted, the UI lane should begin with a
focused RED proof for the behavior being changed where the behavior can be observed in
tests. For browser-only animation quality, use `proof_limit` with screenshot/video notes
and explicit browser evidence rather than inventing deterministic unit proof.
