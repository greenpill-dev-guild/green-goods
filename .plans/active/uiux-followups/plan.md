# UI/UX Follow-ups — Audited Execution Plan (2026-07-02)

> Follow-up work left behind by the six-wave UI/UX & systems session (PRs #602–#609, all merged
> to develop 2026-07-01/02). Every item below was re-verified at HEAD `46f97b454` on 2026-07-02.
> Source docs: the archived wave hub `.plans/archive/ui-ux-systems-audit/` (progress.md
> § Standing follow-ups) and `dialog-census.md` (pass 1 + 2), which now lives **in this hub**
> alongside `admin-tsc-baseline.txt` — both moved here 2026-07-02 when the wave hub archived,
> because Slices 2 and 4 still write to them. Branch cadence: one branch + PR per slice,
> targeting develop; `gh` always with `--repo greenpill-dev-guild/green-goods`.

## Context

The wave session closed its planned tasks but left six follow-ups. Re-verification at HEAD
materially changed the picture in three ways:

1. **Develop's CI is red at HEAD on three fronts** (post-Wave-D push run `28560511501` +
   `28560511489`): the Admin **Test** job (4 failing unit tests), the Design workflow's
   **Storybook interaction smoke** (15 failing tests — the F2 set, persisting), and Design
   Guardrails' **check:design-generated** (stale artifact). Since these are required checks
   aggregated by CI Gate, **every future PR inherits red CI** — the same dynamic #606 fixed last
   session. Clearing this is now Slice 0 and blocks everything else.
2. **The typecheck gap (F1) is admin AND client**, and the `ox` blocker has a precise cause:
   `resolvePackageJsonExports: false` in both `tsconfig.app.json` files (shared sets `true` and
   typechecks green). The 509-line `tsc -b` baseline is stale AND undercounted: a live re-measure
   at HEAD (Slice 2) puts the real work at 46 admin + 8 shared error lines once the config flip
   lands — plus ~7 of those look like latent runtime bugs, which is the strongest argument for
   the gate.
3. **A second local-vs-CI divergence surfaced**: admin's local `test` script excludes
   `src/__tests__/views/**` while CI's `test:coverage` runs everything — that's why wave Ship
   Gates were honestly green locally while develop's Admin workflow was already red pre-waves
   (runs `28534160949`/`28532602619`, 2026-07-01 16:32/16:59). Same failure family as the
   zero-file tsc gap: the gate you run is not the gate CI runs.

## Decisions (Afo, 2026-07-02 planning session — 12 questions, all answered)

1. **F5 donate echo: defer entirely.** No code; rationale + revisit trigger recorded below.
2. **F4: instant-exit + safety net** (both parts), timeboxed with net-only fallback.
3. **Test scope: local runs CI scope** — remove the views exclusion from admin's local test script.
4. **Latent runtime-bug candidates: fix inline in 2a**, each with a verified-behavior note.
5. **EAS-blocked census rows: Storybook closure**, marked "verified-in-Storybook (EAS unindexed by design)".
6. **/actions rows: fork hat-grant attempt** (anvil impersonation + cast), timeboxed, honest-blocked fallback.
7. **2b client gate: after 2a + re-measure** on fresh origin/develop (concurrent client work notwithstanding).
8. **Linear: per-slice issues** (0, 1, 2a, 2b, 3, 4) — Product team, unprojected, `source:plans` + `package:*` labels.
9. **Slices 1 ∥ 2a run in parallel sessions** after Slice 0 merges (bounded paths per Multi-Agent Repo Safety; Repo Quick Gate checkpoint before each merge).
10. **No story quarantine in Slice 1** — if the proper fix balloons, stop and report options; never skip-tag.
11. **F6a tone scope: vault AND cookie-jar modal pairs** (conditional on the mounting-surface check).
12. **Slice 4 runs as a dedicated session with Afo nearby** (Brave foregrounded, extension connected), banking census rows incrementally.

## Verification summary (follow-up → status at HEAD)

| Item | 2026-07-02 snapshot claim | Verified at HEAD |
|---|---|---|
| F1 typecheck | admin-only framing; "~26 real errors" | **Holds, wider + re-measured**: admin + client share the zero-file `-p` gap (`--listFilesOnly` → 0 on both solution configs); shared/agent/indexer are fine. `ox`/storybook noise = `resolvePackageJsonExports: false` (introduced `bba9469cf` with no recorded rationale). Live `tsc` runs at HEAD: admin app config 512 errors as-is → **91** after the config fix (46 admin src / 28 files + 8 shared / 8 files + 37 story lines); client 250 → **81** (73 client src / 16 files + same 8 shared; client stories already clean). The old "~26" figure was an undercount from the stale `-b` baseline (which has also drifted — e.g. `CanvasLayout` `sheetLayerRoot` is already fixed). Admin's `paths` block pins `@green-goods/shared` to `../shared/src`, so the gate transitively checks 603 shared files — a cross-package gate for free. |
| F2 story failures | ~15 admin canvas stories, may be CI env | **Holds**: fresh develop run at HEAD fails 15 tests / 9 files — near-identical set (Create Mobile dropped out, Detail Inspector joined). #607's rewiring did NOT clear them. Plus two failures the snapshot missed: 4 admin unit tests (`cn` mock + banner test) and stale `client-pwa-token-audit.generated.md`. |
| F3 runtime QA | ~10 census rows + P3.5 pending stable Brave | **Holds**: all 16 census dialogs exist unchanged at HEAD (paths re-confirmed). Storybook stories exist for **every** EAS-blocked flow (SubmitWork, HypercertWizard, MintingDialog, CreateListingDialog, cookie jars, roles/members, domain editor, settings, Hub queues) → Storybook isolation is viable for those rows. |
| F4 ghost overlay | Radix Presence + hidden-tab animationend | **Holds**: `AdminDialog.tsx` (Radix Dialog), exit animations in `admin-m3-overrides.css:232–314` (`animation … both` on `[data-state="closed"]`), no visibility handling anywhere. Precedent: `1800e6f5` A4 added a navigation-time stuck-lock safety net in `CanvasLayout.tsx:253–270`. |
| F5 donate echo | check indexer entities first | **Resolved — NOT indexed**: `config.yaml` indexes only `JarCreated`/`MetadataUpdated` from CookieJarFactory; `VaultDeposit`/`VaultEvent` (per-depositor, per-event) exist **for garden Octant vaults only**. Indexer Boundary explicitly excludes cookie jars. No client-side `getLogs` precedent. |
| F6a vault tone | deliberate `home` default | **Holds**: `DepositModal.tsx:174` + `WithdrawModal.tsx:136` omit `tone`; mounted from `views/Garden/Vault.tsx` (rendered inside the community treasury inspector, which itself opens `community`-toned). Cookie-jar Deposit/Withdraw also omit tone while their sibling Manage modal is explicitly `hub`. |
| F6b stale chip | dismiss after #606 | **Not actionable from a session**: task chips don't persist across app restarts; the P0A chip can only be dismissed by Afo in the UI if it still shows. #606 (the fix it pointed at) is merged. |

## Slices

### Slice 0 — Clear develop's red CI (URGENT, do first)

Branch `fix/develop-ci-debts-2`. Everything else stacks on this being green.

**Files / changes:**
- `packages/admin/src/__tests__/views/Actions/GreenWillPanel.test.tsx:34` — the
  `vi.mock("@green-goods/shared", …)` factory misses `cn`, which `AdminCard.tsx:3` imports
  (3 failures: "shows inline validation…", "surfaces lookup errors…", "keeps empty successful
  lookups distinct…"). Fix with the `importOriginal` partial-mock pattern (or add `cn`) —
  prefer `importOriginal` so the next shared export doesn't re-break it.
- `packages/admin/src/components/Garden/GardenSettingsEditor.test.tsx` — 1 failure ("previews a
  selected banner locally and uploads to IPFS only on Save"). NOTE: this file is NOT under the
  local views exclusion, and wave Ship Gates ran it green locally — so it's either a late-wave
  regression or CI-env/coverage-mode dependent. Reproduce with the CI scope
  (`cd packages/admin && bun run test:coverage`); fix root cause; if it's an unmocked network
  boundary (ENS/IPFS noise appears adjacent in CI logs), mock the boundary, don't loosen the
  assertion. Cross-slice hazard: Slice 2a later fixes the `maxGardeners` typing feeding this
  component's `garden` prop — re-run this test when 2a lands.
- `docs/docs/builders/packages/client-pwa-token-audit.generated.md` — stale; run
  `bun run design:generate` and commit the regenerated artifact(s). (Waves C/D touched client
  tokens without regenerating.)
- `packages/admin/package.json:12` — **test-scope parity (decision 3)**: local `test` excludes
  `src/__tests__/views/**` + `StrategyKernelStep.test.tsx`; CI `test:coverage` (admin.yml:77–79)
  excludes nothing. Remove the views exclusion locally so local == CI (the delta is ~12 tests;
  CI runs the full 480 in ~4 min). If a specific file is pathological locally, keep a single-file
  exclusion with a comment, mirrored in CI. First check why `3ed012e14` added it.
- ~~Update the wave hub's progress.md standing-follow-ups section~~ — DONE at plan-commit time
  (`d6dea1d7a` added the pointer; the hub is now archived at
  `.plans/archive/ui-ux-systems-audit/` with a banner pointing back here).

**Acceptance:** `cd packages/admin && bun run test:coverage` exits 0 locally; fresh develop push
run shows Admin workflow + Design Guardrails green (Storybook smoke stays red until Slice 1 —
note this in the PR body so nobody reads it as a regression of this PR).
**Effort/risk:** S–M / low. The banner test is the only unknown — timebox root-causing it; if
env-flaky, say so in the PR rather than shipping a fake fix.
**Validation mode:** targeted tests + the CI run itself (QA Speed Mode; no Ship Gate needed for
a CI-debt fix, but `bun run test` must pass for admin+shared).

### Slice 1 — Root-cause the 15 Storybook interaction failures (F2)

Branch `fix/storybook-interaction-ci`. The failing set at HEAD (job `84677076333`):

| File | Failing tests |
|---|---|
| `components/AdminDialog.stories.tsx` | Flow Variant |
| `components/Layout/CanvasLayout.stories.tsx` | Real Provider Shell |
| `components/Layout/RightSheetRegistry.stories.tsx` | State Catalog |
| `views/Actions/Actions.stories.tsx` | Detail Inspector |
| `views/Actions/ActionsSheetDescriptor.stories.tsx` | Route Backed Detail / Create / Edit |
| `views/Community/Community.stories.tsx` | Treasury, Vault Inspector |
| `views/Garden/Garden.stories.tsx` | Overview, Garden Switch Remains Interactive, Url Garden Sync |
| `views/Garden/SubmitWork.stories.tsx` | Available Action, Action Chooser |
| `views/Hub/Hub.stories.tsx` | Work Queue |

**Step 1 (fork the diagnosis):** reproduce locally with the exact CI entry point:
`bun run --filter @green-goods/shared test:stories:ci` (wraps
`scripts/dev/run-storybook-vitest-ci.mjs`; 10-min timeout, prepare-design-assets step).
Run once with the repo `.env` and once with CI-shaped env (no `VITE_CHAIN_ID`) — CI logs show
`VITE_CHAIN_ID`-missing warnings, Reown 403s, MSW unhandled `getGardenVaults`/yield-allocation/
`token()` reads, and uniform ~5s durations (play-function timeout signature: components stuck in
loading → assertions never resolve).
- **If local+CI-env reproduces:** fix the stories' data layer — add the missing MSW handlers /
  story-level chain config so canvas stories don't depend on ambient env. Likely one shared cause
  (provider-shell stories all hit the same queries), not 15 independent bugs.
- **If local passes with `.env`:** the fix is CI env, not stories — set `VITE_CHAIN_ID` (and
  whatever else the doctor flags) in the Design workflow's Storybook job env block.

**Acceptance:** `test:stories:ci` green locally AND the Design workflow's "Run Storybook
interaction smoke tests" green on the PR + on develop after merge. No story assertions gutted to
pass (rewire data, don't delete checks). **No quarantine (decision 10):** if the proper fix
balloons beyond ~a day of work, stop and report the per-story diagnosis + effort options — do not
skip-tag stories to force green.
**Effort/risk:** M / medium — diagnosis is the work; the fix itself is likely mechanical once the
fork resolves. High value: with Slice 0, develop's required checks become trustworthy again.

### Slice 2 — Real whole-package typecheck gate (F1, HIGH VALUE)

Two PRs: **2a admin** (`fix/admin-typecheck-gate`), then **2b client** (`fix/client-typecheck-gate`).
The design below was measured with live `tsc` runs at HEAD (not extrapolated from the stale
baseline); error counts are pinned so the executor can detect drift.

**Gate shape (decided): `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json`
per package — NOT `tsc -b`.** No referenced project has `composite: true` (so `-b` semantics are
accidental), `-b`'s `.tsbuildinfo` caching can produce stale passes, and shared is already
re-checked transitively via the `paths` block (603 shared files inside admin's program), so `-b`'s
shared rebuild would only duplicate shared.yml's existing gate. `.tsbuildinfo` writes are
gitignored (`.gitignore:51`) — non-issue.

**The unlock (measured):** in each `tsconfig.app.json`: delete `resolvePackageJsonExports: false`
(default is `true` under `moduleResolution: bundler`) and bump `target`/`lib` ES2020 → **ES2022**.
Effect: admin 512 → 91 errors (node_modules 55 → 0), client 250 → 81 (stories 76 → 0). Safe for
Vite parity: esbuild/rollup always honor exports maps, neither vite config sets `build.target`
(Vite 7 default `baseline-widely-available` ⊇ ES2022 surface), and tsc is `noEmit`. ES2022 is
deliberately below shared's own ESNext: if shared code admin imports starts using >ES2022 APIs,
the admin gate flags it — correct, given admin's browser budget.

**2a — admin gate (M, ~2 days):**
1. `packages/admin/tsconfig.app.json`: target+lib → ES2022; drop `resolvePackageJsonExports:
   false`; **temporarily add `src/**/*.stories.tsx` to `exclude`** (37 known story-error lines /
   15 files — stories are currently INCLUDED in this config; re-include in 2c) with a comment.
   Don't touch the `paths` block, the solution `tsconfig.json` (editors use it), or
   `tsconfig.node.json` (already green).
2. `packages/admin/package.json`: add `"typecheck": "tsc --noEmit -p tsconfig.app.json && tsc
   --noEmit -p tsconfig.node.json"`; in `build`, swap the vacuous `-p packages/admin/tsconfig.json`
   → `-p packages/admin/tsconfig.app.json` (build keeps typechecking, now for real).
3. `.github/workflows/admin.yml` `lint-build` job: add a "Typecheck admin" step after
   format-check, before build (mirror `shared.yml:172–174`; no `VITE_*` env needed). The job is
   already CI-Gate-required, so no ruleset change.
4. Fix the **8 shared lines / 8 files** (unused-locals class). Judgment per line, not blind
   `_`-prefixing — `wallet-sender.ts:54` (`erc7677ProxyUrl`) and
   `useEffectiveToolbarPermissions.ts:62` (`isOwner`) look like unfinished wiring; check intent.
   Then harden `packages/shared/tsconfig.json` with `noUnusedLocals` + `noUnusedParameters`
   (measured: exactly these files error) so future drift fails shared.yml, not admin CI.
5. Fix the **46 admin lines / 28 files**. Mechanical ~16 lines (unused import; `data-component`/
   `data-region` props on `CanvasRouteContentProps`; `Record<WeightScheme>` numeric-key
   normalization; `string | undefined` guards in Vault.tsx/CampaignCookieJarPanel; 4× identical
   `intl.formatMessage` consumer-type mismatch — one shared type definition fix clears all four;
   `() => void` vs `Promise<void>`; RouteObject[]). Modeling ~30 lines, of which **six are
   flagged as likely REAL runtime bugs — verify behavior, don't cast (decision 4: fix inline)**:
   - `main.tsx:63` — `createQueryPersister(...)` (per-query experimental `QueryPersister`) passed
     as `PersistQueryClientProvider`'s whole-client `Persister`. If real, admin's offline
     query-cache persistence silently doesn't work. Client's equivalent typechecks clean —
     compare, and verify IndexedDB `gg-admin-react-query` survives a reload after the fix.
   - `GardenWorkspaceContent.tsx:135` — `workspace.garden.maxGardeners` doesn't exist on `Garden`
     (nowhere in shared types) → settings editor receives `undefined`; missing indexer field or
     dead cap input. (Interacts with Slice 0's GardenSettingsEditor test — see hazards.)
   - `HubStageContent.tsx:114` — loading-state props passed that `HubHistoryQueueProps` doesn't
     accept → loading states silently dropped in the Hub history UI.
   - `CapitalsStep.tsx:124` — `FileUploadField` given `compress`/`showPreview`/`multiple` it
     doesn't declare → image compression may silently not run.
   - `WorkDetail/index.tsx:224` — `maxWidthClassName` silently dropped.
   - `MetadataEditor.tsx:144,172` — JSX `Element` where `string` expected → `[object Object]`
     risk in rendered text.
   Plus the `EASGardenAssessment` vs `GardenAssessment` root cause (`HypercertWizard/index.tsx`,
   `Assessment.tsx` `decodedDataJson`): fix once as a shared decoded-assessment type here — 46 of
   client's 73 lines are the same cause, so 2b reaps it. Remaining shape mismatches
   (WorkTab/WorkDetail `WorkDisplayStatus`, `Work` vs `EASWork`, `HypercertRecord`,
   `AdminCommunityRouteContext` ×3, SubmitWork ×2, ActionTranslationEditor, recharts v3
   `PieLabelRenderProps`, EditAction zod resolver ×4) are normal typing debt.
6. Verification (in-PR evidence): `tsc -p packages/admin/tsconfig.json --listFilesOnly | wc -l`
   → 0 (the vacuous-gate proof, for the PR body); `bun run typecheck` → 0 errors; seeded-error
   canary in admin src AND in a shared file in the closure → both fail the gate (proves the
   cross-package reach), then revert; `bun run build` parity; CI step green on the PR.
7. Retire `admin-tsc-baseline.txt` (in this hub) once the gate is green — the signature-diff
   workflow it anchored is superseded by the real gate. Delete it in the 2a PR.

**2b — client gate (M–L, after 2a):** same three config flips in
`packages/client/tsconfig.app.json` (**no story exclusion** — client stories are clean, free
coverage); `build`'s bare `tsc --noEmit` → `-p tsconfig.app.json`; same `typecheck` script +
client.yml step; fix the 3 `vite.config.ts` node-config errors (untyped `vite-tunnel-hmr.js`
import ×1, TS2769, TS7006); fix ~73 lines / 16 files — shared barrel drift first
(`GreenWillBadgeView`, `PublicImpactEvidenceKind` missing from `packages/shared/src/index.ts`;
type-only, no runtime break), then the GardenAssessment bucket via 2a's shared type
(`Assessments.tsx` + `Assessment.tsx`, 46 lines), then ~25 misc — `views/Home/Garden/Work.tsx:124`
(`smartAccountClient` not in `ProcessJobContext` — runtime-bug candidate: silently-dropped context
field), WorkCard `never` media types, thirdweb generics in VaultCard*, WorkDashboard
`EASWork`/`Work`. Client's `tsconfig.test.json` (a full src+tests program nothing runs) stays
unwired — noted follow-up.

**2c — optional follow-ups (S–M each, separate, no urgency):** re-include admin stories (fix the
37 lines / 15 files); delete the `@green-goods/shared*` `paths` entries (exports now resolve
identically — keep `@/*` + contracts mappings); root `"typecheck"` script — but do NOT wire
through turbo as-is (`turbo.json`'s `typecheck` task declares `dependsOn: ["^build"]`, which
would drag `@green-goods/contracts` forge builds into CI; override to `[]` first); an admin
test-file typecheck config (admin tests are typechecked nowhere today).

**Sequencing hazards (bind 2a/2b to Slice 0):** (1) `GardenSettingsEditor` spans Slice 0 (its
failing test) and 2a (`maxGardeners` feeds its `garden` prop) — land Slice 0 first, rebase, re-run
that test after the type fix. (2) GreenWill spans Slice 0 (panel tests) and 2b (shared barrel
export) — different packages, coordinate only if Slice 0's fix touches shared GreenWill hooks.
(3) A concurrent agent is actively editing client/shared (Splash/Login/arrival surfaces) as of
this plan's writing — **re-measure the client error counts on the execution branch before fixing**
(the 73/81 figures carry ±10% for this reason; admin src was clean when measured).

**Acceptance:** admin + client `bun run typecheck` exit 0 and run as required-job CI steps; both
`build` scripts typecheck real file sets; canary evidence in both PR bodies; the six runtime-bug
candidates each get an explicit verified-behavior note (fixed, or confirmed-benign with reason).
**Effort/risk:** 2a M / medium · 2b M–L / medium (dirty-tree drift) · 2c S–M / low. Highest
durable value in this plan: it converts a vacuous green gate into a real cross-package gate and
adjudicates ~7 latent runtime-bug candidates.

### Slice 3 — Small admin dialog fixes: vault tone + occluded-close (F6a + F4)

Branch `fix/admin-dialog-tone-and-hidden-close`. Two small, related admin-dialog touches.

**F6a — vault modal tone (`sensitive`, S):**
- `packages/admin/src/components/Vault/DepositModal.tsx:174` and `WithdrawModal.tsx:136`: add a
  `tone` prop threaded from the mounting surface rather than hardcoding — default stays `"home"`,
  and `views/Garden/Vault.tsx` (the treasury inspector content that mounts both) passes
  `tone="community"` to match the inspector it stacks over (census pass 2: Vault/Endowment
  inspector = `community`, accent `206 94 18`).
- In scope per decision 11: `views/Hub/components/CookieJarDepositModal.tsx:111` +
  `CookieJarWithdrawModal.tsx:101` → `tone="hub"` to match their sibling
  `CookieJarManageModal.tsx:114` — conditional on the mounting-surface check confirming they
  mount solely in Hub surfaces (if not, thread tone like the vault pair instead).
- Update the modal stories if they assert tone; `AdminDialogStandard.guard` test must stay green.

**F4 — occluded-close ghost overlay (`sensitive`, S–M, timeboxed):**
Mechanism verified: exit animations (`adminDialogModalOut`/`adminDialogSheetOut`/`scrimFadeOut`,
`admin-m3-overrides.css:232–314`) run on `[data-state="closed"]`; Radix Presence waits for
`animationend`; hidden tabs defer animation events → exit node + Radix's `body{pointer-events:
none}` linger until the tab re-renders. Self-heals on tab return (LOW for users) but poisons
hidden-tab QA evidence (it contaminated the census itself) and may explain residual
"click-lockup" reports (`1800e6f5` A4 fixed only the navigation-unmount variant).
- **Fix (decision 2):** instant exit when hidden. In `AdminDialog.tsx` (close path around the
  `Dialog.Content`/`Dialog.Overlay`, ~line 185): when `document.visibilityState === "hidden"` at
  the moment `open` flips false, set a `data-instant-exit` attribute; CSS:
  `[data-instant-exit][data-state="closed"] { animation: none !important; }` for surface + scrim.
  Radix unmounts synchronously when no exit animation is active — no Presence timeout hacks.
- **Belt-and-braces:** extend the `1800e6f5` A4 safety net (`CanvasLayout.tsx:253–270`) to also
  run on `visibilitychange`, clearing a stuck body lock when no `[data-state="open"]` modal
  exists.
- Unit-test the attribute toggling (jsdom can stub `visibilityState`); the real hidden-tab proof
  lands in Slice 4's QA session (drive a close in the hidden tab → node unmounts, body lock
  clears — turning the census caveat into a regression check).
- **Timebox:** if Radix Presence fights the instant-exit approach beyond a half-day, fall back to
  shipping only the A4 visibilitychange extension + documenting the mechanism in
  `dialog-census.md` — the harmful symptom (click-dead) is covered by the safety net alone.
- Any dialog-standard doc wording change (e.g. `packages/admin/AGENTS.md`) commits **separately**
  from code per the standards-vs-code rule.

**Acceptance:** tone visible correctly in-portal (Slice 4 session re-checks these rows live);
unit tests green; hidden-tab close leaves no `[data-state="closed"]` node and no body lock
(verified in Slice 4).
**Effort/risk:** S combined / low (tone) + low-medium (Radix nuance, timeboxed).

### Slice 4 — Runtime QA: census pass 3 + P3.5 state sweep (F3, RUNTIME-QA)

No branch until findings exist; QA session first, then `fix/…` branches per real bug found.
**Hard prerequisites** (from the census § methodology caveat + decision 12): a **dedicated
session with Afo at the machine** — nothing else queued — authenticated Brave with the **window
foregrounded** (kills the hidden-tab animation artifact), full local stack via `bun run dev`
(Anvil Arbitrum fork), Claude Code Chrome-extension path to the authenticated profile, census
rows banked incrementally as they complete. If authenticated Brave can't be reached, **report QA
blocked** — do not substitute an isolated browser (rule caught two live bugs last session).

**Census pass-3 rows (the ~10 leftovers):** cookie-jar Deposit/Withdraw/Manage, MintingDialog,
CreateListingDialog, ManageRoles/Members, Garden workspace settings, AppBar account
Profile/Settings/Notifications (`CanvasLayout.tsx:526`), plus re-check Slice 3's tone changes.
Checklist per row is unchanged (trigger, size/variant/tone in-portal, chrome, focus, close).

**Environment-blocked rows — resolution per class:**
- `/actions` (needs protocol-admin, decision 6): attempt a **fork-level role grant** during the
  session — Anvil allows impersonation (`anvil_impersonateAccount`); mint/assign the
  protocol-admin hat to the QA wallet via `cast` against the fork, session-scoped, no repo script
  (per scripts/ policy — if it proves durably useful, wire it as `dev:seed:*` in a follow-up with
  a `scripts/README.md` entry). If the hats tree fights back within a timebox, record the rows as
  still-blocked with the attempted commands.
- EAS-dependent rows (Work Detail / Certification / Submit Work / Create Hypercert, decision 5):
  **verify in Storybook** — stories exist for all (SubmitWork.stories, HypercertWizard,
  MintingDialog, CreateListingDialog, Hub queue stories). Record them in the census as
  "verified-in-Storybook (EAS unindexed by design)" — an honest closure the census itself
  sanctioned in pass 1 ("→ pass 2 with the right role, or Storybook isolation"). A seeded-EAS
  fork script is **explicitly deferred** (M effort, only worth it if EAS surfaces churn enough
  to need repeatable runtime QA — Afo's call).
- **P3.5 admin state sweep:** view-by-view loading/error/empty across admin views (the static
  grep heuristic was already tried and rejected as too noisy). Drive states live: fresh-fork
  empties, DevTools offline/throttle for loading+error, per-view table appended to
  `dialog-census.md` (the plan's original acceptance). Fix gaps with canonical primitives
  (`AdminLinearProgress`, `Alert`/status patterns, the P3.4 empty-state type) in follow-up
  branches, batched by workspace.

**Acceptance:** every census row green or honestly marked (Storybook-verified / still-blocked
with reason); P3.5 table exists in `dialog-census.md` with a gap list; zero rows fabricated.
**Effort/risk:** L / medium — the risk is environment stability (the classifier flapped twice
last session); mitigation is running it as its own session with nothing else queued, and
banking partial results into the census file as rows complete rather than at the end.

### Dropped / deferred (with reasons)

- **F5 — donate "you've contributed X" echo: DEFERRED (decision 1).** Verified: campaign
  cookie-jar deposits are not indexed (CookieJarFactory contributes only `JarCreated`/
  `MetadataUpdated`; the per-depositor `VaultDeposit`/`VaultEvent` entities cover garden Octant
  vaults only), and the Indexer Boundary explicitly excludes cookie jars. The three paths all
  have a flaw today: indexer entity = boundary amendment (Afo decision, not a follow-up task);
  client-side `getLogs` = no precedent in the codebase + jar-ABI event shape unverified;
  localStorage echo = same-device-only, shows a misleading zero on any other device. The Wave C
  success toast already covers the immediate feedback need. **Revisit trigger:** a donor-facing
  "my contributions" feature or an Afo decision to amend the boundary; then do it properly
  (indexed per-depositor jar deposits) rather than shipping the misleading local version.
- **F6b — stale GardenVaultView task chip: DROP (manual).** Chips don't survive app restarts and
  can't be dismissed from a later session. #606 (the underlying fix) is merged; if the chip still
  shows in Afo's UI it's a one-click manual dismiss. Nothing to plan.

## Sequencing

```
Slice 0 (CI debts)   ── unblocks trustworthy CI for everything after
   ↓
Slice 1 (storybook)  ──┐ PARALLEL sessions (decision 9): independent files
Slice 2a (admin gate)──┘ (Slice 1 = stories/MSW/design-workflow; 2a = configs + 28 admin + 8 shared
   ↓                      files); each stays in its lane, Repo Quick Gate before each merge
Slice 2b (client gate) — after 2a (reuses its shared decoded-assessment type); re-measure first
   ↓                      (a concurrent agent is mid-flight in client/shared Splash/Login surfaces)
Slice 3 (tone + hidden-close) — land BEFORE the QA session so pass 3 sees final tones
   ↓
Slice 4 (census pass 3 + P3.5) — dedicated session, Afo nearby; findings spawn per-bug branches
```

One branch + PR per slice, targeting develop; squash-merge; `gh … --repo
greenpill-dev-guild/green-goods` always (the default remote is the archived upstream). Multi-agent
repo rules apply at every step: re-baseline refs before branching, stash (never revert) unknown
diffs, no `git add -A`.

## Constraints carried from CLAUDE.md (binding on execution)

- Runtime acceptances close **only** with authenticated-Brave evidence; Storybook closure is
  valid only for the EAS-by-design rows and must be labeled as such in the census.
- i18n: none of Slices 0–3 add strings; if Slice 4 fixes introduce copy, en+es+pt mirrors + the
  4-part locale gate apply.
- Never author Tailwind utilities in `packages/shared` (relevant if P3.5 gap-fixes touch shared
  primitives — use the documented workarounds).
- Standards docs (`packages/admin/AGENTS.md`, prompt contracts) commit separately from the code
  they govern.
- Validation Intent Ladder: Slices 0–3 are QA-speed/targeted + the CI run as proof; Ship Gate
  (`bun format && bun lint && bun run test && bun build`) only at each PR's final commit.

## Execution notes (for the sessions that pick this up)

1. **Linear mirror (decision 8):** create one Product-team issue per slice (0, 1, 2a, 2b, 3, 4),
   unprojected, labels `source:plans` + the matching `package:*`; body links this plan and names
   the branch. The planning session could not do this (Linear MCP unauthenticated there); the
   first executing session with Linear access should. F5's deferral gets no issue — its revisit
   trigger lives in this plan.
2. **Baseline drift (resolved at plan-commit time):** during planning, develop advanced
   `46f97b454` → `fc69f34d2` (10 commits, client/shared-heavy: slot-stack login splash, wallet
   states, cookie-jar cards, arrival orientation, +3354/−1898 across 70 files — the in-flight
   work referenced above landed as commits). Re-confirmed at `fc69f34d2`: Admin Test still fails
   with the same `cn` mock error and Design workflow is still red, so Slices 0–1 hold unchanged.
   Consequences: (a) line numbers quoted for client/shared files may have drifted — re-locate by
   symbol, not line; (b) the Slice 2b client error re-measure is now mandatory, not precautionary.
   Standing rule regardless: branch each slice from fresh `origin/develop`, keep diffs bounded to
   the slice's listed files, re-run `git status` at every session start per Multi-Agent Repo
   Safety, and treat unknown working-tree diffs as another agent's WIP (stash, never revert).
3. Keep `progress.md`-style evidence per slice (same discipline as the wave session — status +
   evidence tables), banking evidence as rows complete. Log slice completion in a `progress.md`
   next to this plan.
