# Codify User Journeys

Status: in-progress
Owner: docs agent (developer journey lane)
Started: 2026-04-25

## Goal

Codify the canonical Green Goods user journeys + persona-surface map under `docs/docs/builders/journeys/` so any agent picking up a feature on a journey can ship aligned to existing patterns instead of reverse-engineering them.

## Path correction (recorded — flag for user)

Mission spec said `docs/docs/developers/journeys/`. Repo uses `docs/docs/builders/`, not `developers/`. There is no `developers/` track in `sidebars.ts` (which has `communitySidebar` + `buildersSidebar`). Creating an orphan `developers/` directory would either fail `onBrokenLinks: 'throw'` on cross-refs or silently disappear from navigation.

Decision: write under `docs/docs/builders/journeys/` and add a "User Journeys" category to `buildersSidebar`. Mission's other read-first paths (`docs/docs/developers/architecture.mdx`, `entity-matrix.mdx`) are the same stale references — actual files live under `builders/`. Surfacing this so the user can correct if intent was different.

## Personas (canonical labels)

From `docs/docs/builders/specs/v1-0.mdx` § 3.1:

- **A: Gardener** — laborer; AI agent (telegram/whatsapp) + PWA Home/Submit
- **B: Operator (Steward)** — local admin; Admin Hub
- **C: Evaluator (Verifier)** — domain expert; Admin Hub Certify (no dedicated UI shipped)
- **D: Funder (Capital Provider)** — funder; Public Fund page + admin Vault/Community
- **E: Community Member (Beneficiary)** — local resident; conviction voting + signal feed

## Deliverables

- [x] Plan: `.plans/active/codify-user-journeys/plan.todo.md`
- [x] `docs/docs/builders/journeys/onboarding.mdx`
- [x] `docs/docs/builders/journeys/work-submission.mdx`
- [x] `docs/docs/builders/journeys/evaluation.mdx`
- [x] `docs/docs/builders/journeys/funding.mdx`
- [x] `docs/docs/builders/journeys/harvest.mdx`
- [x] `docs/docs/builders/journeys/persona-surfaces.mdx`
- [x] Sidebar entry in `docs/sidebars.ts` under `buildersSidebar` (User Journeys category, between Architecture and Packages)

## Per-journey doc contract

Each `.mdx` includes:

1. Frontmatter (title, slug, audience, owner, last_verified, feature_status, source_of_truth)
2. State machine (`stateDiagram-v2`)
3. Entry points (UI / agent message / automated)
4. Steps table: # | State | Persona | Surface (package + view) | Hook / Service | Side effects
5. Failure / recovery paths
6. Connection to other journeys
7. Status per step: `shipped` / `partial` / `aspirational`

## Confirmed evidence (read during research)

### Onboarding journey

- **Telegram/SMS path (Gardener)** — `packages/agent/src/handlers/start.ts`: creates user with bot-managed private key, role=gardener; `join.ts`: validates address against `blockchain.getGardenInfo`, stores `currentGarden` for the user. **Status: shipped.**
- **PWA passkey path (Gardener)** — `packages/client/src/views/Login/index.tsx` uses `useAuth`, `useInstallGuidance`; sequence is documented in `docs/docs/builders/architecture/sequence-diagrams.mdx` § Passkey onboarding. Smart account = ERC-4337, gas-sponsored first tx, credential stored in IndexedDB. **Status: shipped.**
- **Auto-join root garden** — `packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts`. **Status: shipped.**
- **Admin path (Operator)** — `packages/admin/src/views/Profile/index.tsx`, `useAuth`, `useGardens` filtered by operator role. Admin user starts via wallet, not passkey. **Status: shipped.**

### Work submission journey

- **PWA path (online)** — `packages/client/src/views/Garden/index.tsx` (4-tab wizard: Intro → Media → Details → Review). Uses `useWorkFormContext`, `useDraftAutoSave`, `useDraftResume`, `useWorkFlowStore`. Submission goes through `uploadWork()`. **Status: shipped.**
- **PWA path (offline)** — `useOffline`, `pendingCount`, `syncStatus` surfaced in Review tab. Job queue lives in `packages/shared/src/modules/job-queue/`. **Status: shipped.**
- **Telegram/SMS path** — `packages/agent/src/handlers/submit.ts`: text/voice → AI parse → confirm → `db.addPendingWork`. `packages/agent/src/handlers/approve.ts`: operator approves; bot uses gardener's bot-held key to attest work, then operator's key to attest approval. **Status: shipped.**
- **Operator approval (admin)** — `packages/admin/src/views/Hub/index.tsx`, stage `work`. `useHubWorkbenchController`, `useWorkApproval`, `useBatchWorkApproval`, `HubWorkQueue`, `useWorkApprovalActions`. **Status: shipped.**
- **EAS attestation** — Work + WorkApproval attestations live on EAS; queried via `packages/shared/src/modules/data/eas.ts` (NOT in Envio per indexer comment). **Status: shipped.**

### Evaluation journey

- **Garden-level assessment (admin)** — `packages/admin/src/views/Hub/CreateAssessment.tsx`, `useCreateAssessmentController`, `useCreateAssessmentWorkflow`, `useCreateAssessmentForm`. Uses createAssessmentMachine. EAS attestation via AssessmentResolver, which calls `HatsModule.isEvaluator(attester)`. **Status: shipped.**
- **Evaluator surface (Persona C)** — served by the existing admin Garden workspace + Hub Assess/Certify stages via role-permissioned visibility. No dedicated workspace, no public evaluator profile, no second-signature inbox. The on-chain hat check at `AssessmentResolver.onAttest()` is the authority boundary; the UI does not split drafting vs. attesting. **Status: shipped.**
- **Garden hat tree** — `evaluatorHatId` exists in contracts (`HatsModule`). Token-gated check happens onchain (AssessmentResolver → HatsModule.isEvaluator). `useEffectiveToolbarPermissions.inEvaluators` reads `garden.evaluators[]` to grant visibility; `useHasRole("evaluator")` is the in-surface gate hook. **Status: shipped.**

### Funding journey

- **Public deposit (Funder)** — `packages/client/src/views/Public/Fund.tsx`. Uses `useGardens`, `useUser`, `useAppKit`. Opens `VaultDepositDialog` or `CookieJarDepositDialog` from client `@/components/Dialogs`. Deposit-only per ADR D37 (no withdraw on public). **Status: shipped.**
- **Vault deposit (admin)** — `packages/admin/src/views/Garden/Vault.tsx`, `packages/admin/src/components/Vault/PositionCard.tsx`. Hooks: `useVaultDeposit`, `useVaultWithdraw`, `useVaultPreview`, `useVaultOperations`. Sequence diagram in `architecture/sequence-diagrams.mdx`. **Status: shipped.**
- **Cookie jar deposit/withdraw (admin)** — `packages/admin/src/views/Hub/components/CookieJarDepositModal.tsx`, `CookieJarWithdrawModal.tsx`, `CookieJarManageModal.tsx`, `CookieJarPayoutPanel.tsx`. Hooks: `useCookieJarDeposit`, `useCookieJarWithdraw`, `useCookieJarAdmin`. **Status: shipped.**
- **Hypercert binding (Funder buys hypercerts)** — `packages/shared/src/hooks/hypercerts/useCreateListing.ts`, `useBatchListForYield.ts`, `useMarketplaceApprovals.ts`. Octant Vault auto-buy flow described in spec § 3.3 — the marketplace listing primitives exist but the auto-buy bot/loop is not in the codebase. **Status: partial — listings shipped, auto-buy automation aspirational.**
- **Karma GAP report** — `Garden.gapProjectUID` field on indexer. `packages/admin/src/components/Garden/...` (rendering GAP linkage). Spec § 3.1 Persona D Definition of Success calls for "automated Karma GAP report showing yield utilization" — automation is partial; manual linkage shipped, automated reporting aspirational.

### Harvest / Season-close journey

- **Yield harvest (per garden)** — `useHarvest`, `useHarvestableYield` hooks exist in shared. **Status: shipped (mechanic), surface incomplete.** No grep hits for `useAllocateYield` or `useHarvest` in any view file inside admin/client views — the hooks exist but are not currently rendered in a UI workflow. Vault component does have `useHarvest` indirectly via `useVaultOperations`.
- **Season close / Volume publish** — Spec calls for "Season One" and "journal Volume publish." Codebase has `usePublicVolume` hook in `packages/shared/src/hooks/public/`, queried for `Volume` data. There is no admin UI to "close a season" and finalize works. The pattern of bundling assessments → minting hypercerts (admin Hub Certify stage) is the closest shipped parallel. **Status: aspirational.**
- **Hypercert mint** — `packages/shared/src/hooks/hypercerts/useMintHypercert.ts`, `useCreateHypercertWorkflow.ts`, `useHypercertDraft.ts`. Admin: `Hub/CreateHypercert.tsx`, `useCreateHypercertController.ts`. Driven from Hub Certify stage. **Status: shipped.**
- **Yield distribution (3-way split: cookie jar / fractions / juicebox)** — Indexer: `YieldAllocation` entity tracks `cookieJarAmount`, `fractionsAmount`, `juiceboxAmount`. Hooks: `useYieldAllocations`, `useSplitConfig`, `useSetConvictionStrategies`. Admin: `Community/Strategies.tsx` (split config). **Status: shipped (config); allocation execution surfaces via Community/Payouts tab.**

### Persona surface coverage findings

| Persona | Surface (today) | Gaps |
|---|---|---|
| A: Gardener | PWA Home + Garden submit + Telegram agent | none on the primary path. Audio recording shipped; SMS path documented but only Telegram is operationally live. |
| B: Operator | Admin Hub (Work/Assess/Certify/History) + Garden + Community + Actions + Profile | none material |
| C: Evaluator | Admin Garden workspace + Hub Assess/Certify, role-permissioned via `useEffectiveToolbarPermissions` + `useHasRole("evaluator")`; on-chain authority via `AssessmentResolver` → `HatsModule.isEvaluator(attester)` | none — Persona C is served by the existing surfaces, not a dedicated workspace. |
| D: Funder | Public `/fund` + Admin Garden Vault + Admin Hub Cookie Jar modals | Octant Vault auto-buy of listed hypercerts is aspirational; automated Karma GAP report is partial (manual `gapProjectUID` linkage shipped). |
| E: Community Member | Public `/gardens` + `/impact` + admin Community (Governance / Signal Pool / Strategies / Payouts) — conviction surfaces operator-facing | no public-side conviction allocation view. Conviction allocation hooks (`useAllocateHypercertSupport`, `useHypercertConviction`) exist but are not wired into a community-facing client surface; community members can browse via `/gardens` + `/impact` but cannot signal from the public PWA today. |

## Validation

- [ ] All cross-references inside the new docs resolve (Docusaurus `onBrokenLinks: 'throw'` will catch breaks at build time)
- [ ] Mermaid diagrams parse — keep `stateDiagram-v2` simple; if a journey is too complex, split
- [ ] Personas use canonical A-E labels with the human-readable name in parentheses on first use
- [ ] Status badges (`shipped` / `partial` / `aspirational`) appear in every steps table
- [ ] Sidebar entry added so journeys are reachable

## Constraints

- Don't modify source files outside `docs/` and `.plans/`
- Hands off `.claude/rules/`, `.claude/skills/`, ESLint configs (rules-executable agent owns those)
- Don't deep-link contract internals; reference contract names only

## Next steps

1. Write all six MDX files
2. Update sidebars.ts
3. Verify build (optional: `bun run build` inside `docs/` if time allows)
