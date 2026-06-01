# NYC Vault Crowdfunding Plan

**Feature Slug**: `nyc-vault-crowdfunding`
**Stage**: `active`
**Status**: `ACTIVE - /vaults route locked; NYC + EVMavericks pilot fixtures; reusable skill lane locked`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-06-01T05:50:56Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Primary surface is `/vaults`. | The attached Octant brief scopes a dedicated vault crowdfunding route; the prior `/fund` framing was wrong. No `/vault` alias is planned in this cleanup. |
| 2 | `/fund` is reuse context only. | Existing Garden funding should not be redesigned; only Card Endow capability may be reused there later. |
| 3 | Wallet-last flow is required. | Contributors should browse and choose an amount before wallet connection. |
| 4 | Octant V2 Ethereum vaults are the integration target. | Green Goods Arbitrum contracts are context/proof, not Octant's deployed Ethereum infrastructure. |
| 5 | Wallet Endow and Thirdweb Card Endow are demo scope. | Card Endow is sprint-critical after custody/share/withdrawal/provider proof, not just reusable-skill work. |
| 6 | Public Donate and Card Donate are deferred. | The pilot sprint is vault endowment crowdfunding, not Donate/Card Donate. |
| 7 | Card Endow requires user-owned receiver custody. | Vault shares must belong to the user/recovered wallet, not a provider-owned account. |
| 8 | Public management/withdrawal proof belongs to the vault route. | Card Endow cannot be visible until users can see and manage owned positions from the public vault flow. |
| 9 | Contracts lane is `n/a` by default. | Existing Octant V2 vaults are targets; no new Solidity/deployment/indexer work is planned unless proven necessary. |
| 10 | Greenpill NYC and EVMavericks are the first fixture slots. | The route should demonstrate local civic-tech crowdfunding and recurring ETH-native public-goods funding from the source brief. |
| 11 | Linear is a mirror/check-in surface. | `.plans` remains execution truth; Linear keeps durable issue state and check-in visibility. |
| 12 | Reusable `octant-vault-crowdfunding` skill is the final deliverable. | The `/vaults` demo validates the pilot patterns first, but the project is not complete until Codex delivers and QA-checks the agent skill plus templates. |
| 13 | Skill v1 is an agent skill plus templates. | No runnable generator or full packaged app is required for v1; static checks and pilot/synthetic dry-run proof are required. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Dedicated public `/vaults` route exists for Greenpill NYC + EVMavericks Octant vault crowdfunding. | `ui` | Build the route scaffold, campaign list/detail states, and route-local receipt/manage states. | ⏳ |
| Users can browse campaigns without wallet connection. | `ui` | Render campaign cards and details from a manifest before wallet provider gating. | ⏳ |
| Campaigns explain project, recipient logic, funding purpose, and onchain context. | `ui`, `state_api` | Define campaign/vault manifest fields and render plain-language plus onchain metadata. | ⏳ |
| Users choose vault and amount before connecting. | `ui` | Reuse/adapt amount-first funding primitives for wallet-last confirmation. | ⏳ |
| Greenpill NYC remains the first available transaction fixture. | `ui`, `state_api` | Record known deployed vault metadata and wire transaction proof first when the manifest is complete. | ⏳ |
| EVMavericks fixture slot exists but transactions are blocked until manifest data lands. | `ui`, `state_api` | Add blocked-pending-manifest state requiring chain ID, vault, asset, recipient/routing, Protocol Guild destination context, explorer link, and campaign copy. | ⏳ |
| Wallet Endow deposits into the selected Octant V2 Ethereum vault. | `ui`, `state_api` | Wire deposit confirmation with connected wallet receiver semantics only for complete-manifest fixtures. | ⏳ |
| Thirdweb Card Endow works after proof gates. | `state_api`, `ui` | Build recovered-wallet receiver checkout, share verification, public manage/withdraw proof, and exact provider verification only for complete-manifest fixtures. | ⏳ |
| Card Endow cannot create provider-owned custody. | `state_api` | Require `receiverAddress`, verify resulting shares for that receiver, and keep Card Endow hidden until proof passes. | ⏳ |
| `/fund` is not the route being implemented. | `ui`, `state_api` | Keep Garden funding UI separate; only make reusable Card Endow capability compatible for later `/fund` adoption. | ⏳ |
| Donate and Card Donate remain deferred. | `ui`, `state_api` | Do not expose Donate/Card Donate in `/vaults` acceptance or provider-proof gating. | ✅ deferred |
| Green Goods Arbitrum contracts are not presented as Octant Ethereum infra. | `ui`, `contracts` | Keep copy/architecture and contracts lane clear; target Octant V2 Ethereum vaults. | ⏳ |
| Reusable `octant-vault-crowdfunding` skill is delivered after demo validation. | `skill` | Codex authors the canonical skill plan and templates, covering simplest runtime, pilot + synthetic fixtures, Thirdweb-first card modules, Coinbase/Stripe future adapters, optional Octant Ethereum factory/API create-vault module, and dry-run QA. | ⏳ |

## Implementation Phases

1. **Brief/scope lock + Linear sync**: correct `.plans` and Linear around the attached Octant
   crowdfunding brief, dedicated `/vaults` route, `/fund` reuse-only boundary, and deferred Donate
   scope.
2. **`/vaults` campaign route + manifest**: define the route, campaign/vault manifest shape, browse
   states, Greenpill NYC fixture data, and an EVMavericks fixture slot. EVMavericks may be blocked
   pending manifest data, but cannot be omitted. **Check in after this phase.**
3. **Wallet-last Wallet Endow path**: implement browse -> amount -> connect -> confirm -> deposit for
   complete-manifest fixtures. **Check in after this phase.**
4. **Ownership/share verification gate**: prove Wallet Endow and recovered-wallet Card Endow shares
   are owned by the user/recovered wallet and visible from the public route.
5. **Thirdweb Card Endow demo path**: implement guarded checkout/webhook/share verification with
   user-owned receiver custody and public manage/withdraw proof for complete-manifest fixtures only.
   **Check in after this phase.**
6. **Demo QA validates `/vaults`**: verify `/vaults` on desktop/mobile, wallet-last UX, Wallet
   Endow, Card Endow gates, route privacy, copy/i18n, no Donate/Card Donate, and no unrelated
   `/fund` redesign. **Check in after this phase.**
7. **Reusable skill delivery lane**: Codex authors the `octant-vault-crowdfunding` agent skill plan
   and templates for frontend-first existing-vault UI, pilot fixtures, synthetic portability fixture,
   Thirdweb-first card modules, Coinbase/Stripe future adapter boundaries, and optional Octant
   Ethereum factory/API create-vault module.
8. **Skill dry-run QA + Linear closeout**: run skill static checks and dry-run proof against
   Greenpill NYC, EVMavericks `blocked_pending_manifest`, and one synthetic complete manifest
   fixture; then update Linear skill issues with final evidence.

## Agent Orchestration

| Lane | Agent / Surface | Starts When | Output |
|---|---|---|---|
| UI | Claude Cloud / Claude Code | Phase 2 | `/vaults` route, Greenpill NYC + EVMavericks campaign UI, blocked-manifest states, wallet-last flow, receipt/manage states, i18n, browser proof prep |
| State / API | Codex | Phase 2, parallel with UI manifest work | shared manifest/receiver/provider types, EVMavericks manifest gate, Thirdweb checkout/webhook gates, targeted shared/agent tests |
| Contracts | Codex | Only if implementation proves a need | Normally `n/a`; no new Solidity/deploy/indexer work |
| QA pass 1 | Claude | After phases 2-5 are complete | visible UX/mobile/copy/i18n requirement review |
| QA pass 2 | Codex | After QA pass 1 | validation rerun, provider/share/receiver proof review, final plan status |
| Skill | Codex | After demo QA validation | `octant-vault-crowdfunding` agent skill plan, templates, fixture examples, advanced module specs, `.claude/skills` + `.agents/skills` mirror expectations, static checks, and dry-run proof |
| Linear | Linear MCP / Linear agent | Every check-in | durable issue comments/state reflecting phase gate outcomes |

## Lane Checklists

### UI (`claude/ui/nyc-vault-crowdfunding`)

- [ ] Build the dedicated `/vaults` route; do not move the primary demo to `/fund`
- [ ] Add campaign list/detail states for Greenpill NYC and EVMavericks fixture slots
- [ ] Add EVMavericks blocked-pending-manifest state until required vault metadata is supplied
- [ ] Show campaign copy, recipient/routing summary, vault metadata, and onchain context
- [ ] Support browse -> choose vault -> choose amount before wallet connection
- [ ] Connect wallet only at final confirmation
- [ ] Keep Wallet Endow visible and working only for complete-manifest fixtures
- [ ] Keep Thirdweb Card Endow hidden until state/API proof gates are satisfied
- [ ] Add receipt/confirmation and public manage/withdraw links under the vault route
- [ ] Keep Donate and Card Donate absent from `/vaults`
- [ ] Add i18n for new user-facing strings in `en`, `es`, and `pt`
- [ ] Browser-proof final `/vaults` route on desktop and mobile
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/nyc-vault-crowdfunding`)

- [ ] Define campaign/vault manifest and receiver types for existing Octant V2 Ethereum vaults
- [ ] Require EVMavericks manifest fields before any transaction enablement: chain ID, vault address, asset address/symbol/decimals, recipient/routing summary, Protocol Guild destination context, explorer link, campaign copy
- [ ] Verify exact chain/vault/token tuple semantics for complete-manifest fixtures
- [ ] Keep connected-wallet receiver semantics for Wallet Endow
- [ ] Require user-owned recovered-wallet `receiverAddress` for Card Endow
- [ ] Reject Card Endow sessions without a valid receiver
- [ ] Verify vault shares for the recovered user before Card Endow exposure
- [ ] Require exact provider/webhook tuple verification before funded/share-verified state
- [ ] Keep Card Donate proof separate from Card Endow proof
- [ ] Keep logs and telemetry redacted
- [ ] Make reusable Card Endow capability compatible with future `/fund` adoption without making
  `/fund` the current route
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/nyc-vault-crowdfunding`)

- [x] No Solidity work planned
- [x] No deployment broadcast planned
- [x] No indexer schema work planned
- [ ] If implementation proves config is needed, document it as manifest/config only before editing

### QA Pass 1 (`claude/qa-pass-1/nyc-vault-crowdfunding`)

- [ ] Review `/vaults` browse and campaign comprehension without wallet connection
- [ ] Verify wallet-last amount/confirm sequence
- [ ] Verify desktop/mobile layout and i18n
- [ ] Confirm Donate/Card Donate are absent
- [ ] Confirm `/fund` was not redesigned as the primary vault crowdfunding route
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/nyc-vault-crowdfunding`)

- [ ] Re-run targeted shared/client/agent tests selected by implementation agents
- [ ] Inspect receiver/share/provider proof gates for Card Endow
- [ ] Confirm final browser proof targets `/vaults`
- [ ] Confirm `status.json` lane state and Linear comments match the implemented proof
- [ ] Write `handoffs/codex-qa-pass-2.md`

### Skill (`codex/skill/octant-vault-crowdfunding`)

- [ ] Start only after demo QA validation has passed
- [ ] Plan the canonical `.claude/skills/octant-vault-crowdfunding/` artifact
- [ ] Record `.agents/skills` mirror expectations after `bun run skills:sync`
- [ ] Include templates for campaign context, existing vault manifest, wallet RPC assumptions, and implementation handoff
- [ ] Include Greenpill NYC as the validated pilot fixture
- [ ] Include EVMavericks as a `blocked_pending_manifest` fixture
- [ ] Include one synthetic complete manifest fixture to prove the skill is not hardcoded
- [ ] Cover simplest runtime guidance: frontend UI, standard RPC, wallet connection, manifest-driven campaign UI, wallet-last Endow flow
- [ ] Cover advanced module specs: Thirdweb first, Coinbase/Stripe future adapters, optional Octant Ethereum factory/API create-vault module
- [ ] Call out backend concerns: secrets, provider setup, webhook verification, receipt policy, custody rules, redacted logs
- [ ] Run static skill validation and pilot/synthetic dry-run QA
- [ ] Write `handoffs/codex-skill.md`

## Validation

- [ ] Targeted shared tests for campaign/vault manifest, receiver typing, and EVMavericks blocked-pending-manifest state
- [ ] Targeted shared tests for exact chain/vault/token/provider proof separation
- [ ] Targeted client tests for `/vaults` browse-without-wallet campaign states
- [ ] Targeted client tests for wallet-last amount -> connect -> confirm sequence
- [ ] Targeted client tests for Wallet Endow on complete-manifest fixtures
- [ ] Targeted client tests for Thirdweb Card Endow hidden-until-proof behavior
- [ ] Targeted client compatibility tests for future `/fund` Card Endow capability reuse where touched
- [ ] Targeted agent tests for Thirdweb checkout/webhook tuple verification, redacted logs, recovered
  owner share verification, and Card Endow rejection without `receiverAddress`
- [ ] Browser proof for final public `/vaults` demo on desktop and mobile
- [ ] `octant-vault-crowdfunding` skill static checks: `bun run check:skills` after the later skill artifact is created and mirrored
- [ ] Skill dry-run proof covers Greenpill NYC, EVMavericks `blocked_pending_manifest`, and one synthetic complete manifest fixture
- [ ] `status.json` parses
- [ ] `node scripts/harness/plan-hub.mjs linear-sync --feature nyc-vault-crowdfunding --json` returns zero warnings
- [ ] `node scripts/harness/plan-hub.mjs validate` passes or reports only known unrelated
  `sentry-stack-observability` drift
