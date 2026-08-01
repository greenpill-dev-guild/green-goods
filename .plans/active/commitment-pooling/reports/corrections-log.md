# Commitment Pooling: Document A Corrections Log

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Scope**: Every repo-dependent claim in Document A ("Commitment Pooling Spec Direction", third pass) resolved against the codebase at branch `claude/loving-almeida-5126d7` (develop-parity worktree). Verdicts: **VERIFIED** (claim holds as written), **CORRECTED** (claim wrong or imprecise; actual truth stated with evidence), **UNVERIFIABLE** (cannot be resolved from repo or public sources), **SUPERSEDED** (user decision on 2026-07-03 overrode the claim; see Decision Register below).

The contract and UI/UX specs in this folder build on THIS log, not on Document A as written.

---

## 1. Hypotheses H1–H7

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| H1 | `GardenAssessment` is a registered EAS schema with a fixed field set | **VERIFIED**, with corrections to the assumed fields (§3) | UID `0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93`, registered name "Green Goods Assessment v2": `packages/contracts/deployments/42161-latest.json:44-48` |
| H2 | EAS schemas are immutable once registered; any field addition needs a new UID | **VERIFIED** | No update path in EAS SchemaRegistry (`eas.schemaRegistry` `0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB`, artifact line 10); resolvers validate exactly one `schemaUID` with a zero-bypass deployment window (`packages/contracts/src/resolvers/Work.sol:59-66`). v3 = fresh UID, decisive for the v2-vs-v3 call. |
| H3 | No `CommitmentPoolingModule` exists | **VERIFIED** | No commitment/pool/cycle contract in `packages/contracts/src/`; the only "pools" are Gardens V2 conviction signal pools (`packages/contracts/src/modules/Gardens.sol`) |
| H4 | Octant integration = OctantModule + "Granger UI" + MultistrategyVaultFactory on Arbitrum One | **CORRECTED** | OctantModule `0x70b25a2bAAA4f2Ae477bab315a87A03cfe89CEe9` and `octantFactory` `0x84bc88EdEB7d8C74683890070761bA225B65B74a` are real and on 42161 (artifact lines 36-37). **No "Granger" UI exists anywhere in `packages/admin`** (case-insensitive search: zero hits). Vault admin surface = `packages/admin/src/views/Garden/Vault.tsx` + `packages/admin/src/components/Vault/*` (PositionCard, DepositModal, WithdrawModal, GardenSupporters, ImpactFunders, VaultEventHistory). Client has read-only public `/vaults` (`packages/client/src/views/Public/Vaults.tsx`). |
| H5 | Conviction voting wired through GardensModule signal pools, read via external subgraph; confirm whether yield-conviction AND priority-signal poll both exist | **CORRECTED (richer than hypothesized)** | GardensModule (`0x9d9F913eEeBAC1142E38E5276dE7c8bc9Cf7a183`) creates **two** CVStrategy signal pools per garden: **ActionSignalPool** (priority signal) and **HypercertSignalPool** (yield conviction): `packages/contracts/src/modules/Gardens.sol:52-62,93-94`. The yield-conviction path is live end-to-end: `packages/contracts/src/resolvers/Yield.sol:652-672,740-761` reads HypercertSignalPool conviction and distributes hypercert-fraction yield proportionally; app hooks exist (`packages/shared/src/hooks/conviction/useRegisterHypercert.ts`, `useAllocateHypercertSupport.ts`, admin `Garden/SignalPool.tsx`). The **priority-signal poll has NO app implementation**: ActionSignalPool is a contract-level rail only. CV math is external (Gardens V2). |
| H6 | Community Hat created but not used as a distinct attestation gate | **VERIFIED** | Protocol-level Community/genesis hat `0x0000005c00020002...` exists (artifact line 22) and per-garden Community role exists (`IHatsModule.GardenRole`); its only live use is GreenWill genesis-badge eligibility (`rule: "Hat"`, artifact lines 110-111). No attestation gate, no app-side role surface. |
| H7 | Cookie Jar = separate contract (allowlist, Hats-gated, rate limits, Safe or 6551 giver), read via RPC, not wired to G$ | **VERIFIED with corrections** | Per-garden per-asset jars via 1Hive `cookieJarFactory` `0x294d222eDE6DF6625B43544F1C634322467528Da` + `cookieJarModule` `0x726bfbd0B7449C8f4aBfbcc2FBC5a89eB18fF157` (artifact lines 5-6). Withdrawals are **Gardener-Hat** (ERC-1155) gated (`packages/contracts/src/modules/CookieJar.sol:248-296`); defaults `maxWithdrawal = 100 ether`, `withdrawalInterval = 86_400s` (lines 108-110). The **giver is the YieldResolver** (`yieldSplitter` `0x90896C86108528abB600Da3C48a1aa054958bDeb`) via `_routeToCookieJar` (`packages/contracts/src/resolvers/Yield.sol:582-606`): not a Safe. Jar owner is the garden TBA. Assets: WETH/DAI; **zero G$/GoodDollar references in the repo**. Indexer reads `CampaignCookieJar` metadata from `CookieJarFactory` events (not full jar ops). |

## 2. §11 verification checklist

| Item | Verdict | Actual truth + evidence |
|---|---|---|
| Assessment schema UID, field list, revocability, reporting-period type | **CORRECTED** | UID above. Registered string: `string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location` (artifact line 47). Non-revocable (`AssessmentResolver.onRevoke → false`; work/approval likewise). **There is no reporting-period field**: `startDate`/`endDate` uint256 pair. The full strategy kernel (diagnosis, SMART outcomes, Cynefin phase, SDG targets, attachments) lives in IPFS behind `assessmentConfigCID` (artifact line 45). Document A's §2 "v2 field table" (diagnosis/SMART on-chain) actually described the **app-level TS type** `GardenAssessment` (`packages/shared/src/types/domain.ts:206-248`, `schemaVersion: "assessment_v2"`, `reportingPeriod: {start,end}`), not the on-chain schema. |
| Assessment-to-work reference field | **VERIFIED (absent)** | No cross-reference field in `packages/contracts/src/Schemas.sol` (direct read, all three structs); assessments and work are independent attestation types. Linkage exists only app-side: Hypercert metadata is derived FROM an assessment (`packages/shared/src/modules/data/hypercerts-metadata.ts:142-205`: timeframe from reportingPeriod, SDGs, impactScopes from smartOutcomes). |
| Where assessments are created | **CORRECTED** | **Admin only**: `packages/admin/src/views/Hub/CreateAssessment.tsx` and `packages/admin/src/views/Garden/Assessment.tsx`, orchestrated by shared `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts` (IPFS uploads → SchemaEncoder → direct `eas.attest()`; **not offline-queued**). The client PWA does not create assessments. Authorship gate: resolver allows **evaluator OR operator** (`packages/contracts/src/resolvers/Assessment.sol:86-144`), not evaluator-only. No re-assessment / baseline-vs-delta / versioning concept exists anywhere in app or contracts. |
| EAS immutability | **VERIFIED** | See H2. |
| CommitmentPoolingModule absence | **VERIFIED** | See H3. |
| Work + WorkApproval UIDs and resolver logic | **VERIFIED with corrections** | Work UID `0x43ebd37da5479df9d495a4c6514e7cb7f370e9f4166a0a58e14a3baf466078c4`; schema `uint256 actionUID,string title,string feedback,string metadata,string[] media`. WorkApproval UID `0x6f44cac380791858e86c67c75de1f10b186fb6534c00f85b596709a3cd51f381`; schema `uint256 actionUID,bytes32 workUID,bool approved,string feedback,uint8 confidence,uint8 verificationMethod,string reviewNotesCID` (artifact lines 49-56). WorkResolver validation order (doc comment `packages/contracts/src/resolvers/Work.sol:78-84`): identity = **gardener OR operator** (docs' "gardener" is incomplete), required fields, action exists, **TIMING: action start/end window enforced** (lines 117-131: the docs' "time window" claim is TRUE via the action's registry window), domain enabled for garden. WorkApprovalResolver (`packages/contracts/src/resolvers/WorkApproval.sol:96-185`): same-garden work ref, attester is operator, **no self-attestation** (lines 153-156), action active, **confidence 0–3** (docs' "0-100" is WRONG), verificationMethod 0–15 bitmask. Both non-revocable. Resolvers at `workResolver` `0x23F29AF...`, `workApprovalResolver` `0x166732eD...`, `assessmentResolver` `0x0646B09...` (artifact lines 3-4, 59-60). |
| YieldSplitter split 30/40/30 and where configured | **CORRECTED** | Actual default in `packages/contracts/src/resolvers/Yield.sol:119-129`: **CookieJar 4,865 bps / Hypercert fractions 4,865 bps / Juicebox 270 bps** (sum 10,000; `InvalidSplitRatio` guard at line ~373). The 30/40/30 on docs.greengoods.app is stale: flagged for the docs-freshness Linear issue. Indexer tracks per-event `YieldAllocation {cookieJarAmount, fractionsAmount, juiceboxAmount, totalAmount}`. |
| Hypercert minting path: work→hypercert mapping, TransferRestrictions, totalUnits, Arbitrum deployment | **VERIFIED with detail** | Path: admin `packages/admin/src/views/Hub/CreateHypercert.tsx` → shared `useMintHypercert` (`packages/shared/src/hooks/hypercerts/useMintHypercert.ts:268-297`, workflow `packages/shared/src/workflows/mintHypercert.ts`) → `HypercertsModule.createAllowlistAndRegister(garden, expectedHypercertId, totalUnits, merkleRoot, metadataUri)` (`packages/contracts/src/modules/Hypercerts.sol:139-166`) → `IHypercertMinter.createAllowlist`. The **garden ERC-6551 account is the hypercert creator/holder** (line 160 passes `garden`). Operator selects approved Work attestations at mint; UIDs recorded in indexer `Hypercert.attestationUIDs`; allowlist (addresses→fractions) validated + uploaded to IPFS + merkle-rooted app-side; app constant `TOTAL_UNITS = 100_000_000n` (`packages/shared/src/types/hypercerts.ts:74-83`, matches SDK default); `TransferRestrictions = 0` (AllowAll, `Hypercerts.sol:160` region). Mint auto-registers into HypercertSignalPool. **Arbitrum marketplace is live**: `hypercertMinter 0x822F17A9...`, `hypercertExchange 0xcE8fa095...`, `marketplaceAdapter`, `strategyHypercertFractionOffer` all deployed (artifact lines 31-39); Document A's mid-2024 "marketplace Arbitrum readiness open" is resolved. |
| OctantModule + Granger + factory address | **CORRECTED** | See H4. |
| Conviction voting both mechanisms | **CORRECTED (richer)** | See H5. |
| Community Hat created vs used | **VERIFIED** | See H6. |
| Cookie Jar interface, not wired to G$ | **VERIFIED with corrections** | See H7. |
| Greenwill/Unlock: PublicLock deployment, grantKeys, Envio stat source | **VERIFIED with detail** | `greenWill` registry `0x6e6895580b386eB3aB9efe228f79cdBe5B61F5e7` + 3 non-transferable PublicLocks (v15) live on 42161: Genesis `0x3703EfF5...`, First Work `0x7BE17077...`, First Support `0xE8096e5E...` (artifact lines 62-145). Badge rules: `Hat` (genesis ← Community/genesis hat), `WorkAttestation` (← Work schema UID), `VaultShares`. Fully indexed: `GreenWillBadgeDefinition/Grant/Ownership` entities with `holderCount`/`grantCount` + `unlockLock` ref (`packages/indexer/src/handlers/greenWill.ts:63-115`). **No app UI exists for badges/locks**: recognition surfaces are net-new. Promise badges (rate-threshold rules from Fulfilled events) = a new rule type on this existing, indexed rail. |
| Envio boundary | **VERIFIED** | `packages/indexer/config.yaml`: 10 contracts on 42161 + 11155111 (ActionRegistry, GardenToken, GardenAccount, HatsModule, OctantModule, OctantVault, YieldSplitter, HypercertMinter, GreenWill, CookieJarFactory); 21 entities. **EAS attestations are NOT indexed**: the app queries EAS directly via `packages/shared/src/modules/data/eas.ts` (assessments: lines 253-295; work/approvals similar; hypercert attestations via `hypercerts-attestations.ts`). Gardens V2 external; cookie jars: `CampaignCookieJar` metadata only. Consequence for the spec: **all commitment state and the four locked stats must be derivable from CommitmentPoolingModule events alone.** |

## 3. §2 assessment delta audit: corrected baseline

- Document A's "what v2 already covers" list conflated on-chain schema and app-level config. Corrected split: **on-chain** = title, description, configCID, domain (uint8 0–3: SOLAR/AGRO/EDU/WASTE), startDate, endDate, location. **IPFS config** (`AssessmentConfigPayload`) = diagnosis, SMART outcomes, Cynefin phase, SDG targets, attachments, capitals, metrics CID, evidence media. **App type** adds `schemaVersion: "assessment_v2"`, `selectedActionUIDs`, `reportingPeriod {start,end}` (mapped to startDate/endDate).
- The v3 conclusion **stands** (H2): cycle reference and baseline/delta anchor fields cannot be added to the deployed UID. v3 must follow the thin-schema + config-CID pattern (new on-chain fields limited to what resolvers/indexed consumers need: cycle ref + baseline UID anchor + assessment kind).
- Baseline-vs-delta, re-assessment, and versioned assessments: **absent everywhere**: net-new in v3.
- Authorship today is evaluator OR operator; per the 2026-07-03 decisions, v3 keeps that for the baseline and tightens delta/re-assessment to Evaluator Hat only, with community testimony (Community Hat) as a separate schema.
- **SUPERSEDED**: Document A's "commitment anchoring" via a commitment EAS schema. Decision #14 (2026-07-03): commitment records are **module-native** (Grassroots-Economics-shaped register), NOT EAS attestations. EAS registrations shrink to exactly two: assessment v3 + community testimony. Commitment→assessment anchoring becomes a field on the module's commitment record pointing at the assessment UID.

## 4. §6 Hypercert cut-over checklist

Covered in §2 table (minting path row). Additional facts for the cut-over spec: metadata prefill from assessment exists today (`hypercerts-metadata.ts`); claims read via indexer `HypercertClaim`; public garden dialog shows certificates. The current bundling unit is an operator-curated approved-work list at mint time: the cut-over replaces the selection source (fulfilled commitments, work nested as evidence) without touching the allowlist/merkle pipeline.

## 5. §9 Greenpill Commons

| Claim | Verdict | Evidence (gh, 2026-07-03) |
|---|---|---|
| Archived read-only May 8 2026 | **VERIFIED** | `isArchived: true`, `updatedAt: 2026-05-08T02:04:15Z` |
| Exact last-commit date | **RESOLVED**: 2024-03-28 ("updated nav links"); last push 2024-04-27 | `gh api repos/greenpill-dev-guild/greenpill-commons/commits` |
| Whether EAS writes actually happen | **RESOLVED: NO** | Code search for `eas` in the repo: **0 hits**. The `eas`/`attestations` topics are aspirational; on-chain layer is the thin Privy/wagmi/viem inheritance from the impact-stream fork. |
| Stack (Next.js/Supabase/Storybook/Tailwind/pnpm) | **VERIFIED** | Repo tree: `next.config.mjs`, `supabase/`, `.storybook/`, `tailwind.config.js`, `pnpm-lock.yaml`; primary language TypeScript |
| Code-level UX flows | **PARTIALLY UNVERIFIABLE from metadata**: description confirms "propose problems and solution onchain and upvote where action is needed"; view-level detail to be pulled from `src/` during the community-interface spec if needed | `gh repo view` description + topics (`pwa`, `voting`, `proposals`) |

Reuse boundary confirmed: UX patterns (problem/solution proposal, upvote, surface-to-decision) only; the contract-facing architecture predates the current protocol and contains no EAS integration to reuse anyway.

## 6. §1 "documented" claims spot-check

- Module system, hub-and-spoke on GardenToken, UUPS + CREATE2, optional-module try/catch degradation: **VERIFIED** (`packages/contracts/src/tokens/Garden.sol`; graceful `onGardenMinted` try/catch at lines ~423-430).
- "`uint256[37] __gap` plus a setter plus DeploymentBase wiring" per new module: **VERIFIED** (`Garden.sol:56-62` gap + slot comment; setters lines 181-227; `test/helpers/DeploymentBase.sol:341-383 _wireModules`).
- Module names: **CORRECTED to actual filenames**: `src/modules/{Hats,CookieJar,Gardens,Octant,Hypercerts,Karma,Unlock}.sol` + `ActionRegistry` + ENS (`GreenGoodsENS` artifact key). Document A's list omitted Hypercerts.sol and Unlock.sol.
- Six-role Hats tree + protocol hats: **VERIFIED** (`IHatsModule.GardenRole`: Owner/Operator/Evaluator/Gardener/Funder/Community + Admin parent; protocol genesis hat).
- "YieldAllocation records three-way split (cookie jar / hypercert fractions / juicebox)": **VERIFIED** as destinations, **CORRECTED** on percentages (§2).
- Root garden exists for protocol anchoring: `rootGarden.address 0xf401f34378384713222d1d21f63359cc4E8a858a, tokenId 1` (artifact lines 40-43): supports decision #8 (protocol pool = root garden pool).
- Offline queue: **exactly two job kinds** (`work`, `approval`) in `packages/shared/src/types/job-queue.ts:57-95` + `packages/shared/src/modules/job-queue/` (IndexedDB, XState, MAX_RETRIES=5). All commitment actions need new job kinds.
- Client PWA tabs Home/Garden/Profile, Passkey login, editorial routes incl. `/gardens/:id` GardenDialog: **VERIFIED** (`packages/client/src/components/Layout/AppBar.tsx:35-59`, `views/Login/`, `views/Public/*`).
- Admin IA: 6 workspaces (Hub, Garden, Actions, Community, Profile, Cookies) + canvas sheets; analog-capture precedent `views/Garden/SubmitWork.tsx`: **VERIFIED**. No season/cycle UI exists.

## 7. Docs-site staleness found (input to the docs-freshness Linear issue; no docs edits this session)

1. Yield split "30/40/30" vs actual 4865/4865/270 bps (architecture pages).
2. `v1-0.mdx` lists 5 action domains; implemented enum is 4 (5th "Mutual Credit and Farmer Verification" never built).
3. WorkApproval "confidence 0-100" vs actual 0–3.
4. Glossary has no Commitment/Campaign/Pool/Cycle entries (Season exists and is consistent).
5. "Granger" naming (if present in any doc) does not correspond to any code.

## 8. Decision Register supersessions applied to this log

Per the 2026-07-03 alignment session (27 decisions recorded in the approved session plan and mirrored into `plan.todo.md` in this folder):
- #14: no commitment EAS schema: module-native records (GE-shaped register). Affects §3 and every Document A mention of a "commitment schema" or "FulfillmentConfirmation resolver".
- #15/#16: voucher-shaped unit accounting in a companion non-transferable ERC-1155-style `CommitmentRegister` owned by the module (supersedes PRD-649's single-artifact V1 stance; poolId semantics unchanged).
- #17: Grassroots Economics grounding from the paper/docs only (Ruddick, "Commitment Pooling: an Economic Protocol", IJCCR; "Intro to Commitment Pools": curation/limiting/valuing grammar; seed round → exchange in/out → redemption steps). Never the AGPL Sarafu source.
- #11: prompt's "create a dedicated project" superseded by convert-in-place of "Green Goods Seasons & Campaigns" → "Green Goods Commitment Pooling".

Two-layer MVP (protocol pool + garden pools, August), counterpartyPoolId as post-MVP amendment, cycle types season/campaign, and all state machines: unchanged from the locked register and PRD-649 companions.

## 9. Funding-topology correction — 2026-07-18

The GoodDollar / House of Alignment G$ stream now lands directly in the Green Goods protocol Safe on Celo; the Dev Guild working-capital Safe is out of the Green Goods funding model entirely (user decision 2026-07-18, superseding the 2026-07-10 working-capital confirmation in decision #15 and the prior settlement-spec §2 topology). Canonical topology: HoA stream → GG protocol Safe → garden Celo Safes → members. Applied consequences: `FundingRoute` drops `WorkingCapitalToProtocol` — `ProtocolToGarden` is the only queued route, `queueFunding` simplifies to `(garden, amount)`, and HoA → protocol Safe is an upstream funding fact recorded in external treasury reporting (exactly the treatment HoA → working capital had before); `workingCapitalAccount` is removed from SettlementModule storage/initialize/configuration/events with a then-current renumber to 19 named slots + a 31-slot gap (**historical slot count superseded by register #53 and the frozen `settlement-spec.md` table: 18 named + 32 gap**; no Settlement.sol existed, verified 2026-07-18); the recovery owner formerly named "Dev Guild/working-capital recovery multisig" is renamed "Dev Guild recovery multisig" (same role, same 2-of-3 structure — its concrete Celo address must be designated independently of the retired hop before the first garden Safe deploys); D1/D8/D12, both money SVGs (+ PNG re-exports), and all derivative external materials now draw HoA → protocol directly. Not a scope change: no new route, custody, or authority is introduced; the module still queues exactly one derived Safe-to-Safe funding route, and protocol-Safe inflow moves from module funding events to a Celo balance read + external treasury reporting (the admin Operations funding view compensates). Linear mirrors (PRD-686 context, applied packs, canonical synthesis derivatives) still carry the old wording — a follow-up Linear apply pass is required.

## 9b. Open question extracted before archiving — 2026-07-18

**Can Green Goods charge gardens G$ for protocol services, given the House of Alignment circulation mandate?** Raised in the Linear "Research Pass 3" document and flagged there to a named GoodDollar governance contact. It was never resolved and never recorded anywhere else — a pre-archive confirmation pass grep-proved it appears in no spec, no other Linear document, and no docs-site page.

It matters because the corrected funding topology (§9) drops what that document called the **"return" leg**: value flows HoA → protocol Safe → garden Safes → members, with no modelled path back up to the protocol. Whether a return leg *should* exist — and whether charging for protocol services is compatible with a circulation mandate — is an open external dependency on GoodDollar, not a settled design.

Related and also unique to that document: a five-verb relay vocabulary (stream / seed / earn / reseed / return). `uiux-spec.md:369` and `wireframes.md:537` cite "Document B relay vocabulary" **by name**, but both inline the terms they actually use, so those are soft citations rather than dangling dependencies. The vocabulary itself needs no extraction — its topology is superseded by §9.

## 9c. Spec gap found during the pre-archive pass — settled-flow tagging — 2026-07-18

**We promise GoodDollar a measurement we have not specced.** The GoodDollar-facing plan commits to reporting *"how much G$ recirculates inside a garden versus leaves it… real circulation, not just transaction volume."* The Linear "Circular G$ Economies" document names the hard dependency that makes that computable: **settled flows must be tagged by type — in-pool spend versus cash-out.**

`settlement-spec.md` models disbursement state only — `Queued → Executing → Reported → Verified/Failed/Cancelled`. **It never models flow type.** Without that tag, recirculation, leak, reseed, velocity, and hoard are not derivable from anything the settlement module emits; the metric words appear in the canonical synthesis, but the formulas, one-season targets, and the five-condition healthy-season test exist only in that Linear document.

**Extraction completed 2026-07-18**: the definitions now live in `settlement-spec.md` §11, and the picture is worse than "no data source". The source document contains **no numeric target for any metric** — every target is a directional hedge ("a majority", "a meaningful, growing share", "minority and falling"). So the healthy-season test cannot be evaluated pass/fail at all until someone sets the numbers. Four of the five metrics also have a numerator or denominator living entirely on Celo, which §6 explicitly excludes from the indexer boundary; and **reseed rate is unmodeled rather than merely untagged** — its numerator needs a return leg above garden Safes, which §9b records as an open external dependency. Eight concrete build implications are listed at `settlement-spec.md` §11.

Consequence: the circulation evidence promised for the 2026-09-30 House of Alignment evaluation has **no specced data source and no thresholds**. This is a scope question, not a wording fix — resolve it before the August settlement build freezes, or the first evaluation has nothing to report but volume. The redemption-point / sink / merchant design (six ranked mechanisms) and the numeric citation base for the comparables live in the same document and should be extracted with it.

## 9d. 2026-07-01 lead-sync record — extracted 2026-07-18

*Rescued from the Linear document "Protocol Architecture and Spec Direction" (`41f5ada1`) before retirement. Almost everything else in that document is superseded — its single-protocol-seeded-pool MVP framing was deliberately overridden by the two-layer MVP. **This meeting record is the exception: historical record cannot be superseded, only lost.***

**Present** (2026-07-01): Afo, Matt Strachman, Nansel Rimsah. Sophie and others absent. The document was written 2026-07-03, two days later; the source is a Gemini transcript.

**Logged as an "Aligned" decision**, verbatim:

> The team will implement commitment pooling within Green Goods to manage work cycles and garden accountability.

Two Q3 outcomes were set: ground impact methodologies with garden operators, and build commitment pooling for seasons and campaigns. First concrete task was a garden survey capturing existing methodologies, owned by Afo.

**Why protocol-pool-first.** The load-bearing sentence:

> the core focus for the first set should be like a green goods pool of commitments that we look for gardens to fulfill

— with gardens creating and backing their own only *"after we've kind of sucked the juice out of that."*

**Flagged open in the sync, never decided**: whether commitments must be re-submitted each cycle (Afo leaned yes), and who sets a commitment's price. Neither is resolved in any current spec.

**Funding context recorded in the same session**: Q2 fundraising fell short; the team moved to a stipend / "cookie jar" model at roughly **400–600 USD per month per contributor**, with commitment pooling the one core feature exempted from stipend-only treatment. The admin dashboard was flagged as under-prioritized.

**Transcript provenance warning**: the Gemini notes render Tech and Sun (TAS) as "Tekken Sun", "task", and "TAZ". Anyone re-reading the raw transcript should expect that.

## 9e. Correction — "G$ on Arbitrum is partner-confirmed" — 2026-07-18

**This claim is not established, and it is carried in live Linear records.** Two independent extraction passes surfaced it from different source documents.

The 2026-07-02 settlement research recorded partner confirmation of G$ on Arbitrum as a **verbal signal only** — no token address, no custody arrangement, and no transfer path were captured — and required written confirmation before any funds moved. The architecture document (`41f5ada1`) states outright that the claim as carried in **PRD-649** and the **Lifecycle And Aggregator Semantics** companion is wrong.

It matters because the settled architecture depends on the opposite being true: **there is no canonical G$ on Arbitrum** (see `settlement-spec.md` §10.6 for the four chain addresses), which is precisely why settlement is split-state. A live record implying an Arbitrum G$ path is available invites exactly the design mistake the split-state decision exists to prevent.

**Action**: correct PRD-649 and the Lifecycle companion in Linear. Not yet applied — the claim lives only in Linear; a repo grep for "partner-confirmed" and "G$ on Arbitrum" returns nothing.

**Checked 2026-07-19 — `41f5ada1` is now fully drained.** Its stale-records list (GROW-6, GROW-5, GROW-8, PRD-473, PRD-649) was **already applied**, not pending: GROW-6 carries the correction dated 2026-07-03. The instruction not to open implementation issues for three unaccepted GoodDollar redistribution strategies (Aligned Commons Pool, Impact Bonus, Octant Vault Yield Routing) is preserved here — it records partner alignment that did *not* convert, which is a decision, not a proposal. The document is safe to delete.

**Verified applied 2026-07-22 (live Linear re-read).** Neither PRD-649's body nor the Lifecycle And Aggregator Semantics companion (doc `66a9e6a4-559f-462c-bfc8-3d140c1e8295`, slug `bfdd633951d6`) carries the "G$ on Arbitrum / partner-confirmed" claim — the word "Arbitrum" does not appear in either, and both state the corrected split-state model (canonical G$ on Celo; Chainlink-Functions-only Oracle-verified). PRD-649's sole comment is a PR-644 review summary. The Pool Identity + Capability Architecture companion (doc `588941f4-17b5-48ee-bcba-6072b239e4d9`) states the corrected topology outright ("HoA stream lands directly in the GG protocol Safe on Celo … WorkingCapitalToProtocol is retired … canonical G$ never leaves Celo … No separately deployed aggregator exists"). The §9e correction is therefore confirmed **already reflected** in live Linear; no write was applied. The claim's original source documents (`41f5ada1`, the 2026-07-02 settlement research) are archived/drained.

**Transport note (2026-07-23):** the live-read result above remains historical evidence that the
Arbitrum-G$ claim was removed, but its Functions/Oracle wording is no longer current.
`settlement-spec.md` and Decision Log `#46` supersede it with message-only CCIP command +
authenticated acknowledgment. This note records no Linear write.

## 10. Audit-response decisions — 2026-07-18

From the user's full visual-asset audit (three AskUserQuestion rounds): (a) **Garden Steward** is the standardized role name across every commitment-pooling surface — diagrams, wireframes, specs, briefs — with the mapping note "steward = holder of operator/owner Hats"; the app-wide rename (community glossary, docs site, i18n ×3, admin/client copy) is a recorded follow-up, so "Operator" remains correct in shipped-app contexts until that lands. (b) **Multi-action per-requirement counts**: commitments gain per-action required approved-work counts (`requiredApprovedWorkCounts[]` positional with `requiredActionUIDs[]`) — contract-spec amendment dated 2026-07-18; the single scalar count treatment is superseded. (c) **W22 batch execution + oracle console** moves to a new deployer-gated admin **Operations** workspace (same gating as Actions); admin `/community` pools mode rescopes to "your garden's pools + the protocol pool" with no cross-garden browsing. (d) **History** in pool surfaces is per-view segmented chips (Open | Confirmed | Past), not a separate stage. (e) **W6 home summary card is retired**; the WalletDrawer Commitments-tab header is the only promises summary. (f) **D13** is replaced by a role × capability matrix + prohibitions callout; **D6** splits into lifecycle-phase sub-machines. Considered and rejected: an `UPSTREAM_TO_PROTOCOL` FundingRoute member (an enum value that can never be queued is dead surface); a Home promises strip (client minimalism won).

## 11. Count-safe accounting and Architecture correction — 2026-07-22

The prior cross-commitment raw-unit model was dimensionally invalid because commitments may store unrelated exact unit labels. Corrected canonical rule: pool/cycle arithmetic uses state counts, `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the only cross-commitment percentage, and raw-unit totals exist only per commitment or within an exact-label `CommitmentUnitSummary`. Labels are hashed from exact stored UTF-8 bytes, so `hours` and `Hours` are separate summaries.

The register's raw-unit provider limit is replaced before implementation by a concurrent commitment-count cap: `setProviderOpenCommitmentCap`, `ProviderOpenCommitmentCapUpdated`, `OpenCommitmentCapExceeded`, `providerOpenCommitmentCapOf`, and `openCommitmentCountOf`. Acceptance acquires one slot regardless of `targetUnits`; fulfillment, accepted cancellation, and accepted expiry release one slot once; disputes preserve the prior slot state. Because the interfaces are NET-NEW and unimplemented, no compatibility alias or migration is allowed.

Envio adds `CommitmentUnitSummary` and `CommitmentProviderExposure`; replay is idempotent, exact-label summaries update only from canonical event deltas, and pool/cycle entities lose mixed-label unit aggregates. Hypercert indexing gains fulfilled-commitment/Need lineage while legacy Work bundles remain readable.

Architecture is made self-contained and extended without renumbering: D7c documents the fulfilled-commitment Hypercert cut-over, D13b carries exact function-level permissions, and D14 defines the five-kind offline job lifecycle including membership waiting without retry consumption. D1/D1b, D2, D4–D9, D12, and D13 were corrected for routing, provider authorship, lifecycle recovery, historical cardinality, settlement execution, and capability-versus-permission boundaries. No product code, SVG, wireframe, artifact publication, or Linear write is part of this pass.

## 12. Specification-readiness correction before implementation — 2026-07-24

Register #53 records the specification-first audit response. This is a documentation and
planning correction only. It does not authorize contract/indexer implementation, deployment,
broadcast, Safe configuration, or Linear mutation.

### 12.1 Locked repo corrections

- **AssessmentV3 is a schema name, not a resolver contract name.** The existing UUPS
  `AssessmentResolver` proxy is upgraded in place. Its current v2 `schemaUID` and behavior are
  preserved, `assessmentV3SchemaUID` is appended, the storage gap shrinks by one slot, and both
  schema versions dispatch through the same proxy. There is no `AssessmentV3Resolver`, no
  `assessmentV3Resolver` deployment-artifact key, and no second Assessment proxy. V3 cannot
  activate while the v2 UID is zero, and v2 cannot return to zero or collide after activation.
- **Community Testimony activates fail closed.** Its NET-NEW resolver has no zero-UID wildcard.
  Preparation one-way pins the deterministic exact UID while the module remains zero. Finalization
  reconciles the exact EAS record and activates the verified artifact-sourced module last. Zero
  module and module-before-UID are errors, exact UID repeats are no-ops, UID conflicts fail, and
  out-of-order module-before-record recovery state is rejected.
- **CCIP is the only settlement transport.** Active normative artifacts use message-only CCIP
  command and authenticated acknowledgment flows. Chainlink Functions and an
  `Oracle-verified` lifecycle are historical/superseded language only.
- **Provider exposure has one counter source.** `CommitmentAccepted` may establish the
  provider/commitment identity but never increments exposure. `UnitsCommitted` acquires the
  single open-commitment slot. `UnitsReleased` and `UnitsFulfilled` are the only decrement
  sources. The indexer therefore cannot double-count acceptance or terminal release.
- **Exact-label identity is byte-exact.** The indexer key is
  `viem.keccak256(viem.stringToBytes(unitLabel))`, with no trimming, case-folding, Unicode
  normalization, ABI encoding, or locale transformation. A future indexer implementation adds a
  direct pinned `viem` dependency instead of relying on a transitive package.
- **Canonical G$ settlement is exact-net and fee-aware.** The amount in a settlement command is
  the intended recipient delta. Zero-fee and bounded sender-pays fee modes are admissible;
  non-zero receiver-pays fees fail closed. Both absolute and proportional fee limits plus gross
  debit caps apply before execution. Source and recipient balance deltas are verified, the
  source cannot be a recipient, and batch recipients must be unique. ERC777/SuperToken callbacks are contained by CEI,
  reentrancy protection, bounded adapter subcalls, and a non-reverting negative acknowledgment.
- **Zodiac topology uses one Roles modifier.** Allowances are native Roles conditions keyed by
  `bytes32`; there is no separate Allowance Module. Deployment/configuration evidence records the
  allowance key, permission configuration hash, and recovery configuration hash independently.
- **Safe deployment is deterministic and version-frozen.** The plan freezes Safe v1.4.1 factory,
  singleton, fallback handler, initializer construction, and a reproducible salt nonce derived
  from source protocol chain plus garden. Existing protocol Safe state is verified, not silently
  redeployed.
- **Placement and development are explicitly dual-chain.** Arbitrum owns Green Goods protocol
  state, schemas/resolvers, pooling, register, and `SettlementModule`. Celo owns only
  `CeloSettlementExecutor` among custom Green Goods contracts; canonical G$, Safe, and Zodiac are
  external/configured dependencies. Local/fork/testnet tooling uses separate Arbitrum and Celo
  processes, chain IDs, artifacts, registry keys, RPCs, couriers, and post-deploy verification.
  A Celo target must not deploy or overwrite the historical full Green Goods stack.
- **Both net-new settlement UUPS contracts target a 50-slot feature region.**
  The expected layouts are SettlementModule's 18 feature slots + 32-slot gap and
  CeloSettlementExecutor's 14 feature slots + 36-slot gap. Generated compiler layout and real
  upgrade-preservation tests set the final gaps; prose arithmetic is never proof.

### 12.2 Current external support facts

Evidence labels below are deliberate:

| Fact | Status | Consequence |
|---|---|---|
| Celo Sepolia is the active Celo testnet (`11142220`) | **Externally verified** — [Celo Sepolia docs](https://docs.celo.org/tooling/testnets/celo-sepolia) | Replace the former “no active Celo testnet” premise. Alfajores is not the new default lane. |
| CCIP publishes Arbitrum One↔Celo Mainnet in both directions at v1.5.0, while the official Arbitrum Sepolia directory does not list Celo Sepolia | **Externally verified** — [Celo mainnet directory](https://docs.chain.link/ccip/directory/mainnet/chain/celo-mainnet), [Arbitrum One directory](https://docs.chain.link/ccip/directory/mainnet/chain/ethereum-mainnet-arbitrum-1), [Arbitrum Sepolia directory](https://docs.chain.link/ccip/directory/testnet/chain/ethereum-testnet-sepolia-arbitrum-1) | Production-route support exists but must be freshly verified at every dry-run/release gate. Endpoint-specific Sepolia rehearsals are feasible; the exact live cross-testnet lifecycle is not. A two-hop Ethereum relay is not approved implicitly. |
| Celo's current official cross-chain-messaging page lists CCIP support for Celo Mainnet, not Celo Sepolia | **Externally verified current-page scope** — [Celo cross-chain messaging](https://docs.celo.org/tooling/bridges/cross-chain-messaging) | Celo Sepolia remains useful for executor/Safe/Roles/surrogate deployment proof, but a live CCIP endpoint rehearsal is conditional on a fresh official Chainlink directory/API lane and router. Explorer activity alone is not a support contract. |
| Safe v1.4.1 base deployments include Arbitrum Sepolia and Celo Sepolia | **Externally verified** — [Safe deployments](https://github.com/safe-global/safe-deployments) | Deterministic Safe creation can be rehearsed on both testnets using verified addresses/code hashes. |
| The official EAS repository publishes Arbitrum Sepolia EAS `0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE` and SchemaRegistry `0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475` | **Externally verified** — [EAS contracts repository](https://github.com/ethereum-attestation-service/eas-contracts) | Consume the official `421614` addresses after chain-local bytecode/code-hash proof; no test EAS deployment is required. Hats remains separate. |
| The official Hats supported-chain page publishes Arbitrum One and Ethereum Sepolia but not Arbitrum Sepolia | **Externally verified current-page absence** — [Hats supported chains](https://docs.hatsprotocol.xyz/using-hats/hats-protocol-supported-chains) | Treat Hats on Arbitrum Sepolia as a test-dependency bootstrap or later official-support gate, not a current official deployment assumption. |
| Zodiac Roles implements allowances natively | **Externally verified** — [Roles allowances](https://github.com/gnosisguild/zodiac-modifier-roles/blob/main/packages/docs/content/general/allowances.mdx) | Remove the nonexistent separate `AllowanceModule` topology. |
| Zodiac SDK network metadata documents Celo mainnet but not Celo Sepolia | **Externally verified from current source** — [Zodiac SDK chains](https://github.com/gnosisguild/zodiac-modifier-roles/blob/main/packages/sdk/src/main/chains.ts) | Celo Sepolia Roles deployment/configuration needs a documented custom-chain or direct-contract path before it can be called supported. |
| Canonical G$ is on Celo and exposes fee calculation with sender-pays/receiver-pays behavior | **Externally verified** — [GoodDollar integration guide](https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token), [GoodProtocol source](https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/token/superfluid/SuperGoodDollar.sol) | Use a fee-aware test surrogate on Celo Sepolia and a Celo-mainnet fork for canonical token semantics. |
| No official canonical G$ deployment on Celo Sepolia was found in the reviewed GoodDollar sources | **Unresolved absence, not proof of nonexistence** | Treat testnet G$ as unavailable until GoodDollar supplies an official address and code-hash source. |
| Envio can index custom EVM networks over RPC and requires chain-aware IDs in multichain mode | **Externally verified** — [Envio supported networks](https://docs.envio.dev/docs/HyperIndex/supported-networks) | Add Celo only for Green Goods executor protocol events; never infer that raw Celo G$ transfers belong in the read model. |
| EntryPoint/bundler/paymaster availability on Celo Sepolia | **Externally verified with an account-version constraint** — [Pimlico supported chains](https://docs.pimlico.io/guides/supported-chains) lists Celo Sepolia `11142220` with Kernel `0.2.4`, not the production Kernel `0.3.1`; it lists Kernel `0.3.1` on Celo Mainnet. [ERC-4337 v0.7 release](https://github.com/eth-infinitism/account-abstraction/releases/tag/v0.7.0) publishes EntryPoint `0x0000000071727De22E5E9d8BAf0edAc6f37da032`. | Use the explicit Kernel `0.2.4` profile on both Arbitrum Sepolia and Celo Sepolia for non-production same-address sponsored mechanics evidence. Keep Kernel `0.3.1` for Arbitrum One/Celo Mainnet; only exact mainnet derivation/code/policy/passkey proof plus a separately authorized included Celo Mainnet canonical-G$ first-use operation can enable member delivery. |

### 12.3 Testnet feasibility verdict

Arbitrum Sepolia plus Celo Sepolia is **partially feasible and useful**, but not an exact
production-route rehearsal today:

1. verify the official chain-local EAS/SchemaRegistry code and bootstrap only a version-pinned
   test Hats dependency, then run deterministic protocol deployment and source-chain tests on
   Arbitrum Sepolia;
2. run executor, Safe base-contract, Roles, fee-surrogate, pause, and recovery tests on Celo
   Sepolia; add an acknowledgment-endpoint CCIP test only when an official live lane/router is
   published and verified;
3. exercise the complete command/ack state machine locally with two isolated chains and a
   deterministic courier;
4. exercise canonical G$ behavior on a separate Celo mainnet fork;
5. do not claim cross-testnet CCIP E2E until the official directory exposes the direct
   bidirectional lane;
6. do not claim production readiness until the currently published direct
   Arbitrum One↔Celo route is freshly verified and its live routers/peers, Safe/Zodiac/AA
   evidence, native-fee balances, and a human-authorized capped canary all pass.

The independent local deep review and correction pass is complete once the plan validator and
closure audit pass. Implementation remains paused pending convergence and live re-read of the
Linear mirror and linked source document.

## 13. Identifier re-home — settlement evidence PRD-735 → COM-11 — 2026-07-24 (Linear move recorded 2026-07-25T00:22Z)

The thin settlement-evidence lane issue moved from the Product team to the Community team at
2026-07-25T00:22Z (its state history shows the same-name Todo→Todo workflow remap a team move
produces). The identifier changed **PRD-735 → COM-11**; the title ("Settlement Evidence:
Commitment Pooling"), parent (PRD-650), project, Follow On / Hardening milestone, and 2026-09-30
due date are unchanged. Old PRD-735 URLs still redirect in the Linear app, but the identifier no
longer resolves for connector lookups.

Reconciled per the canonical historical mapping convention (plan.todo.md 2026-07-20 note,
extended 2026-07-24): active references now use COM-11 in `pilot-evidence-spec.md` (header +
§10.3), `handoffs/human-settlement-evidence.md`, `handoffs/README.md` § Linear boundary,
`plan.todo.md` (mapping note + milestone table), and `status.json`
(`settlement_evidence.linear`, `linear_issues`, governance note). Dated decision-register text
(register #47/#49) and ops-log events keep PRD-735 as history. The same pass re-pointed three
July milestone-table rows that still linked retired RESR-62 to COM-7 per the existing mapping.

Still stale after this pass: the canonical Google Doc's source entry **G13** cites PRD-735.
External prose lives only in the Google Doc, so that one-line hand edit (PRD-735 → COM-11) rides
the next publication re-read, alongside G13's dated state claims (COM-7 is now Done, PRD-650 and
PRD-686 now In Progress).

## 14. Independent readiness-audit corrections — 2026-07-24/25

The two independent audits were validated against current repo state, primary documentation, and
a read-only Arbitrum call. The accepted corrections are normative in the owning specs:

- GardenToken appends only after `openMinting`, at expected slot 213 offset 2, and retains
  `__gap[37]`; inserting into the earlier module block is storage corruption.
- The storage checker must fail closed, never create baselines during check mode, expose one Bun
  wrapper, remove its stale DeploymentRegistry entry, and commit pre-change baselines before
  resolver/token source edits.
- The live `42161` AssessmentResolver returned a zero v2 `schemaUID`; owner pinning from the
  verified v2 artifact precedes AssessmentV3. Arbitrum Sepolia rehearses current-v2
  deploy/pin/state capture before the in-place upgrade. `AssessmentV3` names the additive
  schema only; the existing `AssessmentResolver` proxy and resolver identity are upgraded in
  place.
- Official Arbitrum Sepolia EAS and SchemaRegistry addresses replace the unnecessary test-EAS
  bootstrap. Hats remains a version-pinned test dependency with chain-local code-hash proof.
- Community Testimony checks the non-zero CommitmentPoolingModule before branching on
  `commitmentId`, so bound and unbound testimony both fail closed. The frozen Commitment shape
  now includes both reserved counterparty fields.
- Register unit events carry pool, cycle, and exact label so out-of-order indexing never creates
  pool-zero or empty-label rows; cycle zero creates no cycle summary. `ModuleUpdated` creates a
  pool-less audit event with explicit normalized old/new module addresses and no accounting
  mutation.
- `permissionsConfigHash` commits immutable authority/condition-tree facts only; mutable
  transfer, batch, fee, period, spend, and allowance state remains separately evented/verified.
- Safe/Zodiac Solidity use is limited to locally hand-declared minimal interfaces; the released
  Safe deployment registry is pinned data, and any later JavaScript dependency remains an
  explicit approval. Release evidence now names the fee policy and the EntryPoint
  v0.7/bundler/paymaster owner.
- D7b now draws all seven canonical settlement entities: SettlementConfiguration,
  SettlementAccount, SettlementGardenRoute, Disbursement, SettlementBatch, SettlementMessage,
  and SettlementExecution. The diagram inventory, permission labels, stale `addExecutor`
  wording, and public-claim table columns are reconciled with the normative specs.
- Pooling testnet blocks use `421614`; `11155111` remains unchanged legacy regression.
  Envio v2.32.12 uses its unordered multichain mode, first-configuration-event metadata seeds,
  and explicit Celo Sepolia RPC configuration. Exact-label hashing uses the direct repository
  viem pin, with the install left behind the supply-chain approval gate.
- Endpoint proof is an ephemeral Arbitrum Sepolia↔Ethereum Sepolia deployment. Celo Sepolia
  separately proves executor/Safe/Roles/paused-surrogate behavior. The surrogate exposes
  pause/unpause and ERC-677 callback behavior while trace proof requires the executor to call
  only plain ERC-20 `transfer`; Alfajores may supplement token semantics but is not the current
  deployment or CCIP lane. Exact cross-testnet CCIP remains unavailable.
- EntryPoint v0.7 is the AA target. The Celo executor uses a dedicated deployment role and never
  the historical full-core `deploy:celo --update-schemas` path.
- The paired local harness extends the existing `LocalCCIPRouter` rather than creating a parallel
  mock. Post-deploy Arbitrum Sepolia verifier targets, role-aware release gates, and selector
  decimal-string migration are explicit implementation deliverables rather than presumed
  existing commands.
- The source-document and Linear observations remain point-in-time audit evidence until a later
  authorized live convergence pass. Archived Linear packs point to register #54 but remain
  historical; `linear.lastSyncedAt` is intentionally not advanced. No external write occurred
  in this correction pass.

## 15. Final documentation-review corrections — 2026-07-24

The post-correction `$review` found five remaining documentation gaps. Register #55 closes them
without changing product code or external systems:

- `CommitmentEventType` now includes `MODULE_UPDATED`; its event row has nullable pool
  relationships, `configurationKey = null`, and normalized old/new module addresses in the
  generic `previousValue`/`newValue` fields. The handler contract forbids a pool-zero sentinel,
  `transaction.from` actor inference, and any accounting mutation.
- The indexer handoff network matrix now matches the normative specs: pooling module/register
  and `SettlementModule` on `42161` + `421614`, `CeloSettlementExecutor` on `42220` +
  `11142220`, and explicit `rpc_config` for Celo Sepolia. Preservation covers all four Green
  Goods contract blocks on their applicable networks.
- D7b now contains every canonical settlement entity and their source-account, Celo-route,
  batch-member, message, and execution relationships rather than deferring three entities to
  prose.
- `SettlementConfiguration.localContract` now matches the verified-artifact seed contract.
  This pass initially treated “remote chain identity” as only `remoteChainSelector`; §16
  supersedes that narrow conclusion because canonical Celo entities also require the paired
  remote EVM chain ID.
- D9 no longer uses a Mermaid sequence-message semicolon that terminates the statement early.

The correction remains documentation-only. `linear.lastSyncedAt` is intentionally unchanged;
no Linear/source-document write, codegen, dependency install, implementation, deploy, broadcast,
or authority mutation is part of this pass.

## 16. Post-review specification corrections — 2026-07-24

The next strict `$review` found five remaining gaps. Register #56 closes them without changing
product contracts, indexer code, or external systems:

- Commitment creation rejects empty exact unit labels and zero targets. The register's
  `CommitmentClass` gains a mapped-value `AccountingState` with the only valid lifecycle
  `Registered -> Committed -> Released|Fulfilled`. Commit, release, and fulfill accept only the
  full non-zero quota/live balance in the expected state, so zero, partial, repeated,
  wrong-account, reactivation, and terminal-state calls revert before count mutation. The enum
  adds no top-level UUPS storage entry; the six named slots and 44-slot gap stay unchanged.
- The prior “register is ready” wording for partial fulfillment is removed. Partial fulfillment
  remains a separately specified post-MVP change that must define remaining-slot transitions,
  events, and indexer deltas.
- `SettlementConfiguration` and verified generated seed metadata gain `remoteEvmChainId`.
  Celo handlers use it for route/execution source identity, Garden/account composite joins, and
  command/ack message directions. No handler translates a CCIP selector into an EVM chain ID or
  substitutes the local Celo event chain.
- The standalone schema path converges on one AssessmentV3 record against the existing
  AssessmentResolver proxy and sets that deterministic UID. Section 17 supersedes this original
  wording with the complete first-registration/exact-existing reconciliation and partial-failure
  recovery contract.
- The prototype's theme toggle moves outside the tablist. Every declared tablist supports
  ArrowLeft/ArrowRight/Home/End focus and activation. User-initiated scene, screen, and
  primary-tab navigation now creates history entries with `pushState`; initial canonicalization
  alone uses `replaceState`, and deduplicated `popstate`/`hashchange` handling restores
  Back/Forward and pasted-hash navigation.

The correction remains documentation/prototype-only. `linear.lastSyncedAt` is intentionally
unchanged; no Linear/source-document write, product implementation, dependency install, codegen,
deploy, broadcast, or authority mutation is part of this pass.

## 17. Contracts/planning review corrections — 2026-07-24

The contracts-and-plan review found five in-scope specification gaps. Register #57 closes them
without changing product code or external systems:

- The existing AssessmentResolver proxy upgrades only through the canonical
  `upgrade.ts assessment-resolver` UUPS workflow. `commitment-schemas` verifies the
  already-upgraded proxy and handles additive resolver deployment/registration only; it cannot
  bypass the layout, transaction-plan, authorization, rollback, or post-upgrade gates.
- AssessmentV3 and Community Testimony registration are resumable. The script derives the EAS UID
  from exact schema bytes, resolver, and revocability, reads `getSchema(uid)`, registers only an
  empty record, reuses only an exact record, and fails closed on mismatch. This recovers a
  successful transaction whose local artifact merge failed without sending a duplicate
  registration that would revert `AlreadyExists`.
- `OpenCommitmentCapRequired(poolId)` is frozen at both the steward-facing module forwarder and
  module-only register boundary. Authorized zero-cap calls revert before event or storage
  mutation; an unauthorized register caller still fails `NotModule` first.
- D9 uses the frozen `ResultStatus.Success` enum member, and the permission table describes
  provider-slot mutations as single-shot/state-guarded with repeat calls reverting rather than
  incorrectly calling them idempotent.
- Pimlico's official supported-chains source explicitly lists Celo Sepolia `11142220`, correcting
  the review's temporary “unresolved chain support” classification. Register #58 supersedes the
  account-implementation conclusion: Celo Sepolia supports Kernel `0.2.4`, not the production
  Kernel `0.3.1`.

The prototype artifact-count change belongs to concurrent prototype work and the ARIA tab
behavior is outside this contracts/planning review scope; neither is changed by register #57.
`linear.lastSyncedAt` remains unchanged. No Linear/source-document write, product implementation,
dependency installation, codegen, deploy, broadcast, or authority mutation is part of this pass.

## 18. Final contracts/readiness corrections — 2026-07-25

Register #58 closes the five remaining planning/tooling findings:

- **AA support and workaround:** shared currently constructs Kernel `0.3.1`. Pimlico supports it
  on Arbitrum One and Celo Mainnet, so Celo Mainnet is not blocked by this provider matrix; Celo
  Sepolia supports Kernel `0.2.4` instead. The frozen workaround uses an explicit Kernel `0.2.4`
  profile on both Sepolia chains for non-production same-address sponsored mechanics evidence.
  Production remains Kernel `0.3.1` and requires exact Arbitrum One/Celo Mainnet
  derivation/code/policy/passkey proof plus a separately human-authorized included Celo Mainnet
  canonical-G$ first-use transfer before `memberDeliveryEnabled`.
- **Community Testimony finalization:** `commitment-schemas` has a named
  `--finalize-community-testimony` mode. It reads the module from the verified deployment artifact,
  accepts no module override, verifies the deployed module and preparation-pinned deterministic
  UID, reconciles the exact EAS record while the resolver remains inactive, activates the module
  last, and fails closed on conflict or out-of-order state.
- **Resolver deployment recovery:** versioned CREATE2 prediction covers both implementation and
  proxy. A retry reuses only exact implementation bytecode, ERC-1967 implementation, initializer
  lock, owner, EAS, and state, then reconstructs a missing local artifact without another
  deployment transaction. Schema UID setters use zero/set, exact/skip, conflicting-nonzero/fail.
- **Assessment upgrade transaction plan:** each chain requires an explicit `--sender` equal to the
  live proxy `owner()`; `421614` sources it from the verified v2 bootstrap artifact and `42161`
  pins the verified owner. The command contract orders pure simulation, transaction plan,
  separately authorized upgrade and post-upgrade verification, chain-connected schema
  reconciliation, module/register deployment, and artifact-sourced Community Testimony
  finalization.
- **Contract verification wrapper:** `scripts/contracts/verify-production.sh` invokes Solhint
  through `bun run solhint`, preserving the repository's Bun-only contract toolchain on a clean
  shell PATH.

## 19. Community Testimony activation hardening — 2026-07-25

The final review found one activation window in register #58's ordering: configuring the module
before pinning the schema UID would make the resolver active while its schema check still accepted
the deployment-time wildcard. This documentation correction removes that state entirely:

- `CommunityTestimonyResolver` is NET-NEW and therefore has no compatibility reason for a zero-UID
  wildcard. It always requires an exact stored schema UID.
- `setSchemaUID` rejects zero, pins once, treats an exact repeat as a no-op without an event, and
  reverts an explicit `SchemaUIDConflict(currentUID, requestedUID)` for a different non-zero UID.
- `setCommitmentModule` rejects zero and rejects activation until the UID is pinned.
- Preparation derives and pins the deterministic UID while module is zero. Finalization proves the
  pin, registers or reconciles the exact record, and activates the verified module last.
- Because EAS registration is permissionless, preparation accepts a pre-existing record only when
  its UID, schema bytes, resolver, and revocability are exact. It remains inactive while module is
  zero; a conflicting record or out-of-order state fails closed.
- Retry handling accepts only ordered states: expected UID + empty record + zero module; expected
  UID + exact record + zero module; or expected UID + exact record + exact verified module.
  Module-before-UID, module-before-record, and all conflicting values fail closed.

The acceptance matrix and plan freshness dates are also advanced to 2026-07-25. This remains a
documentation-only correction: no product code, dependency installation, codegen, deployment,
broadcast, authority mutation, Linear/source-document write, staging, commit, or push is included.

`linear.lastSyncedAt` remains unchanged. No Linear/source-document write, dependency installation,
codegen, deploy, broadcast, transaction, Safe/Zodiac authority mutation, staging, commit, push, or
other external write is part of this correction.

## 20. Recursive external-audit and local-review closure — 2026-07-25

Two independent external reports were treated as evidence and rechecked against the concurrent
worktree. Register #59 closes every confirmed local finding:

- Operational pooling attestation checks require four non-zero, pairwise-distinct schema UIDs and
  exact equality. The legacy resolver deployment-window zero bypass is not copied into
  `CommitmentPoolingModule`.
- The pooling module initializes paused. Its six dependency setters and four-UID setter are
  pause-only, reject zero/collision before mutation, and emit exact old/new configuration facts.
  Unpause revalidates the complete configuration. Register module replacement is allowed once from
  initial zero, then requires the current pooling module paused.
- Named confirmer input is capped at 32 before class registration, commitment storage, or event
  emission. Tests cover the maximum, maximum-plus-one, duplicate-heavy input, provider filtering,
  and threshold validation after filtering.
- `SettlementModule` and `CeloSettlementExecutor` initialize paused. Source dependency changes are
  pause-only and event-audited; source and executor unpause both fail closed on incomplete route,
  account, cap, period, or reserve configuration as applicable.
- Core and settlement configuration events have exact handler/entity ownership. Pool-less
  authority events use generic key/previous/new audit fields, never pool zero or
  `transaction.from`. Source settlement configuration persists protocol garden, canonical G$,
  Hats, and pooling-module trust roots.
- Community Testimony preparation now says what the permissionless registry contract permits:
  the deterministic record may be empty or already exact, but the resolver remains inactive until
  exact finalization and module activation.
- Active execution references use PRD-721–728. PRD-671–681 remain historical labels only. Decision
  register bounds and archived Linear-pack banners now extend through register #59.
- The active docs-promotion references now use PRD-727 (with PRD-680 explicitly historical), and
  the settlement shared-substrate owner is PRD-723 (with PRD-674 explicitly historical).
- The prototype player no longer treats a click `MouseEvent` as a history-replacement flag,
  hash replay returns to explorer home with `replaceState`, and main-tab arrow navigation replaces
  the current history entry instead of creating duplicate Back/Forward stops. The executable build
  asserts the actual 13 visible flows / 4 admin flows, compares visible counts against
  `prototypes-coverage.md`, and requires the theme control to be the tablist's following sibling.
- `settlement-spec.md` §11.9 now repeats the current Envio boundary: both Green Goods protocol
  contracts are indexed, while raw G$ and arbitrary token transfers remain excluded.
- `linear.lastSyncedAt` intentionally remains the last completed external write/re-read. This local
  correction does not invent a sync timestamp; an authorized convergence pass must update it only
  after Linear and the canonical source document are written and re-read.

The Google Doc House-of-Alignment receipt wording and live Linear bodies remain external
convergence work, not unresolved local specification design. Community Testimony's safer
pin/reconcile/activate ordering explicitly supersedes earlier mirror text during that pass.

The local proof gates passed on 2026-07-25: Plan Hub validated all 39 feature hubs; the prototype
artifact built to `/tmp` with 31 screens, 148 states, 251 hotspots, 14 source journeys, 156 scenes,
and zero warnings; all 20 Architecture Mermaid blocks parsed; `PLAYER_JS` parsed; JSON and diff
checks passed; formatting and lint passed; and the Bun-wrapped contract verifier passed 1,533
tests. Residual Chainlink Functions wording exists only in dated comparison prose or the two
explicitly archived, do-not-apply Linear packs, where it is retained as historical write
provenance under a CCIP supersession banner.

No product code, dependency installation, codegen, deployment, broadcast, transaction,
Safe/Zodiac authority mutation, Linear/source-document write, staging, commit, push, or other
external write is part of this correction.

## 21. Final interface, YAML, and generated-indexer toolchain closure — 2026-07-25

Register #60 closes the three remaining review findings:

- The frozen `ICommitmentPoolingModule` interface now declares
  `paused() external view returns (bool)`, matching the selector used by
  `CommitmentRegister.setModule` after initial wiring. The contracts handoff and acceptance matrix
  require interface/implementation ABI proof in addition to the replacement-path behavior tests.
- The canonical `config.yaml` additions in `contract-spec.md` and `settlement-spec.md` are valid
  YAML. The existing Plan Hub validation command now parses every fenced YAML block below
  `.plans`, reports the source file and line, and has a black-box malformed-fence regression test.
- `packages/indexer/package.json` declares an integrity-pinned package-local
  `pnpm@10.33.2` for Envio's generated ReScript workspace. Generated setup invokes it through
  Corepack, and the Docker image uses the same exact version. The root monorepo declaration remains
  `bun@1.3.14`; no lockfile or dependency version changes.

Proof passed: 42 Plan Hub black-box tests; all 39 feature hubs; all three canonical fenced YAML
blocks; package-local Corepack resolution to `10.33.2`; format, lint, indexer boundary, Codex-doc,
JSON, and diff checks; and the Bun-wrapped contract verifier with 1,533 passing tests. The
generated dependency install, codegen, and root test/build were not rerun because this correction
does not authorize a dependency installation.

No dependency installation, codegen, generated artifact, deployment, broadcast, transaction,
Safe/Zodiac authority mutation, Linear/source-document write, staging, commit, push, or other
external write is part of this correction.

## 22. Review-convergence documentation closure — 2026-07-25

This closure reconciles five downstream documentation drifts to already-frozen canonical
requirements. It adds no architecture or product decision:

- The canonical `CommitmentEvent` schema remains generic. `ModuleUpdated` sets
  `configurationKey = null` and stores normalized old/new module addresses in
  `previousValue`/`newValue`; the indexer handoff, acceptance matrix, and D7b ERD now use those
  exact fields. Every module, dependency, schema, and pause authority event is explicitly
  pool-less rather than only the register-global event.
- Human release operations now carry the complete dependency-ordered non-value sequence:
  existing `AssessmentResolver` proxy upgrade and AssessmentV3/Community Testimony schema
  preparation; paused module/register deployment and schema finalization; then existing
  `GardenToken`/`WorkApprovalResolver` proxy upgrades and reverse wiring while pooling remains
  paused; complete readiness verification; pooling unpause; and pool backfill. Each stage has
  separate authorization, owner/signer proof, receipt, artifact persistence, post-action
  verification, and rollback evidence before progression.
- `SettlementAccount.chainId` now names both configured destinations explicitly: `42220` for
  production and `11142220` for rehearsal.
- Decision-register navigation now includes existing register entry 60 everywhere; no new
  decision entry is created by this consistency correction.
- The design coverage line distinguishes the 23-asset inventory from the 20 Architecture Mermaid
  blocks. The gallery builder's 21-block total is intentionally those 20 Architecture blocks plus
  one Screens-flow block.

Closure proof: Plan Hub validates all 39 feature hubs; the visual-assets builder enforces 21
Architecture sections and 20 Architecture Mermaid blocks while producing the one additional
Screens-flow block; formatting and `git diff --check` pass. No product code, dependency
installation, codegen, deployment, broadcast, transaction, Safe/Zodiac authority mutation,
Linear/source-document write, staging, commit, or push is part of this correction.

## 23. Pooling activation-order consistency closure — 2026-07-25

The final contracts/indexer planning review found one execution-order contradiction rather than a
new architecture gap: PR chain 2 unpaused `CommitmentPoolingModule` before PR chain 3 installed the
required GardenToken and WorkApprovalResolver reverse links.

All active execution surfaces now use one sequence:

1. PR chain 1 prepares the existing AssessmentResolver upgrade and additive schemas/resolver.
2. PR chain 2 deploys/finalizes the module, register, and schemas, verifies module-side wiring, and
   leaves pooling paused.
3. PR chain 3 upgrades GardenToken and WorkApprovalResolver, establishes and verifies both reverse
   links while paused, proves every chain-2/chain-3 readiness fact, unpauses pooling, then
   registers/backfills pools and runs the operational smoke.
4. Indexer/downstream work and any separately authorized core broadcast proceed only after that
   complete contracts sequence.

This is a consistency correction to already-locked paused-first and reverse-link invariants. It
creates no new decision-register or Linear entry. Focused proof must cover Plan Hub validation,
formatting, JSON, diff integrity, and the existing contract/indexer boundary checks. No product
code, dependency installation, codegen, deployment, broadcast, transaction, authority mutation,
Linear/source-document write, staging, commit, or push is part of this correction.

## 24. Testnet component-versus-CCIP-lane closure — 2026-07-25

The final recursive contracts/indexer certification found one direct contradiction across the
canonical settlement seed, indexer handoff, acceptance matrix, status, and D7b. Those surfaces
correctly said the official directories do not publish an Arbitrum Sepolia↔Celo Sepolia CCIP
lane, but still required `421614` and `11142220` to seed a complete peer pair with exact remote
selector and EVM identity. That requirement was unexecutable without invented deployment data.

The active surfaces now make the boundary explicit:

- `42161`↔`42220` is the only required complete production peer pair, subject to the existing
  fresh official-directory/router/code-hash proof.
- `421614` and `11142220` preserve independent paused component blocks and local configuration
  facts. Their `remoteEvmChainId` is null, `peerConfigured` is false, and relationship-bearing
  handlers fail closed unless an exact official lane/router is freshly published.
- An explicitly labeled local/mock peer event may remain observable but is not official lane
  evidence and cannot make the component route-ready.
- The ephemeral Arbitrum Sepolia↔Ethereum Sepolia endpoint proof remains runtime-only and never
  enters canonical deployment or indexer seed artifacts.
- D7b renders peer selector/address/EVM identity as nullable pre-lane facts, matching the
  canonical GraphQL and replay contract.

This is a consistency correction to the already-locked “do not invent an unpublished lane”
boundary. It creates no new decision-register or Linear entry and changes no product code. No
dependency installation, codegen, deployment, broadcast, transaction, authority mutation,
Linear/source-document write, staging, commit, or push is part of this correction.

## 25. Architecture visual coherency pass — 2026-07-25

The 12 hand-drawn story SVGs were already reviewed and are unchanged. This pass covers the
Architecture tab, which is generated wholly from `diagrams.md`, plus the gallery builder.

**Alignment.** Four diagrams drew a caller the permission table forbids, and in every case D13b was
correct and the sequence/state diagram was the outlier: D9 attributed `queueFunding` to a garden
steward (protocol steward or module owner only) and `retryAcknowledgment` to a steward (it is
permissionless); D11 attributed `expireCommitment` to the steward (permissionless) and dropped the
mandatory `reasonCID` from the cancel call; D6a allowed only the creator to cancel before acceptance
(creator or steward). D6.0 made `Ended` terminal while the spec and D6c both allow `raiseDispute`
from `Expired`, breaking D6's own stated guarantee that the acts never disagree with the overview.
D9 emitted `AcknowledgmentDeferred` on delivery delay, which is not one of the four bounded
`AcknowledgmentDeferralCode` values. D13b gained seven missing sensitive rows — settlement-account
registration, recovery update, member-delivery gate, dispatcher, fee floor, Celo acknowledgment
fees, and both resolver-config families — and now separates the four timelocked setters from the
owner-direct ones; "timelock" previously appeared zero times in the file. Five settlement events
(`SettlementCommandRetried`, `DisbursementRequeued`, `DuplicateAcknowledgmentIgnored`,
`StaleAcknowledgmentIgnored`, `AcknowledgmentSent`) and the register's indexer edges were drawn
nowhere and now are. ERD corrections: Garden-to-pool cardinality allowed no pool-less garden,
`resolutionCode` carried 4 of its 5 values, `COMMITMENT_EVENT` was missing `units`, and D7b was
missing the recovery-owner set, allowance/permissions hashes, `cancelledFromState`, the
acknowledgment pair, and `previousPeer*`.

**Status vocabulary.** The visual status contract gains a documented third treatment — solid green
stroke on paper fill — for an existing live surface carrying a planned pooling delta. D1 and D1b
previously classed the shipped client, editorial website, Admin, and Envio read model as Planned,
which contradicted the story assets labelling those same rails Built at the action level. D1 also
classed the protocol Safe as Built while D8 and D12 call its receipt evidence pending. A label
glossary fixes one name per component; `waiting_for_hat` replaces the invented
`WaitingForMembership`; D8 gains status styling and distinct arrow styles for value, message, and
ownership edges.

**Decomposition and coverage.** D2, D7, and D9 are split with decimal sub-numbers, so nothing
existing is renamed and every current D-reference stays valid. Five specified-but-undrawn surfaces
are added: D7d indexer pipeline and the `Garden.id` cut-over, D10b settlement status derivation
(five stored states to nine rendered), D11b claim-request state machine, D15 deployment and upgrade
topology, and D16 error taxonomy. Every diagram-bearing section now carries a reading guide; the
list previously skipped exactly the dense ones. The coverage matrix gained rows for D3 and D8, lost
a duplicated D7 row, and its dangling `settlement-spec.md` §3.2/§3.3 and `contract-spec.md` §6.3
anchors now resolve.

**Gallery.** The Story nav linked to a `#story-baseline` section that does not exist while the real
`story-use-cases` section had no nav entry; both are fixed and the builder now asserts nav/body
parity in both directions. `h4` sub-blocks gained anchors and nav entries, and `diagramLabel` now
agrees with `previewLabel` so sibling sub-blocks get distinct accessible names. `visual-assets.md`
documents the real two-step publish path — build, then prerender, then publish `SHAREABLE_OUT` —
because an artifact containing `<pre class="mermaid">` cannot be shared publicly.

**Proof.** Builder assertions pass at 26 Architecture sections, 32 Architecture Mermaid blocks, and
33 total. The prerender reports `render status: ready (rendered 33, failed 0)`. Three Mermaid syntax
faults introduced during the pass were found and fixed by that render gate: a `;` inside `Note` text
terminates the statement. A screen-space text-collision sweep over all 33 rendered diagrams found
and fixed colliding subgraph titles in D7d and D15, heavy edge crossing in D10b, and overlapping
edge labels in D1, D6a, and D7b; one residual minor label adjacency remains in D6a, which is legible.

**Review follow-up (same day).** A `/review` pass over the branch found three defects in the work
above, now fixed. (1) D16 stated the `CommitmentRegister` error count as 12; `contract-spec.md` §6.2
declares 13 — the number came from a subagent report and was never verified against the spec, which
is the exact defect class this pass existed to remove. (2) The reading-guide assertion was
per-section, so after the splits a sub-block could lose its guide silently while its siblings kept
theirs; it is now per diagram-bearing block, accepting either one section-level guide covering every
sub-block (D2, D6, D9) or one guide per sub-block (D7), and rejecting a diagram with neither.
(3) `plan.todo.md`'s document map still described `diagrams.md` as D1–D14 / 18 named sections. A
cross-tab anchor-uniqueness assertion was added alongside (2), since both panes share one DOM.
Each new assertion was negative-tested to prove it fires with an accurate message.

Out of boundary, reported not edited: the stale `settlement-spec.md` §3.2/§3.3 references in
`acceptance-matrix.md:78`, `prototypes.md:6`, `wireframes.md:519`, and `settlement-spec.md:1150`
itself. No product code, dependency installation, codegen, deployment, broadcast, transaction,
Safe/Zodiac authority mutation, or Linear write is part of this pass.

## 2026-07-28 — Group commitments, recognition, and garden-funded payout correction

The earlier planning model accidentally collapsed fulfillment into one provider and rendered the requirement editor as a maximum of four actions. That was too narrow for commitments completed by a team and would have made contributor recognition and payment an after-the-fact spreadsheet exercise.

The corrected model keeps one accountable lead while adding a contribution-bearing roster. Only the lead consumes the register slot; every contributor may link approved Work or evidence while the commitment is Accepted and unfrozen; Fulfilled is the additional recognition-eligibility gate. The roster and credit ledger freeze atomically on the transition to ReadyForConfirmation, and the whole team is excluded from confirmation. DomainImpact now uses repeatable action/count inputs containing only `actionUID` and `requiredCount`; stored domain and approval counters remain module-derived, and any implementation ceiling is set only after the named gas/indexer benchmark.

Hypercert and settlement semantics are now explicit. The gardener class gives each fulfilled commitment an equal budget, then shares 20% equally among eligible contributors and allocates 80% by verified contribution. There is no lead or metadata-only fallback: every Ready transition and direct Fulfilled dispute resolution requires an available recognition policy plus at least one verified contributor, while W26 blocks inconsistent legacy/indexed zero-eligible state. Evidence fulfillment loads a bounded commitment attribution index rather than scanning, evidence jobs persist their explicit credited-contributor vector, each contributor receives at most one evidence-derived recognition participation credit, and each Work UID produces at most one reviewed credit even when multiple approval attestations exist. Commitment bps remain stable while integer units are certificate-scoped; recognition remains separate from payment and does not transfer funds.

The provider garden Safe is the payout boundary. Plan creation verifies the complete recognition vector against its hash; the canonical full-reward integer allocation is rounding-equivalent without a reason, while noncanonical amount or retention edits require a reason. Explicit finalization proves retained-plus-payout conservation, creates no child, completes all-retained plans without CCIP, and makes the plan immutable. A later idempotent preparation materializes one queued child per payable frozen row. Child or batch cancellation preserves the one-plan-per-commitment pointer, while a failed child never reverses fulfillment, recognition, or successful siblings.

Propagation includes `plan.todo.md` registers #63–#68, contract and settlement specs, acceptance matrix, UI/UX spec, wireframes, diagrams D7.2/D17, the hi-fi W2b/W3/W10/W11/W21/W23/W26 states and SB-33, all implementation/QA/docs handoffs, the shared ontology sidecar and generated docs, design-research/glossary prose, the canonical Google Doc, and live Linear mirrors. The existing runtime implementation, deployment, broadcast, and value-movement gates remain unchanged.

## 2026-07-29 — Storage, evidence, and payout-child review closure

A merge-readiness review found three specification hazards in the 2026-07-28 amendment. The
Commitment Pooling prose omitted contributor mappings from its storage accounting and carried an
invalid interface-level mapping declaration; evidence readiness depended on a missing on-chain
counter and could replay the same CID; and draft payout edits implicitly assigned child IDs before
the plan became immutable. The settlement storage table also duplicated ordinal rows and omitted
its payout-plan ID counter.

The corrected storage tables now state canonical declaration order and defer final truth to the
compiler-generated storage baseline plus concrete slot/offset assertions. Commitment Pooling
accounts for 28 feature slots and a 22-slot gap after the exact Work-to-requirement binding and
one-credit-per-Work guard added in the follow-up below. Settlement accounts for 21 feature slots and a
29-slot gap, including `nextPayoutPlanId`, the three-slot `CcipRoute`, and the packed delivery
configuration slot. The existing Hats runtime comment is aligned with its generated baseline:
`gardenHats` is slot 161 and `gardensModule` is slot 162.

Evidence now has an on-chain `evidenceCount`, exact `(commitmentId, cidHash)` de-duplication, and a
non-empty, unique, measured-bounded credited-contributor list. Each active contributor's first
attribution changes `evidenceCredits` from 0 to 1; later distinct CIDs remain provenance without
increasing recognition. Eligibility additionally requires the commitment to be Fulfilled, so
recorded attribution cannot be mistaken for verified completion.

Payout-plan creation and draft edits create no disbursement. Finalization verifies and freezes the
complete vectors but also creates no disbursement. The separate
`prepareContributorPayout(planId, contributor)` action materializes exactly one immutable Queued
child from a frozen non-zero row; an exact repeat returns the same ID and emits nothing. Parent
status counts unprepared payable rows as Pending and uses stored prepared/confirmed/failed/
cancelled counters, preserving bounded status reads and the stable one-plan-per-commitment pointer.
The hi-fi adds the finalized-unprepared and prepared-queued states and validates the call sequence.

The provisional evidence-recipient and payout-contributor bounds are 32 only as transaction-safety
benchmarks. Implementation must measure 8/16/24/32 before freezing either constant; neither is a
four-person product rule or a semantic team-size ceiling.

## 2026-07-29 — Review-comment authority and completeness closure

The PR review identified a second layer of valid implementation blockers. The resolution keeps the
group model while making its transaction and authority boundaries explicit:

- `MAX_CONTRIBUTORS_PER_COMMITMENT` is the measured end-to-end vector cap, provisionally 32. It is
  enforced before add/join mutation and matches the payout-vector bound. Open contributors gain a
  pre-freeze self-leave call, but the lead and any credited contributor cannot leave or be removed.
- Work links now name one exact requirement index. The module stores index-plus-one beside the
  Work-to-commitment mapping, so repeated action UIDs remain legal without ambiguous first-match
  counting.
- Garden-claimed Requests keep the GardenAccount as counterparty/provider scope while the stored
  authenticated `requestedBy` operator becomes the accountable lead. CeloSettlement declarations
  store source zero until acceptance selects the provider garden; Settlement stores the active
  provider Safe as payer.
- CommitmentPooling exposes canonical recognition validation from frozen roster counts, verified
  credits, and immutable policy. Hypercert composition and Settlement use that recomputation; a
  caller-supplied self-consistent vector/hash is not authority. Cross-commitment remainder units go
  to ascending commitment IDs before contributor rounding.
- Only provider-garden operator/owner stewardship may create, edit, finalize, prepare, requeue, or
  cancel its payout plan. A dispatcher can execute only the frozen approved plan. Creation emits
  every initial payout row for indexer observability.
- Delivery-disabled mode still permits plan bookkeeping and an all-retained local completion.
  Zero-total payment weights are an explicit all-zero vector with a required divergence reason,
  never a division-by-zero case.

The ontology now watches `PayoutPlanStatus`, freezes rosters on entry to
ReadyForConfirmation, and includes `settlement-spec.md` in both workflow and CI-gate matching.
Claim-time team-policy choices, mixed external/Celo actions, invalid contributor confirmation
fixtures, stale queue ABI, and stale prototype counts were removed or reconciled. The generated
ontology reference and executable prototype registry validate those mirrors.

## 2026-07-29 — Recognition lifecycle and offline-attribution closure

The next review pass found fifteen valid cross-surface inconsistencies. Direct dispute resolution
could reach Fulfilled without freezing the roster, recognition could be attempted before a cycle
policy existed, repeated approval attestations could award one Work more than once, and the offline
evidence job omitted the contributors it was required to credit. The plan also promised offline
roster edits that the queue did not implement, described an impossible metadata-only attribution
repair, and carried smaller UI, fixture, rounding, copy, and coverage drift.

The binding model now requires every Ready transition and direct `Disputed -> Fulfilled`
resolution to have at least one verified eligible contributor plus either the cycle's already-opened
recognition policy or the immutable cycle-less 20/80 default. The direct dispute path freezes the
roster before its terminal event. `approvalCounted` remains decision-attestation delivery
idempotency; the later binding review supersedes the first-credit-only guard with
`workCreditActive` plus a WorkApprovalResolver-owned monotonic per-Work decision sequence so a
newer pre-freeze rejection reverses an approval and a later approval can restore it exactly once,
including when both attestations land in the same block. A
zero-eligible legacy or indexed record is a read-only blocker until governed migration or
source-data correction restores canonical on-chain credit; mint metadata cannot repair it.

Evidence jobs serialize their explicit bounded `creditedContributors` vector and reuse it unchanged
on retry. Roster changes are online-only wallet mutations, and frozen rosters expose no edit action.
DomainImpact creation serializes ordered action/count requirements but no caller-authored domain
tags; evidence-only commitment types retain optional validated tags. Settlement uses one
fractional-remainder/address order for payment weights. The admin prototype supplies an Active
payer account for payout drafts, the Settlement 103 recovery fixture uses Kwame and 100 G$, and the
executable registry now validates 281 states and 382 hotspots with no warnings.

## 2026-07-29 — Ready, credit-freeze, roster-action, and rounding closure

The latest review exposed ten valid gaps. Evidence-only commitments were using a
post-fulfillment recognition count as a pre-fulfillment Ready gate, cycle reconciliation could
strand non-terminal commitments, and evidence or a first Work approval could still mutate credit
after the recognition boundary. The prototype also omitted four roster mutations, modeled
all-retained finalization as Pending only, and sent one offline evidence action to a non-queued
target. Two Markdown table rows used unescaped union separators, the roster queue contract
contradicted itself, and a canonical integer payout could be misclassified as a steward-authored
divergence.

The binding correction uses `totalVerifiedCredits > 0` as the pre-freeze Ready/direct-Fulfilled
predicate for all paths, including evidence-only SupportService, StewardCaptured, and
SeasonCampaign commitments. Recognition still additionally requires Fulfilled. Evidence, Work
linking, and new countable approval credit are accepted only while Accepted and unfrozen; a late
approval remains observable but cannot change requirements, units, contributor credit, or
recognition. Every cycle-scoped commitment increments an O(1) `liveCommitmentCount`, its first
Fulfilled/Cancelled/Expired transition decrements once, and reconciliation or cycle cancellation
requires zero. Ready and Disputed commitments therefore remain live until terminal.

W2b now draws online add, join, remove, leave, and exact-requirement assignment states with
validated contract calls, credit/freeze restrictions, and no offline queue. W2 distinguishes an
editable pre-ready roster from the frozen recognition record. Evidence attachment lands on a
pending queued state. Payout finalization permits Pending or immediate Complete, and the canonical
floor-plus-largest-remainder full-reward allocation is rounding-equivalent without a reason even
when normalized payment bps cannot exactly equal recognition; only noncanonical amount or
retention choices require a reason. The executable registry validates 286 states and 391 hotspots
with no warnings.

## 2026-07-30 — Snapshot observability and terminal-authority closure

Thirteen of fourteen new review comments were valid. The localization comment was not: the hi-fi
tree is a standalone English planning artifact rendered to static HTML at build time and has no
runtime locale layer or catalogs. Production client implementation still remains bound to the
en/es/pt rule in its lane handoff.

The binding settlement model now persists the immutable ascending contributor order inside each
payout plan so full-vector edits and finalization are enumerable on-chain. Creation starts payment
snapshot version 1; creation and every later Draft replacement emit the complete version-tagged
row sequence followed by one summary/hash commit marker carrying expected row count, retention,
contributor total, reason, and actor. Indexers buffer by plan/version and publish atomically only
after the trailing marker matches. Batch creation rejects duplicate derived recipients before any
fee quote, storage mutation, or dispatch, and module ownership no longer grants independent
dispatch or command-retry authority.

Assessment attachment is one-time, Accepted-and-unfrozen only. Direct dispute fulfillment applies
the same `SelfConfirmation` guard to a contributor-steward before roster freeze and terminal
mutation. Evidence-only readiness uses `requirements.length == 0`, and the primary contract
handoff now applies the Garden-Request `requestedBy` lead exception consistently.

Cycle-less commitments retain the immutable protocol 20/80 contributor split for recognition and
payout defaults, but cannot enter a COMMITMENT-bundle Hypercert because no six-role
`CycleOpened` allocation exists. The composer rejects them before allowlist/metadata construction,
and client/admin surfaces label the limitation. Prototype flows now keep generic queued evidence
out of the ready timeline, hold Open-team joins in a submitted state until the indexed roster
confirms membership, and split payable-plan Pending finalization from retained-only Complete
finalization. The roster refresh itself is fail-closed: missing/stale results and fresh rosters
without the connected account stay on the submitted state, while the joined state is rendered
only when the fresh indexed roster contains that exact account.

## 2026-07-30 — Linkage, recognition rounding, and payer-activity closure

Nine additional review findings were valid. The canonical Work-link narrative still named the
retired claimant-only authority, contributors could exit while an unapproved linked Work remained,
and unlinking was not frozen with the contribution ledger. The recognition algorithm also left the
equal and verified component remainders underspecified, while the ontology described the 20/80
default as if every cycle were fixed to it.

The contributor record now carries an O(1) uncounted-linked-Work total. Link increments it; an
Accepted-and-unfrozen steward unlink or the first countable approval decrements it once; leave and
remove require the total and both credit counters to be zero. Link authority consistently resolves
to the active contributor, accountable lead, or pool steward. Equal-policy and verified-policy bps
run independent deterministic remainder passes before their row results are added, and the
ontology treats the immutable cycle policy as authoritative with 20/80 only as the protocol default
and cycle-less preset.

Settlement now rechecks the provider-garden account before every new value-authorizing payout
write: edit, finalization, first preparation, ContributorReward batching, and initial dispatch.
Read, acknowledgment, cancellation, exact-child return, and same-key retry behavior remain
separate. The admin payout draft requires a real reason for its retained amount, and the protocol
queue models protocol-Safe-to-garden-Safe value only as Funding/ProtocolToGarden created through
`queueFunding`, never as a garden-beneficiary commitment reward.

## 2026-07-30 — Effective Work decisions and complete payout controls

The follow-up findings were valid. The live WorkApproval resolver supports a newer attestation
to correct an earlier decision, but the pooling draft treated the first approval as permanent.
The bridge now forwards approvals and rejections with a resolver-assigned monotonic sequence in
actual EVM execution order. Before roster freeze, the greatest non-zero sequence activates or
reverses the exact requirement and contributor credit; missed/out-of-order hooks converge through
the same sync rule, same-block decisions remain chronological, and frozen credit stays immutable.
The storage target is 31 feature slots plus `__gap[19]`: the added
`commitmentWorkUIDs` active-link array lets every readiness/freeze path prove whole-commitment
decision freshness instead of trusting the caller's catch-up subset.

Recognition first derives its canonical 10,000-bps vector through the independent equal and
verified passes, then expands each commitment budget into integer allowlist units with a separate
largest-fractional-remainder and ascending-address tie-break pass. This conserves even a one-unit
budget without changing the recognition hash. W11 now edits and validates the actual cycle policy,
and W2b reads that selected policy rather than presenting the 20/80 protocol default as universal.

Both member and steward commitment-creation flows now choose and review the immutable contributor
policy. Member review shows every ordered requirement/count row. Draft payout plans expose a
complete-vector edit path before finalization, and every non-zero finalized contributor row remains
preparable in sequence until all three fixture children exist.

## 2026-07-30 — Final catch-up, cycle-close, and snapshot-hash closure

Catch-up now preflights each Work's greatest supplied decision sequence against the resolver's
current maximum before mutation, applies only the current decision, and evaluates Ready after the
complete batch. An omitted rejection cannot freeze stale approval credit. Current inactive credit,
not historical approval delivery, gates unlinking after a reversal.

Acceptance revalidates every resolved lead against current provider-garden membership before
register or roster mutation. `CommitmentCycle.liveCommitmentCount` is indexed from creation through
the first terminal transition and includes Offered/Requested records. Every shared Hypercert
composer entry point requires exact on-chain Reconciled state.

Payment snapshots now hash one explicit immutable ordered tuple:
chain, plan, version, retention, contributor total, and
`{ contributor, recipient, recognitionWeightBps, paymentWeightBps, amount }` rows. Child IDs and
lifecycle counters are excluded, so preparation cannot mutate the frozen hash.

## 2026-07-31 — Gallery polish round: vocabulary convergence + reference routing

Founder review of the published Visual Asset Gallery produced a fine-tooth polish
round. Decisions recorded here because they change hub-wide vocabulary, not just
the gallery:

- **Gardener is the actor noun.** Person-sense "member" was drift and is swept to
  **gardener** across diagrams.md, wireframes.md, uiux-spec.md, plan.todo.md,
  prototypes.md, and the story SVGs. Preserved senses: vocabulary-enum `members`,
  Zodiac Roles member, Hats `membership`, the **Community member** persona, and
  "member of a garden" as a membership predicate. Grassroots Economics synthesis
  assets keep GE's own "member" vocabulary. Identifiers are untouched —
  `memberDeliveryEnabled` / `setMemberDeliveryEnabled` and
  `queryKeys.settlement.memberBalance` remain spec-canonical names; renaming them
  is a contract/spec-level follow-up to decide before the August build.
- **"Batch entry"** names a disbursement row inside an immutable settlement batch
  (formerly "batch member").
- **"Accepted provider" is retired as a label.** The 2026-07-28 amendment's
  accountable-lead framing wins: the actor label is **lead provider**
  (`leadProvider`); the acceptance *step* (Open vs ApprovalGated) is unchanged.
  Self-confirmation prohibitions are worded contributor-wide, matching
  `SelfConfirmation` semantics.
- **`NeedsResolver`** replaces `CommunityNeedsResolver` (schemas/fields were
  already bare `Need`/`NeedSignal`/`NeedStatus`/`needUID`; only the unbuilt Sept
  resolver contract carried the long form). Renamed across the ontology sidecar,
  community-interface spec/diagrams/plan/handoff, and this hub; interface
  `INeedsResolverConfig`, deploy key `needsResolver`. Hub/product titles
  ("Community Needs Interface", Linear "Community Needs & Signals") are names,
  not schema naming, and stay.
- **StewardCaptured promise sources are gardener-only** (confirmed against
  contract-spec: acceptance revalidates `onBehalfOf` via the same membership
  predicate, reverting `NotEligibleContributor`); D3 copy now says gardener.
- **Gallery structure**: D13b routed to the Reference tab; D10b became a
  stored-state strip + derivation table; D16.1/D16.2 became tables (Mermaid count
  36 → 34). `.howto` reading guides are capped at the 72ch prose measure. D1's
  how-to-read now names Admin among the five surfaces. D2 preconditions,
  D5/D14/D16 state prose, and the D9 steward roles are tables/bullets. The D2.1,
  D2.2, D2.3, D6b, and D6c overflow labels were re-broken or shortened.
- **Follow-up (not this round):** `Need` has no ontology `entities` row and no
  glossary planned-entities row (only `schemas.need`) — belongs to the
  community-interface workstream (PRD-687–696). Hi-fi registry state id
  `W9@pick-member` keeps its anchor name until a registry regeneration pass.
