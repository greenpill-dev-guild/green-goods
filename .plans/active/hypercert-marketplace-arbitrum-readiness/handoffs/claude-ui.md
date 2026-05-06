# UI Lane Handoff

**Branch**: `claude/ui/hypercert-marketplace-arbitrum-readiness`
**Status**: blocked until `contracts` and `state_api` complete

## Scope

- Admin Hypercert marketplace UX pass.
- Hypercert detail, listing dialog, marketplace approval gate, empty/error/ready states.
- Client-facing claim cleanup only where a public/client surface implies marketplace completion without live readiness evidence.

## Design Contract

- Restrained operator command surface.
- Use existing `Admin*` wrappers and shared Storybook-backed foundations.
- No hero moments, decorative gradients, marketing layout, or vague setup prose.
- Make state visible: unavailable, needs approval, ready, pending, success, failure.
- Add all new user-facing strings to `en`, `es`, and `pt`.

## TDD / Visual Proof Requirement

Start with failing tests or stories for the state matrix before changing UI. Record:

- RED/GREEN admin test output.
- Storybook/browser evidence for each marketplace state.
- `bun run lint:vocab`.
- `bun run check:design-generated` and `bun run check:design-tokens` when UI/design files move.

## TDD Proof

Pending.
