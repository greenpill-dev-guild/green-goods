# UI Handoff - Website UX Flow Optimization

## Status

Phase 1 implemented and locked under targeted tests. Phase 2 and Phase 3 remain
unstarted by intent — they are out of scope for this lane invocation.

## Phase 1 — what landed

The earlier feature commit `70161031 feat(client,shared): public website UX flow
optimization (rounds 1-5)` already shipped most Phase 1 production code:
- `PublicFundingCard` replaced `PublicFundingMethodSelector` as the funding
  decision dialog. The new card is flat (no `rounded-2xl`/`rounded-3xl`
  surfaces), amount-first, and renders zero web3 risk vocabulary in its body.
- `PublicFundingReceipt` already routes a successful visitor onward via
  `EditorialLinkArrow` to `/fund` ("Support another Garden →") and `/impact`
  ("View public evidence →").
- `PublicGetInTouch` mobile layout stacks input above button at `<sm` and the
  form is reset on success via `form.reset()` after the toast resolves.
- `Fund.tsx` disclosures aside reads in the plain-English bridge dialect (no
  "smart contract", "yield", "wallet recovery", or "onchain").

This lane's work was therefore to lock those guarantees behind contract tests
and remove the residual decision-moment vocabulary that survived as orphan i18n
keys.

### Production deltas

- `packages/shared/src/i18n/{en,es,pt}.json` — removed 13 orphan keys per
  locale that referenced the retired `PublicFundingMethodSelector`. Two of
  them (`public.fund.dialog.endow.description`, `public.fund.dialog.card.endowNote`)
  still carried "yield" / "embedded wallet" decision-moment vocabulary in the
  shipped bundle even though no component referenced them. Verified unused
  via `grep -rn "public.fund.dialog.<key>" packages` before deletion.
- `packages/client/src/__tests__/components/PublicFundingBridge.test.tsx` —
  refreshed the test stub so it mirrors the production en.json copy after
  the round-4 rewrite. The previous fixture still embedded "smart contract,
  token, yield, provider, and wallet recovery risk" and asserted on it,
  giving a false-positive that locked the OLD vocabulary in place.

### New tests (contract guards)

- `packages/client/src/__tests__/components/PublicFundingDialogVocab.test.ts`
  scans every `public.fund.dialog.*` and `public.fund.card.*` key in en/es/pt
  and fails the build if any value contains "smart contract", "yield",
  "wallet recovery", or "onchain". This is the canonical RED test for the
  decision-moment-language acceptance.
- `packages/client/src/__tests__/components/PublicFundingReceipt.test.tsx`
  renders the receipt in a memory router with a fetch mock that resolves to
  a confirmed Endow intent and asserts both `EditorialLinkArrow` wayfinding
  links resolve to `/fund` and `/impact` exactly.
- `packages/client/src/__tests__/components/PublicGetInTouch.test.tsx`
  gained two assertions: the email input value is `""` after a successful
  subscribe (locks the `form.reset()` contract), and the input/submit pair
  uses `flex-col` + `sm:flex-row` with the submit button keeping `w-full`
  on mobile so the placeholder cannot be truncated again at 375px.

## RED proof

`bun run test --run src/__tests__/components/PublicFundingDialogVocab.test.ts`
ran against the original i18n bundle:

```
FAIL  src/__tests__/components/PublicFundingDialogVocab.test.ts
× never ships smart contract / yield / wallet recovery / onchain in any
  funding dialog or card key (en/es/pt)
AssertionError: expected [ { locale: 'en', …(3) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "key": "public.fund.dialog.endow.description",
+     "locale": "en",
+     "term": "yield",
+     "value": "A Vault deposit designed to preserve your principal while yield supports the Garden.",
+   },
+ ]
```

## GREEN proof

After removing the orphan dialog keys from all three locales:

```
$ bun run test --run src/__tests__/components/PublicFundingDialogVocab.test.ts
✓ src/__tests__/components/PublicFundingDialogVocab.test.ts (1 test) 5ms
Test Files  1 passed (1)
     Tests  1 passed (1)
```

Combined targeted run after format pass:

```
$ bun run test --run \
    src/__tests__/components/PublicFundingDialogVocab.test.ts \
    src/__tests__/components/PublicFundingReceipt.test.tsx \
    src/__tests__/components/PublicGetInTouch.test.tsx \
    src/__tests__/components/PublicFundingBridge.test.tsx
✓ src/__tests__/components/PublicFundingDialogVocab.test.ts (1 test) 4ms
✓ src/__tests__/components/PublicFundingReceipt.test.tsx (2 tests) 318ms
✓ src/__tests__/components/PublicFundingBridge.test.tsx (3 tests) 429ms
✓ src/__tests__/components/PublicGetInTouch.test.tsx (6 tests) 497ms
Test Files  4 passed (4)
     Tests  12 passed (12)
```

Repo-level guards:
- `bun run lint:vocab` — `✅ check-vocab: no banned vocabulary found in 3 i18n file(s).`
- `bun run format:check` — `Checked 1687 files in 1353ms. No fixes applied.`
- `node scripts/harness/plan-hub.mjs validate` — `Validated 23 feature hubs.`

## Proof limits

- **Browser walk-through (1440 + 375)** — not executed in this lane. The
  worktree environment had `bun install` skip postinstall scripts because
  `sharp@0.32.6` could not build under the available system Node 18, which
  blocked starting the public dev stack here. The mobile layout regression
  the plan called out is locked instead via the new `flex-col` + `sm:flex-row`
  + `w-full` + `sm:w-auto` assertion in `PublicGetInTouch.test.tsx`. Visual
  tone confirmation belongs to the QA lane (`claude-qa-pass-1`) which has
  direct browser access.
- **`packages/client/src/__tests__/views/fund.test.tsx`** — pre-existing
  `ERR_PACKAGE_PATH_NOT_EXPORTED` from `@walletconnect/utils` →
  `uint8arrays` resolution in the worktree's partial install. Not introduced
  by this change; surfaces only in this worktree environment because the
  full install was skipped. The fund view's user-facing copy is unmodified
  by this lane.

## Files touched

```
M packages/client/src/__tests__/components/PublicFundingBridge.test.tsx
M packages/client/src/__tests__/components/PublicGetInTouch.test.tsx
M packages/shared/src/i18n/en.json
M packages/shared/src/i18n/es.json
M packages/shared/src/i18n/pt.json
A packages/client/src/__tests__/components/PublicFundingDialogVocab.test.ts
A packages/client/src/__tests__/components/PublicFundingReceipt.test.tsx
```

## Required RED Proof — checked

- ✅ A targeted test fails while the funding selector still exposes technical
  decision-moment language. Captured above as `PublicFundingDialogVocab.test.ts`
  RED.
- ✅ Receipt success has the expected next-step routes — locked by
  `PublicFundingReceipt.test.tsx` (would fail if either link were removed
  or pointed elsewhere).
- ✅ Subscription success clears the email field — locked by the new
  assertion in `PublicGetInTouch.test.tsx` (would fail if `form.reset()` is
  removed or the field becomes controlled).

## Required GREEN Proof — checked

- ✅ Targeted public-browser tests pass for the changed behaviour.
- ✅ No new strings introduced — Phase 1 cleanup only removed 13 orphan keys
  per locale that no component referenced; en/es/pt remain row-aligned
  (3,189 lines each after deletion).
- ❎ Browser check — recorded as a proof limit above. The mobile-stack contract
  is pinned by class assertions instead.

## Next step

If the human chooses to continue past Phase 1 in this worktree:
- Phase 2 (loading + empty + error honesty) and Phase 3 (discovery + first-time
  mental model) remain unstarted. Each is independently shippable per
  `plan.todo.md`.
- Otherwise, hand to `claude-qa-pass-1` for the desktop + 375px walk-through
  across the seven visitor flows.
