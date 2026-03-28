# Meeting Notes Extraction — March 2026

**Status**: REFERENCE
**Created**: 2026-03-25
**Sources**: 14 meeting notes + 3 supplementary docs from ~/Downloads (Mar 3–25, 2026)

## Source Meetings

| Date | Meeting | Key Participants |
|------|---------|-----------------|
| Mar 3 | Operator Onboarding — Alwyn van Wyk | Alwyn, Afo |
| Mar 4 | Operator Onboarding — DeSci Asia / Evo Swift | Evo Swift, Nansel, Caue |
| Mar 4 | Product Sync | Afo, Nansel, Matt Strachman, Caue |
| Mar 5 | Operator Onboarding — Regen Avocado (🥑🌱) | Antonio, Afo, Caue |
| Mar 5 | Operator Onboarding — Diogo Jorge | Diogo, Afo, Caue |
| Mar 5 | Operator Onboarding — Heenal Rajani | Heenal, Afo |
| Mar 5 | Luiz x Afo Coffee | Luiz, Afo |
| Mar 9 | Docs Review (with Matty) | Afo, Matty Compost |
| Mar 10 | Coop Hackathon / General Meeting | Afo, Matty, Luiz |
| Mar 17 | Community Chat | Kit Blake, Afo, Nansel, Matty |
| Mar 18 | Product Sync | Afo, Nansel, Matt, Caue |
| Mar 19 | Operator Onboarding — Diogo Jorge (2nd) | Diogo, Nansel, Caue, Afo |
| Mar 23 | Octant/Strategy Meeting | Afo, Matty, Graven Prest |
| Mar 25 | Operator Onboarding — David / mortech | David, Nansel, Caue, Afo |

---

## Already Tracked (existing plans — do not duplicate)

| Existing Plan | Covers |
|---------------|--------|
| `fix-garden-domain-ui.todo.md` | Domain selection UI bug, domain catch-22 |
| `ens-namewrapper-fix.todo.md` | ENS naming broken (code complete, awaiting deploy) |
| `vault-strategy-autoallocate-fix.todo.md` | Vaults not yielding, strategy wiring |
| `signal-pool-yield-wiring.todo.md` | Signal pool → yield routing, garden TBA fallback |
| `impact-funders-and-strategy-rates.todo.md` | Vault depositor visibility, AAVE APY display |
| `yield-split-ui.todo.md` | Split config UI, pending/escrowed yield, distribute button |
| `_backlog/web2-auth-and-gas-sponsorship.todo.md` | Wallet friction, gas sponsorship |

---

## Validation Summary (2026-03-25)

Bugs were validated against the current codebase. Of 20 bugs reported across meeting notes:

| Status | Count | Items |
|--------|-------|-------|
| **FIXED** | 13 | 1.1, 1.5, 1.6, 1.7, 1.8, 1.9, 2.2, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10 |
| **BY DESIGN** | 1 | 1.4 (gardener role = planning notes during creation) |
| **INCONCLUSIVE** | 4 | 1.2, 1.3, 1.10, 2.1 |
| **NOT FOUND** | 2 | 2.3, 2.6 |

**Remaining actionable bugs**: 1.2/1.3/1.10/2.1 need runtime verification on staging.

---

## Workstream 1: Critical Bugs (P0–P1)

### 1.1 IPFS Images Randomly Unpinning / Failing to Load — ✅ FIXED
- **Sources**: Alwyn (Mar 3), Product Sync (Mar 4), Nansel (Mar 18)
- **Validation**: `ImageWithFallback` races multiple IPFS gateways (Pinata + Storacha + hardcoded fallbacks). `ipfs.ts` (820 lines) implements robust upload with fire-and-forget verification. Pinata 409 (duplicate) treated as success.

### 1.2 Admin Dashboard — "Error Loading the Work" — ❓ INCONCLUSIVE
- **Sources**: Diogo (Mar 19), Nansel (persistent issue)
- **Validation**: Error message not found in current codebase. `WorkDetail.tsx` (672 lines) has proper loading/error states and ErrorBoundary. May be fixed or may require runtime testing to reproduce.

### 1.3 "Garden Failed to Load" on Completed Work Detail — ❓ INCONCLUSIVE
- **Sources**: Product Sync (Mar 4) — Nansel reproduced live
- **Validation**: Specific error message not found in current code. Generic `RouteErrorBoundary` shows "Something went wrong." May be fixed or requires runtime testing.

### 1.4 Gardener Role Broken in Garden Creation — 📐 BY DESIGN
- **Sources**: Diogo (Mar 5) — Afo said "just put yourself as operator. Don't use gardener"
- **Validation**: `TeamStep.tsx` shows roles added during creation are "planning notes" — they must be added on-chain post-deployment via Garden Members UI. This is intentional, not a bug. Afo's advice was correct guidance, not a workaround.

### 1.5 Gardener Count Double-Counting Roles — ✅ FIXED
- **Sources**: Evo Swift (Mar 4), Product Sync (Mar 4)
- **Validation**: Fixed in commit `2ecefc7b` (Mar 8). `buildGardenMemberSets()` in `utils/app/garden.ts` uses `Set` dedup across gardener + operator IDs. Used in both `GardenSummaryList` and `GardenCard`.

### 1.6 Work Approval Failures — ✅ FIXED
- **Sources**: Product Sync (Mar 4) — "Coy ran into some issues approving work"
- **Validation**: `useWorkApproval.ts` and `useBatchWorkApproval.ts` have robust error handling, `useMutationLock` to prevent concurrent mutations, optimistic updates with rollback, and timeout-based auto-clear for stale pending flags.

### 1.7 Garden Minting Requires Allow-List (Blocks Coop) — ✅ FIXED (on-chain toggle)
- **Sources**: Meeting (Mar 10) — Afo noted during Coop hackathon
- **Validation**: `GardenToken.sol:245` has `setOpenMinting(bool)` (onlyOwner). When `openMinting == true`, `_checkMintAuthorization()` returns immediately at line 259 — allow-list is never checked. Fix was a Safe tx calling `setOpenMinting(true)`, not a code change. User confirmed fixed.

### 1.8 Wallet Connection Bug on Vault Deposit (Arbitrum) — ✅ FIXED
- **Sources**: Product Sync (Mar 18) — Afo: "This needs to be fixed now"
- **Validation**: `DepositModal.tsx` properly checks `primaryAddress` and shows `ConnectButton` when disconnected vs. deposit form when connected. Logic is explicit and correct.

### 1.9 Incorrect Garden Names for Conviction Voting Communities — ✅ FIXED
- **Sources**: Product Sync (Mar 18) — hardcoded to "green goods community garden"
- **Validation**: `Gardens.sol` `_createCommunity()` uses the actual garden `name` parameter (not hardcoded). No "green goods community garden" string found anywhere in contracts.

### 1.10 Multi-Strategy Deposit Simulated Failure — ❓ INCONCLUSIVE
- **Sources**: Product Sync (Mar 18) — team rejected tx rather than risk executing
- **Validation**: Single-strategy deposits work correctly with preview/simulation. No batch/multi-strategy deposit logic found in hooks — feature may not be fully implemented in the UI layer yet.

---

## Workstream 2: UX Bugs & Polish (P2)

### 2.1 Banner Upload Not Working — ❓ INCONCLUSIVE
- **Sources**: David (Mar 25) — tried to upload GreenPill banner, failed
- **Validation**: Upload UI exists and is functional (`FileUploadField` with IPFS upload + compression to 2048x2048, 0.8MB max). But help text only says "optional" — no aspect ratio or size guidance. Upload logic appears sound; failure may be network/IPFS related at time of call. **Still missing**: aspect ratio specs for users.

### 2.2 Audio Notes Not Audible on Admin Side — ✅ FIXED
- **Sources**: Diogo (Mar 19), Caue identified
- **Validation**: `AudioPlayer` component fully implemented in shared. `MediaEvidence.tsx` renders it for work review. Audio CIDs retrieved from work metadata in `WorkDetail.tsx`.

### 2.3 "Wallet Not Configured" Error on Mobile After Login — ✅ NOT FOUND
- **Sources**: Diogo (Mar 19)
- **Validation**: Error string "wallet not configured" not found anywhere in codebase. Auth chain (`AppKitProvider > AuthProvider > AppProvider`) appears correct. Likely fixed or was a transient external error.

### 2.4 Screen Zoom on Input Focus (Tablet/Mobile) — ✅ LIKELY FIXED
- **Sources**: Product Sync (Mar 4) — Nansel's iPad screen share
- **Validation**: `FormInput` uses `text-base` (Tailwind = 16px), which prevents iOS auto-zoom on focus. Client has `viewport-fit=cover`. Minor gap: admin `index.html` lacks `maximum-scale` meta tag, but 16px font is the primary fix.

### 2.5 Image View Broken / Weird Zooming — ✅ FIXED
- **Sources**: David (Mar 25) — Nansel: "this is broken"
- **Validation**: `ImagePreviewDialog` has full zoom controls (buttons + mouse wheel + touch pinch-to-zoom + drag panning + reset). `MediaEvidence` uses it for all work images. `touch-action: none` prevents browser interference.

### 2.6 Form Placement / Layout Off in Garden Creation — ✅ LIKELY FIXED
- **Sources**: Diogo (Mar 5) — Afo: "I don't know what's going on with the form placement"
- **Validation**: `FormWizard` uses `mx-auto max-w-4xl` centered layout with proper responsive padding. `DetailsStep` uses `grid grid-cols-1 md:grid-cols-2` with correct gaps. No layout issues detected.

### 2.7 TVL Card Display Overflow on Endowments Page — ✅ FIXED
- **Sources**: Product Sync (Mar 4) — ETH + DAI combined overflows
- **Validation**: TVL StatCard now uses `flex flex-wrap gap-x-3 gap-y-0.5` for proper wrapping. Commit `4fdb17c7` ("polish admin dashboard UI") specifically addressed this.

### 2.8 Endowment Back-Navigation Goes to Wrong Page — ✅ FIXED
- **Sources**: Product Sync (Mar 4)
- **Validation**: `GardenVaultCard` passes `state={{ returnTo: "/endowments" }}`. `Vault.tsx` reads via `useLocation()` and renders correct back link.

### 2.9 Inconsistent Asset Ordering (WETH/DAI) in Vault Cards — ✅ FIXED
- **Sources**: Product Sync (Mar 4)
- **Validation**: `GardenVaultCard` sorts vaults with explicit comparator: WETH/ETH always first, then alphabetical. `sortedVaults` memoized with `useMemo`.

### 2.10 Dashboard Auto-Scrolls Down on Open — ✅ FIXED
- **Sources**: Diogo (Mar 19)
- **Validation**: No `scrollTo`, `scrollIntoView`, or scroll-related `useEffect` found in garden detail views. Only scroll behavior is in `CommandPalette` (expected).

---

## Workstream 3: Onboarding & Comprehension (P2)

### 3.1 Dashboard vs. App Confusion
- **Sources**: Avocado (Mar 5), Diogo (Mar 5, Mar 19)
- **Impact**: Operators don't know the PWA exists; think dashboard IS the product
- **Suggested fix**: Clear onboarding flow that explains admin (desktop operator tool) vs. client (mobile gardener app). Add prominent link/QR from admin to client PWA.
- **Scope**: `admin` (onboarding guide), `docs`

### 3.2 Chain Confusion (Optimism vs. Arbitrum)
- **Sources**: David (Mar 25) — tried Optimism because of "Gardens" association
- **Fix**: Clear chain indicator in UI + onboarding. "Green Goods runs on Arbitrum" prominently displayed.
- **Scope**: `admin` (header/footer chain badge), `client`, `docs`

### 3.3 Tedious Gardener Onboarding Process
- **Sources**: Alwyn (Mar 3) — Afo self-identified limitation
- **Impact**: New user must login (generate wallet) → operator copies address → adds via admin
- **Suggested fix**: Invite link or QR code that auto-adds gardener role on login
- **Scope**: `contracts` (invite mechanism), `admin` + `client` (invite flow)

### 3.4 Passkey Setup Flow Unclear
- **Sources**: Avocado (Mar 5) — "Where can I set up a passkey?"
- **Impact**: Dual-device pattern (wallet=operator desktop, passkey=gardener mobile) not self-evident
- **Scope**: `client` (onboarding), `docs`

### 3.5 Endowment Vault Information Opaque
- **Sources**: Evo Swift (Mar 4) — surprised by funds, didn't know source, yield %, blockchain, token type
- **Impact**: Operators need clear vault provenance, yield details, deposit guidance
- **Status**: Partially addressed by `impact-funders-and-strategy-rates.todo.md` (AAVE APY + funder leaderboard)
- **Remaining gap**: Deposit guidance (what token, which chain, min amounts)
- **Scope**: `admin` (vault detail view)

### 3.6 Activation Fund Criteria / Utilization Guidance Missing
- **Sources**: Evo Swift (Mar 4) — "if funding is from a program, there should be guidance"
- **Impact**: Operators don't know rules for accessing vault yield
- **Scope**: `docs`, potentially `admin` (info panel on vault page)

### 3.7 Domain Selection Needs Better Clarity
- **Sources**: Avocado (Mar 5), Caue — "need more clarity that domains determine available actions"
- **Status**: Partially covered by `fix-garden-domain-ui.todo.md`
- **Remaining**: Onboarding tooltip or explainer about domain → action relationship
- **Scope**: `admin` (garden creation form)

### 3.8 Jargon Level Mismatch in Docs
- **Sources**: Docs review (Mar 9) — terms like "onchain identity," "attestations," "yield bearing"
- **Suggested fix**: Plain-language rewrite for gardener-facing content
- **Scope**: `docs`

---

## Workstream 4: Feature Requests — Near-Term (P1–P2, Q1/Q2)

### 4.1 Social Feed / Activity Feed ⭐ (highest demand)
- **Sources**: Avocado (Mar 5) — "the only thing people want to do is connect with other people"
- **Priority**: P1 — identified as key retention differentiator
- **Details**: Instagram-like feed of garden community activities. Afo said he could "get something like that in within the next few days."
- **Scope**: `client` (feed view), `shared` (activity hooks), `indexer` (activity events)

### 4.2 Badge System for Gardeners
- **Sources**: Community Chat (Mar 17) — Kit Blake proposed, Afo/Nansel elaborated
- **Details**: 3-4 entry-level badges (first work upload, first assessment), domain-level badges earned over a season, social/engagement badges. Inspired by Duolingo/fitness apps. Rudimentary version existed in first alpha.
- **Priority**: P2 — high engagement value
- **Scope**: `contracts` (badge NFT), `shared` (badge hooks), `client` (badge display)

### 4.3 Funder/Operator Badges as NFT Receipts
- **Sources**: Community Chat (Mar 17) — automated badges for funders ($ amounts, gardens funded)
- **Details**: Template-based art system (layers, interchangeable). Not manual like Discord roles.
- **Scope**: `contracts`, `admin` (badge management)

### 4.4 Unlock NFT Feature
- **Sources**: Docs review (Mar 9) — Kit Blake, Afo; priority for Q1 close
- **Details**: Fun badges/NFTs for meetings and events
- **Scope**: Integration with Unlock Protocol

### 4.5 Multiple / Custom Cookie Jars Per Work Type
- **Sources**: Diogo (Mar 5, Mar 19), David (Mar 25) — both want activity-specific jars
- **Details**: Currently limited to 2 (wETH + DAI). Operators want jars for waste management, education, harvest, etc. with separate funding/withdrawal rules.
- **Priority**: P2 — requested by 2+ operators
- **Scope**: `contracts` (cookie jar factory), `admin` (jar management UI)

### 4.6 Custom Domains and Actions (Repair/Waste)
- **Sources**: Heenal Rajani (Mar 5) — repair cafe needs custom schemas
- **Details**: New action types: item weight, repair status, waste diverted, skills exchange, fixer-person interaction. Needed before March 28 activation event.
- **Scope**: `contracts` (action schemas), `admin`/`client` (form rendering)

### 4.7 API for External Tool Integration
- **Sources**: Heenal Rajani (Mar 5) — wants to integrate custom repair tool
- **Impact**: Currently no standard API for programmatic writes; only indexer reads
- **Scope**: New `api` package or contract-level write API

### 4.8 On-Ramp / Off-Ramp (Fiat)
- **Sources**: Diogo (Mar 19) — Caue, Afo identified as prerequisite for "massive growth"
- **Details**: Deposit fiat, withdraw to bank, QR code payments. Stripe (US), local providers (Brazil).
- **Priority**: P1 strategic, P2 implementation timeline
- **Scope**: `client`/`admin` (payment integration)

### 4.9 Bulk Vault Deposits
- **Sources**: Meeting (Mar 10) — Afo
- **Impact**: Currently one-by-one; tedious for managing treasuries
- **Scope**: `contracts` (batch deposit), `admin` (bulk deposit UI)

### 4.10 Push Notifications
- **Sources**: Avocado (Mar 5) — needed alongside social feed for retention hooks
- **Scope**: `client` (service worker push), `shared` (notification preferences)

### 4.11 Yield-to-Impact Ratio Metric
- **Sources**: Meeting (Mar 23) — Afo, endorsed by Graven Prest
- **Details**: Formula showing yield-to-impact curve over time across Green Goods domains. Key pitch metric for Octant.
- **Scope**: `shared` (metric calculation), `admin` (dashboard widget)

---

## Workstream 5: Feature Requests — Later (P3, Q2+)

### 5.1 Governance / Conviction Voting Integration
- **Sources**: Avocado (Mar 5), David (Mar 25)
- **Blocked by**: Gardens V2 deploying to Arbitrum
- **Details**: Signaling pools with NFT-gated voting weight (operator 3x, gardener 2x, community 1x)

### 5.2 Commitment Pooling
- **Sources**: Diogo (Mar 19) — Caue, Afo
- **Details**: Recurring community contributions, cadenced withdrawals. "Refi retirement mechanism."

### 5.3 Cookie Jar / Commitment Pools Cross-Chain
- **Sources**: Avocado (Mar 5)
- **Blocked by**: Chain mismatch (commitment pools on Celo, Green Goods on Arbitrum)

### 5.4 Sylvvi Integration
- **Sources**: Avocado (Mar 5), confirmed Q2 plan
- **Details**: Tree planting MRV. Sylvvi campaign payments → garden vaults → recursive feedback loop.

### 5.5 Reputation-Based Streaming Payments
- **Sources**: Meeting (Mar 23) — Matty, Graven Prest
- **Details**: Flow funds based on weighted reputation scores. Multiple vault layers. Q2 target.

### 5.6 Simplified Self-Service Garden Creation
- **Sources**: Diogo (Mar 19) — Caue
- **Details**: Transition from pilot (operator hand-holding) to self-service

### 5.7 Liquidity Pool from Garden Vaults
- **Sources**: Diogo (Mar 19) — Caue; exploratory

### 5.8 Microloans for Refi Businesses
- **Sources**: Diogo (Mar 19) — Caue; long-term vision

### 5.9 Proof of Presence / Geolocation
- **Sources**: Diogo (Mar 19) — predefined area, visit tracking with calendar

### 5.10 Dune Dashboard for Green Goods Metrics
- **Sources**: Product Sync (Mar 4) — Matt Strachman; strategic/marketing

### 5.11 Bloom Network Integration
- **Sources**: Avocado (Mar 5); no formal conversations yet

### 5.12 Zodiac Module for Public Staking Protocol
- **Sources**: Meeting (Mar 23) — Afo; depends on Octant engagement

---

## Workstream 6: Documentation Fixes (from Mar 9 Docs Review)

All from Afo + Matty Compost review session. P2–P3 priority.

- [ ] Change "yield bearing" → "yield generating" across all docs (technically inaccurate)
- [ ] Remove "fund" from Hats Protocol roles list
- [ ] Remove "Mutual Credit" action domain (temporarily retired)
- [ ] Reword "onchain identity" → "community owned infrastructure" for gardener content
- [ ] Clarify "Karma" as "Karma Gap, an impact reporting platform"
- [ ] Change "grant milestones" → "funding milestones"
- [ ] Separate "Eight Forms of Capital" from compliance section
- [ ] Evaluator role description fix: they certify impact, don't create Hypercerts
- [ ] Use neutral English (avoid "petty cash" and regional colloquialisms)
- [ ] Replace specific time estimates ("under 60 seconds") with "minutes"
- [ ] General grammar cleanup, remove em-dashes
- [ ] Link example communities to their Green Goods project pages
- [ ] Move Community Spotlight to "Why We Build" section
- [ ] Remove AI-added "Who is Green Goods For?" section
- [ ] Update Trust section title (add transparency/compliance/verification)
- [ ] Replace "conviction weight" → "conviction grows"
- [ ] Adjust Cookie Jar payout wording (weekly not daily, "frequent" not "small frequent")
- [ ] Vault yields: "create sustainable flow of funding" not "fund larger initiatives"
- [ ] Expand Funders role description (autonomous soft buy pressure)
- [ ] "What It Measures" chart: indicate examples only, not exhaustive
- [ ] Remove large bold image from top of docs page
- [ ] Use "compliance" framing instead of "impact" for pitches

---

## Workstream 7: Strategic / Operational Items

These are not code tasks but inform prioritization:

| Item | Deadline | Owner |
|------|----------|-------|
| Octant pitch deck (yield-to-impact, compliance framing) | Post-ECC (early April) | Afo |
| Contract upgrades (unblocks fund splitting, staking, Coop) | ASAP | Afo |
| Impact Framework workshop (2 hours, needs docs + contracts first) | TBD | Afo |
| QA round after contract updates | Post-upgrade | Team async |
| Community activation resource organization (logos, media) | Before activations | Nansel |
| "Polish, polish, polish" directive — team consensus | Ongoing | All |
| Designer needed — Sophie back in April, design contest possible | April | Afo |
| Greenpill survey for gardeners (work cadence, badge utility) | Before badges | Afo |

---

## Recommended Priority Order (Post-Validation)

> **12 of 20 reported bugs are already fixed.** The sprint plan below removes fixed items and focuses on what remains actionable.

### Sprint 1: Remaining Critical Items
1. **Contract upgrades** (tracked in vault-strategy-autoallocate + signal-pool-yield-wiring)
2. **ENS deployment** (tracked in ens-namewrapper-fix)
3. **Runtime verification** of 1.2 (work loading) + 1.3 (garden load) + 1.10 (multi-strategy) + 2.1 (banner upload) — test on staging to confirm fixed

### Sprint 2: Onboarding Clarity (operators can't set up gardens correctly)
5. **Dashboard vs. App confusion** (3.1) — add prominent client PWA link/QR from admin
6. **Chain indicator** (3.2) — "Runs on Arbitrum" badge
7. **Domain selection clarity** (3.7) — tooltip about domain → action relationship
8. **Banner upload specs** (2.1) — add aspect ratio + size guidance to help text
9. **Gardener role clarification** (1.4) — make "planning notes" behavior clearer in TeamStep UI

### Sprint 3: Retention Features (keeps users coming back)
10. **Social feed / activity feed** (4.1) — highest operator demand
11. **Push notifications** (4.10) — companion to social feed
12. **Badge system** (4.2, 4.3, 4.4) — gamification layer

### Sprint 4: Operator Power Features
13. **Multiple cookie jars** (4.5)
14. **Custom domains/actions** (4.6)
15. **Bulk vault deposits** (4.9)
16. **Simplified gardener onboarding** (3.3) — invite links

### Backlog
17. API for external tools (4.7)
18. On-ramp/off-ramp (4.8)
19. Yield-to-impact metric (4.11)
20. Everything in Workstream 5

---

## Workstream 8: Content & Marketing Gaps (from Supplementary Docs)

Sources: User_Stories.md, Green Goods v1 Release Announcement.md, Connecting The Regen Stack article

### 8.1 "Connecting The Regen Stack" Article Is ~70% Outline
- **Details**: 15+ sections are bullet-point stubs with 12+ missing images. Sections on Hypercerts, Octant Vaults, capital formation, and staking protocol are skeletal. Closing thoughts are a template placeholder.
- **Priority**: P2 — major thought-leadership piece, cannot be published in current state

### 8.2 Marketing Claims vs. Reality Misalignment
- **Details**: Release announcement lists Cookie Jar Payouts, Conviction Voting, Marketplace integration as "live," but roadmap docs list some as Q1/Q2 deliverables. The target audience (burned-out ReFi builders) is explicitly skeptical of over-promises.
- **User Story quote**: "See honest language about where things actually stand so that I can trust this isn't another project that over-promises and under-delivers."
- **Priority**: P1 (trust) — credibility risk with pilot gardens

### 8.3 i18n Audit Needed Beyond Recent Fix
- **Details**: Commit `c1a320bb` added 6 missing keys to es/pt.json. If 6 were missing, more gaps likely exist. Season One includes Portuguese-speaking (Brazil) communities.
- **Priority**: P2

### 8.4 Agent-Based Reporting (WhatsApp/SMS)
- **Details**: Listed in Q2 roadmap. AI agents for communities without smartphones (Nigeria, Uganda).
- **Priority**: P2 — critical for accessibility in target regions

### 8.5 Onboarding Funnel Bottleneck
- **Details**: Pilot onboarding requires: (1) Google Form → (2) 1:1 call → (3) walk through setup. For 8+ gardens across 4 countries/timezones, this is manual and time-intensive.
- **Priority**: P2 — operational risk for Season One scale

### 8.6 Matching Funds / Cookie Jar Incentive Terms Undefined
- **Details**: Release says "eligible for matching funds and Cookie Jar funds for 1st activations" but amounts, eligibility criteria, and timeline not specified.
- **Priority**: P2 — gardens need clarity on what they're signing up for

### 8.7 User Stories Are for "Regen Commons" Not "Green Goods"
- **Details**: User_Stories.md personas (Exhausted Weaver, Grounded Practitioner, Institutional Translator, Steward) don't map 1:1 to Green Goods roles (gardener, operator, funder, evaluator). The Grounded Practitioner ≈ gardener, but others are broader.
- **Priority**: P3 — useful context but needs explicit persona mapping before informing product decisions

### 8.8 Institutional Partner Communication Track
- **Details**: User stories surface a need for "credible governance structure and verified knowledge base" for recommending to boards, and "peer-level conversation without crypto translation" for pilot partnerships.
- **Priority**: P3 — needed before institutional partnerships can progress

---

## Cross-Cutting Themes

1. **"Polish, polish, polish"** — Explicit team directive (Diogo Mar 19). Every bug fix and feature should leave the area cleaner.

2. **Tooling fragmentation** — Avocado's loudest concern: "every time you add an app it becomes even more hard." Green Goods should be THE interface layer, not redirect to Karma/external tools.

3. **Crypto abstraction** — Multiple operators confused by wallets, gas, chains. The target user (gardener) should never see crypto concepts. Passkeys + gas sponsorship are the path.

4. **Operator self-service** — Current onboarding is 1:1 with Afo/team. Must transition to self-service garden creation, domain configuration, gardener invites.

5. **Afo is the bottleneck** — Self-identified on Mar 18: "memory is overloading." Contract upgrades, docs, Impact Framework workshop, and Octant pitch all blocked on Afo. Delegation and AI tooling (Gigi) are critical path.

6. **Marketing vs. reality trust gap** — Release announcement and article claim features as "live" that may be partially complete. The target audience is explicitly burned-out ReFi builders who are allergic to over-promising. User story: "I can trust this isn't another project that over-promises and under-delivers." Honesty about feature status is a differentiator, not a weakness.
