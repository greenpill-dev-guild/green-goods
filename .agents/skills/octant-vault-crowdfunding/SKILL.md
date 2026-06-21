---
name: octant-vault-crowdfunding
user-invocable: false
description: Portable Octant vault crowdfunding UI builder. Use when designing or implementing a campaign UI for existing Ethereum Octant vaults, adapting the Green Goods /vaults pattern for another repo, preparing reusable vault manifests and schemas, adding wallet-last Endow flows, planning provider-adapter Card Endow modules, applying React-oriented repo-neutral module boundaries, or documenting a non-runnable create-vault operator setup path.
version: "0.1.0"
status: active
packages: ["client", "shared", "agent", "docs"]
dependencies: ["web3", "ui", "react", "testing"]
last_updated: "2026-06-16"
last_verified: "2026-06-16"
---

# Octant Vault Crowdfunding Skill

Build portable crowdfunding UIs for Octant vault campaigns. The default output is a repo-local
frontend module for existing Ethereum Octant vaults, driven by manifests and a wallet-last Endow
flow. Optional modules cover card providers and operator-only create-vault scaffolding.

---

## V1 Guarantees

- Existing-vault bootstrap first: build from deployed vault manifests before create-vault work.
- Skill plus schemas/templates: provide a manifest contract and reusable handoff assets, not a
  runnable generator or Green Goods package.
- Provider-adapter Card Endow: define exact proof boundaries, with Thirdweb as the first concrete
  reference and Coinbase/Stripe as future adapter shapes.
- React-oriented, repo-neutral guidance: use React module boundaries when helpful, but adapt to the
  target repo's router, wallet stack, design system, i18n, and validation commands.
- Non-runnable create-vault operator path: output a blocked checklist unless current Octant
  factory/API proof exists.

## Activation

When invoked:
- Treat Green Goods as an example implementation, not a required dependency.
- Default to existing deployed Octant vaults before create-vault work.
- Keep the user flow wallet-last: browse campaign, choose vault, choose amount, then connect or
  recover at final confirmation.
- Separate frontend-safe manifest data from backend/provider secrets and operator-only setup.
- Keep create-vault guidance non-runnable unless the user explicitly asks for implementation and
  supplies current Octant factory/API proof.

## Part 1: Intake

Start by collecting the minimum portable inputs:

1. Campaign context: community name, campaign goal, vault story, impact framing, CTA labels, risk
   notes, and safe source links.
2. Design context: DesignMD path, product brief, screenshots, or repo design system rules.
3. Existing vault manifest: chain ID, vault address, asset address, asset symbol/decimals, display
   name, explorer link, recipient/routing summary, campaign copy, and optional position/indexer
   support.
4. Runtime assumptions: framework, router, wallet stack, RPC source, chain switching policy, and
   validation commands.
5. Optional modules: card provider, webhook backend, receipt storage, custody policy, and
   create-vault operator requirements.

If any transaction-enabling field is missing, keep the campaign browsable and mark transaction
controls pending. Do not infer recipient logic, protocol routing, factory addresses, or yield
claims from incomplete data.

Read [references/input-schema.md](./references/input-schema.md) when defining manifest shape or
fixtures. Use
[assets/schemas/existing-vault-manifest.schema.json](./assets/schemas/existing-vault-manifest.schema.json)
as the machine-readable contract for templates, fixtures, and target-repo manifests.

## Part 2: Existing-Vault Runtime

The simplest useful output is an existing-vault crowdfunding UI:

- Campaign browse cards render without wallet connection.
- Detail/review screens explain the project, vault, asset, recipient/routing logic, and risk notes.
- Wallet Endow prepares the ERC-4626-style deposit for the selected vault and makes the connected
  wallet the owner/receiver.
- Technical details expose chain, token, vault, and explorer links without crowding the primary UI.
- Management links return to a route-local position view without private identifiers in URLs.

Use the target repo's wallet and data stack. Do not copy Green Goods-specific hooks unless the target
repo is Green Goods. Preserve the behavior contract instead: manifest-driven campaigns, wallet-last
confirmation, exact chain/token/vault validation, and local tests around transaction shape.

Read [references/runtime-modules.md](./references/runtime-modules.md) for runtime module boundaries.
For React repos, read
[references/react-module-boundaries.md](./references/react-module-boundaries.md) before naming hooks,
components, or services.

## Part 3: Card Provider Module

Card Endow is optional and must be proof-gated through a provider adapter. Before exposing it:

- Establish a user-owned recovered wallet receiver.
- Prove funds arrive for the expected chain, token, amount, receiver, route, and provider session.
- Require user authorization for approve/deposit unless a provider contract-call flow is proven.
- Verify vault shares by reading the vault for the recovered wallet; never trust client-only share
  claims.
- Keep provider IDs, emails, receipt tokens, wallet addresses, and session details out of URLs and
  public logs.

Thirdweb is the first concrete module. Coinbase and Stripe are future adapter modules unless the
target repo already has a verified provider path. Card Donate proof never unlocks Card Endow.

Read [references/provider-adapters.md](./references/provider-adapters.md) before implementing or
planning provider code.

## Part 4: Create-Vault Operator Module

Include create-vault only as a clearly non-runnable operator module in v1:

- Describe what an operator must supply: Octant factory/API proof, deployment addresses, strategy
  parameters, asset config, recipient/routing config, and verification commands.
- Keep it out of public campaign controls.
- Do not provide deploy scripts, default factory addresses, or copy-paste transaction commands
  without current Octant proof.
- If proof is missing, output a checklist and blocked state, not implementation code.

Read [references/create-vault-operator-module.md](./references/create-vault-operator-module.md)
when the request mentions creating, bootstrapping, or deploying vaults.

## Part 5: Deliverables

Produce artifacts that another repo can use directly:

- A short implementation plan scoped to the target repo.
- A campaign context file based on [assets/templates/campaign-context.md](./assets/templates/campaign-context.md).
- A vault manifest based on [assets/templates/existing-vault-manifest.json](./assets/templates/existing-vault-manifest.json).
- A schema-compatible manifest checked against
  [assets/schemas/existing-vault-manifest.schema.json](./assets/schemas/existing-vault-manifest.schema.json).
- An implementation handoff based on [assets/templates/implementation-handoff.md](./assets/templates/implementation-handoff.md).
- Optional provider/create-vault module notes, only when requested or necessary.
- Validation evidence from target repo commands.

Use the fixture files under [assets/fixtures](./assets/fixtures/) to dry-run portability:
Greenpill NYC is a complete real fixture, EVMavericks is a partial real fixture, and the synthetic
fixture proves the skill is not hardcoded to either.

## Part 6: Validation

Validate in layers:

1. Static manifest validation: JSON parses, schema fields are present, address shape is valid,
   readiness gates match missing fields, and chain/token/vault/explorer fields agree.
2. Unit tests: amount parsing, transaction-readiness gates, route/provider proof separation, and
   unavailable states.
3. UI tests: browse without wallet, wallet-last flow, disabled pending campaigns, and no private URL
   leakage.
4. Provider tests when card is enabled: quote/session tuple matching, recovered-wallet receiver

   proof-route failure modes, and redacted logs.
5. Browser proof for visible UI changes, stopping before live value movement unless the user
   explicitly approves.

Read [references/validation.md](./references/validation.md) for the dry-run checklist.

## Anti-Patterns

- Do not make Green Goods packages or `/vaults` code a dependency for other repos.
- Do not ship a generated app or package from v1; produce skill guidance, schemas, templates, and
  target-repo implementation plans.
- Do not treat preview copy as transaction-enabling campaign copy.
- Do not present WETH vault deposits as native ETH payable deposits unless the target vault proves
  that interface.
- Do not expose card payments before recovered-wallet custody, provider tuple, and share proof are
  enforceable.
- Do not put wallet addresses, emails, provider sessions, receipt tokens, or replay/session URLs in
  shareable links or public issue bodies.
- Do not use a candidate factory address for create-vault work without current Octant proof.
- Do not turn the non-runnable create-vault operator module into a hidden deploy script.

## Related Skills

- `web3` for wallet connection, chain switching, and contract reads/writes.
- `ui` for accessible route and component implementation.
- `react` for component, state, and query boundaries.
- `testing` for unit, browser, and proof-gated validation.
- `contracts` for review of any future factory/deployment claims.
- `ops` for deployment and environment boundaries.
