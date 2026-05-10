# Website UX Flow Optimization Spec

## Visitor Flows

The plan tracks seven public-browser flows:

1. Land and understand.
2. Find a Garden.
3. Fund a Garden.
4. Read impact.
5. Browse Actions.
6. Use a Cookie Jar campaign.
7. Install the app.

## Implementation Shape

### Phase 1 - Decision-Moment Plain Language

Phase 1 is the first implementation slice and is ready to dispatch. It should:

- Rewrite funding method selector risk/disclaimer copy away from technical web3 vocabulary.
- Remove lingering "onchain" defaults in decision moments.
- Flatten the funding selector shape to match the public editorial dialect.
- Add success-receipt wayfinding to `/fund` and `/impact`.
- Fix the mobile subscription form layout and clear submitted form state after success.

### Phase 2 - Loading, Empty, Error Honesty

Phase 2 should follow Phase 1. It should add visible loading and recovery states for public funding and Garden discovery surfaces, including receipt retry and zero-result announcements.

### Phase 3 - Discovery and Mental Model

Phase 3 should follow the first two phases unless the human explicitly prioritizes discovery first. It should surface `/cookies` and `/actions`, add first-mention term explanations, tighten Garden detail section semantics, and make Record Loop step links visibly actionable.

## Human Judgment Points

- Glossary presentation: tooltip/popover versus inline parenthetical explanation.
- Record Loop CTA style: visible arrow on title row versus explicit "Read more" link.
- Whether to ship phases as separate commits or a single larger flow pass.

## Constraints

- Use Remixicon where icons are needed.
- Add any new public strings to `en`, `es`, and `pt`.
- Keep public browser editorial styling local to client public-browser surfaces.
- Do not touch installed PWA shell, admin UI, contracts, indexer, or deployment files.
- Record TDD proof for behavior-changing UI where practical; use a proof limit with browser evidence for visual-flow feel.
