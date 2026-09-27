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

## Implementation notes (2026-09-27)

- `garden-visibility.ts` gains `isGardenPubliclyReachable` (false for the hidden-everywhere tier and
  for a garden never filled in) and `isGardenUnlisted` (the editorial tier).
  `isGardenPubliclyVisible` is now reachable and not unlisted, so the archive, counters and lists
  read exactly what they read before.
- `usePublicGardenDetail` resolves against the reachable set and returns `unlisted`.
- The garden page prints the line in the hero card's publication mark, at the foot of the card,
  and sets `<meta name="robots" content="noindex">` through `react-helmet-async`, which renders
  through React 19's head hoisting. The key is `public.gardenDetail.unlisted`, in the page's own
  namespace rather than the sketched `public.garden.unlisted`, and the copy capitalises Garden as
  the public pages do: "This Garden is not in the public lists."
- The public work page reads the same hook, so a shared note from an unlisted garden now opens as
  well; it carries the same noindex tag.
- The page offers no Support This Garden link for an unlisted garden: the Fund page resolves its
  `?garden=` against the listed set, so the link would find nothing. Funding an unlisted garden by
  its own link would be a new product decision, not part of this lane.
- Review round 2 on #928: the Support link waits until the Garden is known to be listed (the detail
  decides; before it arrives only the archive's own card proves a listing), and a slug a listed
  garden shares resolves to the listed garden. An unlisted garden answers to a slug only when no
  listed garden does and no other unlisted one shares it; an exact address always resolves.
- The branch is cut from develop at `c17a03b46` before W3-B and W3-C merge, since it touches none
  of their files; it takes develop again before it merges.
- § 6.3's note now reads "reachable by its own link and not listed". PUB-060 is the catalog case
  for the unlisted page, registered in the ID ledger and listed with the other public-page cases.

## RED and GREEN evidence

RED at `c17a03b46` with the new and changed tests: four failed as the gap predicts. The predicates
did not exist; the detail hook returned no `unlisted` and resolved no editorial-hidden garden; the
page printed no line and set no robots tag. The work page's noindex test failed the same way before
its change. GREEN at `538b2d4e2`: the visibility and public hook suites (73 tests in 12 files) and
the public garden, semantics, work and editorial page suites (64 tests in 4 files) pass.

## Unblock evidence

The lane closes when RED and GREEN are recorded, the PR merges, A9, B7 and M8 are walkable on
staging, the sub-lane is `completed`, and the Linear child is Done. As of 2026-09-27 all of these
hold: #928 merged as `303d114fd`, the sub-lane is `completed`, and PRD-993 is Done. On staging, in a
clean-room headless Chromium session, the Aiyeloja Family Garden and Green Goods Community Garden
pages open by their own links; each says it is not in the public lists, carries `noindex` and offers
no Support link; and the Gardens archive lists neither. That is the rendered proof this lane asked
for, taken on staging rather than the Browser pane, which was hidden.

## Validation Receipt

- Tested implementation commit SHA: `538b2d4e2` (on `fix/unlisted-gardens-reachable`)
- Run at (UTC): `2026-09-27T08:38Z` to `2026-09-27T08:52:54Z`, on the same tree just before its commit
- Exact command(s): `bun run --cwd packages/shared test --` over `src/__tests__/config/garden-visibility.test.ts` and `src/__tests__/hooks/public`; `bun run --cwd packages/client test --` over `PublicGardenDetail`, `PublicGardenDetailSemantics`, `PublicWorkDetail` and `commitment-editorial`; `bun --bun x vitest run --dir scripts/agents qa-app-build`; `node scripts/quality/check-qa-id-ledger.mjs`; `node scripts/docs/generate.mjs --check`; `bun run check --only ontology`; `bun run --cwd packages/shared typecheck -- --scope full`; `bun run --cwd packages/client typecheck` and `-- --scope tests`; `bun --bun run oxlint packages/client/src/views/Public packages/shared/src/config packages/shared/src/hooks/public --deny-warnings`; `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`
- Result: 73 shared tests in 12 files and 64 client tests in 4 files passed; the catalog contract test passed 23; the ledger check found 421 ids with none removed, reintroduced or reactivated; generated docs, ontology, typechecks, oxlint and source structure passed. The local pre-push gate was skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the non-plan paths `538b2d4e2` changes against `c17a03b46`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <the validated paths>` → empty
- Evidence-only diff command and result (if applicable): this handoff commit changes only plan files
- Rendered proof: pending, a clean-room capture of one rehearsal garden's page by its own link and of the archive without it.
