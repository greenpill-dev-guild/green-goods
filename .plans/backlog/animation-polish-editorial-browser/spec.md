# Spec

## In Scope

- Diagnose the garden dialog open feel in browser with real animation timing evidence.
- Reconcile Radix dialog animation with editorial stagger if they conflict.
- Add close choreography only if it can be verified without introducing navigation bugs.
- Improve card-to-dialog shared-element morph quality.
- Extend section reveal behavior to the remaining public browser routes.
- Add restrained microinteractions for editorial links, cards, inputs, and image paint.
- Preserve reduced-motion behavior and keyboard/focus expectations.

## Out of Scope

- Adding a new motion library.
- Restoring the deleted full-page `GardenDetail.tsx` route.
- Changing public content strategy or partner/supporter content.
- Broad design-system review.
- Contract, indexer, or admin work.

## Surfaces

- `packages/client/src/styles/view-transitions.css`
- `packages/client/src/styles/editorial.css`
- `packages/client/src/views/Public/GardenDialog.tsx`
- `packages/client/src/views/Public/{Gardens,Impact,Fund,Actions,Cookies}.tsx`
- `packages/client/src/components/Public/PublicGardenCard.tsx`
- `packages/client/src/components/Public/PublicEditorialHero.tsx`
- `packages/client/src/components/Public/atoms/EditorialAtoms.tsx`
- `packages/shared/src/hooks/ui/useInViewReveal.ts`
- `packages/shared/src/components/Display/ImageWithFallback.tsx`

## Promotion Trigger

Promote this plan from backlog to active only when the public walkthrough has settled
and there is a focused session available for browser animation diagnosis plus proof.
