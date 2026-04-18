# Client Z-Index Sweep Spec

## Summary

Migrate all remaining raw `z-[N]` values in `packages/client` and `packages/shared` to the named z-index scale defined in `packages/shared/src/styles/theme.css:419–425` (`--z-base/raised/sticky/nav/overlay/modal/toast` with Tailwind aliases at lines 1186–1192). Verify stacking correctness for the three overlap scenarios that actually occur in the PWA: modal-over-drawer, drawer-over-nav, toast-over-everything.

## Users

- Primary: admin + client frontend engineers maintaining the cockpit / PWA
- Secondary: anyone adding a new overlay, dropdown, or sticky element

## Functional Requirements

1. **F1** — Every `z-\[\d+\]` literal in `packages/client/src/**/*.tsx` replaced with a named-scale class (`z-base`/`z-raised`/`z-sticky`/`z-nav`/`z-overlay`/`z-modal`/`z-toast`) or an explicitly-annotated escape hatch with `// z-escape: reason`.
2. **F2** — Every `z-\[\d+\]` literal in `packages/shared/src/components/**/*.tsx` replaced with the same rules, **with a stacking regression check against client consumers** (this is why the earlier sweep reverted — shared migrations dropped shared primitives below client's raw values).
3. **F3** — Short Tailwind integers (`z-10`/`z-20`/`z-30`/`z-40`/`z-50`) audited: keep `z-10`/`z-20` for **local stacking contexts only** (card badges, overlay-within-parent). Anything that sets a global layer must use the named scale.
4. **F4** — Regression test: a Playwright (or manual scripted) check that stacks `<Toast>` > `<Modal>` > `<Drawer>` > `<TopNav>` and asserts the visible element at center is the toast.
5. **F5** — Update the `design-system-enforcement/plan.todo.md` Requirements Coverage row for "Z-index applied to all components" from 🟡 to ✅ once this sweep lands.

## Non-Functional Constraints

- **Package boundaries**: edits live in `packages/client` and `packages/shared`; no admin changes (admin already migrated).
- **Accessibility**: no effect on focus order, keyboard nav, or screen-reader semantics. Skip-links must stay at `z-toast` (established pattern).
- **Performance**: no effect; token class substitution is purely semantic.
- **Security / offline**: no auth, contract, or indexer changes.
- **Localization**: no user-facing strings.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Client component sweep | `ui` | Primary execution lane |
| Shared primitive re-migration | `ui` | Same lane — order matters (client first, shared second — avoids temporary mis-stacking mid-PR) |
| State / API | `state_api` | `n/a` |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1` | Manual + optional Playwright stacking check |

## Risks

- **R1 — Mid-migration stacking glitch**: if shared primitives migrate before client consumers, a shared modal could momentarily render below client's raw-value modals. Mitigation: land the entire sweep as a single atomic commit, or sequence client-first in the same PR.
- **R2 — Radix Popper / wallet modals**: third-party overlays may still inject raw z-index values. Document as known escapes; do not attempt to wrap or override.
- **R3 — Toast library precedence**: verify the toast provider's own z-index (it already sets one internally). If it conflicts with `z-toast` (60), document which wins and why.

## Dependencies

- Depends on the named z-index scale landing (already done — `design-system-enforcement` Step 1).
- Blocks closing the `design-system-enforcement` plan (last 🟡 row).
