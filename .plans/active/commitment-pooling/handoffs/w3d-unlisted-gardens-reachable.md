# Pooling Rehearsal Follow-ups — W3-D Unlisted, not unreachable

## Lane

- Execution sub-lane: `w3d_unlisted_gardens_reachable` (machine lane `state_api`; also `ui`)
- Branch: `fix/unlisted-gardens-reachable`, from a fresh `origin/develop` after W3-C merges
- Depends on: `w3c_seed_wizard_questions`
- Merge: `--merge` on green CI and resolved bot threads
- Class: sensitive (public route behaviour)
- Linear child: `status.json` → `execution_sub_lanes.w3d_unlisted_gardens_reachable.linear.issue`
- Decision: § 1 row 36

## Scope

N2. Unblocks the public-page steps of the rehearsal for both gardens.

## What the code does today

- `packages/shared/src/config/garden-visibility.ts` keeps two tiers: `GARDENS_HIDDEN_EVERYWHERE`
  and `GARDENS_HIDDEN_FROM_EDITORIAL` (Green Goods Community Garden, Aiyeloja Family Garden, Mama
  Gardens). `isGardenPubliclyVisible` returns false for both tiers.
- `packages/shared/src/hooks/public/usePublicGardenDetail.ts:126` filters the whole garden list by
  `isGardenPubliclyVisible` before it looks the address up, so a direct link to an editorial-hidden
  garden renders Not Found. The comment there names the leak the curation closes: a garden off the
  archive must not render a full detail page. The decision narrows that to gardens hidden
  everywhere.

## Steps

1. **Two predicates.** Add `isGardenPubliclyReachable(garden)` (false only for the
   hidden-everywhere tier) and `isGardenUnlisted(garden)` (true for the editorial tier) beside
   `isGardenPubliclyVisible`, which archive, counters and lists keep using.
2. **The detail hook.** `usePublicGardenDetail` filters by reachable and returns `unlisted: true`
   for the editorial tier. A hidden-everywhere garden still resolves to Not Found.
3. **The page.** The public garden page prints one quiet line under its title when `unlisted`,
   `public.garden.unlisted` ("This garden is not in the public lists."), and sets a `noindex` robots
   meta through the already-wired `react-helmet-async`, so unlisted means unlisted to crawlers too.
4. **The plan.** § 6.3's note that the protocol pool is on the public site becomes "reachable by
   its own link, not listed"; add a successor catalog case for the unlisted line where PUB-058
   describes the page.
5. **Copy.** The new key in `en`, `es` and `pt`.

## Tests (RED first)

- A `garden-visibility` unit test: the editorial tier is unlisted and reachable; the
  hidden-everywhere tier is neither; every other garden is visible.
- `usePublicGardenDetail` test: an editorial-hidden address resolves with `unlisted: true`; a
  hidden-everywhere address is Not Found; a visible garden is unchanged.
- A public page test for the line and the meta tag.

## Rendered proof

A clean-room public capture of one rehearsal garden's page by its own link (the Brave DevTools MCP
profile or the desktop app's Browser pane), labelled as such, plus the archive showing the garden
still absent. No authenticated proof is needed.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/hooks/public/usePublicGardenDetail.test.ts
bun run --filter @green-goods/client test -- src/__tests__/views/Public
bun run --cwd packages/shared typecheck -- --scope full
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/hooks/public/usePublicGardenDetail.test.ts
```

## Out of scope

Changing which gardens are on either tier, the archive and counters, and the pooling bands on the
page.

## Unblock evidence

RED and GREEN recorded; PR merged; A9, B7 and M8 walkable on staging; sub-lane `completed`;
Linear child Done.

## Validation Receipt

Pending.
