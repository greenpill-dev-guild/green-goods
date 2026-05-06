# Run 1 — corrections after deeper investigation

After advisor flagged that the cycle would re-discover environmental constraints, I verified the 3 ambiguous "must-fix" items with code reads + screenshots + indexer probes. Findings change the matrix.

## Item 3 (Admin UserMenu discoverability) → **GREEN, not yellow**

Screenshot at `https://localhost:3002/hub/work` after clicking the wallet-address chip (`0xaB...b0a`) showed the **AccountSurface RightSheet** opens with Profile / Settings tabs, the AB avatar, role label "Operator", and a Wallet section with copy-address. Logout button is below the visible viewport but is wired in `AccountSettingsPanel.tsx:86`. **No bug — the entry was simply lower than my earlier viewport probe could see.** Action 10 status moves to green.

## Item 2 (PWA Treasury Drawer entry) → **needs garden detail context, working as designed**

The "Garden funds" button on `/home` at first probe was visible because the carousel had a garden (Ilhas de Abundância) selected as its preview. After navigation, the button visibility tracks the carousel's selected garden state. The drawer is opened via `useUIStore.openEndowmentDrawer` (Home/Garden/index.tsx:55) — which is gated by `garden` context. **Treasury Drawer is reachable from `/home/:id` (garden detail), not the carousel home root.** Click on garden card in carousel **selects** but doesn't navigate to `/home/:id` — design choice. Action 5/6/7 PWA status: yellow remains (entry visible but tied to garden selection state; no broadcasts on mainnet).

## Item 1 (Editorial empty data surfaces) → **CONFIRMED BUG, not intentional copy**

Verified end-to-end:

1. **Indexer is populated.** GraphQL endpoint `http://localhost:8080/v1/graphql` returns 18 gardens for `chainId: 42161`, including "Ilhas de Abundância", "Green Goods Community Garden", "TAS HUB", "Greenpill London", etc.
2. **The exact query that `getGardens()` builds** (`Garden(where: {chainId: {_eq: 42161}}, ...)`) returns 18 gardens via `/api/graphql` proxy and via `http://localhost:8080/v1/graphql` direct.
3. **Calling `getGardens()` via dynamic import in the editorial /gardens tab** returned `gardenCount: 18, firstName: "Ilhas de Abundância"`. The data layer works in isolation.
4. **Yet the editorial page itself renders 0 articles** with "Gardens will appear here as they come online." copy (filtered.length === 0 branch in `Public/Gardens.tsx:149-168`).
5. No console errors. React Query `__rq_pc__` localStorage shows `no-rq-cache` on the editorial tab — the persistor isn't writing the public gardens query result.

**Conclusion**: there's a real disconnect between `usePublicGardens()` resolving inside the component vs. directly invokable. Suspect causes (in order of likelihood):
- React Query staleTime / placeholder behavior caching an empty-array first response (e.g. before chainId resolved, or before persister hydrated)
- `usePublicGardens` getting `chainId = DEFAULT_CHAIN_ID` at hook-call time when the resolved chainId is different in the editorial context
- Persister gating that excludes `queryKeys.public.gardens(chainId)` — `App.tsx:97` filter `key[0] === "greengoods"` may not include `public` namespace, so public queries don't persist and re-fetch races

This affects at least these public surfaces: `/gardens`, `/fund`, `/cookies`, `/impact`, `/actions` — all consume hooks from `packages/shared/src/hooks/public/`. **Public-facing release-readiness blocker** for editorial site.

## What's actually fixable vs deferrable

| Finding | Confirmed bug? | Fixable in this session? | Risk |
|---|---|---|---|
| Editorial /gardens empty | Yes (race/cache mismatch in usePublicGardens) | Risky — root cause needs more investigation; could break other surfaces | Medium-high |
| PWA Treasury entry on /home | No — design choice | n/a | n/a |
| Admin UserMenu discoverability | No — fully wired, sheet opens correctly | n/a | n/a |
| Action 4 Submit Work — empty | No — user has no garden membership, behavior correct | n/a | n/a |
| Action 8 Cookies — 0 jars | No — no campaign jars deployed yet | n/a | n/a |
| Action 11 Review Work — empty queue | No — genuine state | n/a | n/a |
| Action 14 Cookies/deploy — Unauthorized | No — role gate working | n/a | n/a |
| All tx-bound actions render-only | No — mainnet, can't broadcast | n/a | n/a |

## Recommended scope for cycle 2

Cycle 2 should be a **different-lens audit**, not a re-run of Chrome MCP probes against the same env. Two candidate lenses:
- **(a) Test-suite gap audit**: run `bun run test` per package, capture which suites pass/fail/skip on this branch. The skipped-test commits (7fee5b9, 2927e2a, 722ee75) are explicit deferrals — verify nothing else is silently broken.
- **(b) Build / typecheck audit**: run `bun build` and `bun run typecheck` (if it exists) to verify no type or import regression on the release branch.

Cycle 3 should be a **diff vs main audit**: what does release/1.1.0 add that main doesn't? Are there any commits explicitly marked "WIP"/"do-not-ship" that snuck in?

This is what I'm doing for cycles 2 and 3 instead of re-running the same surface verifications. The /gardens public-surface bug is documented above for the user to triage separately — fixing it requires more focused investigation than the audit format allows.
