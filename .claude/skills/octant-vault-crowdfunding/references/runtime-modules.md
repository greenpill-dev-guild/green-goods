# Runtime Modules

Use this reference when mapping the skill into a target repo. For React repos, pair it with
`references/react-module-boundaries.md`. For Card Endow, pair it with
`references/provider-adapters.md`.

## Existing-Vault UI Module

Responsibilities:

- Render browse/detail/review states from manifest data.
- Keep wallet connection out of browse and amount selection.
- Prepare deposit calls only after amount and vault are selected.
- Thread the configured chain ID into reads/writes.
- Show technical vault/token details behind a details surface.
- Keep management routes local and privacy-safe.

Outputs:

- Route/page component.
- Manifest loader or config module.
- Campaign card/detail components.
- Amount/review component.
- Wallet Endow hook or service.
- Position/manage view.
- Focused tests for readiness gates and transaction shape.

## Card Provider Module

Responsibilities:

- Recover or identify a user-owned wallet receiver.
- Prepare provider quote/session only for an exact expected tuple.
- Confirm provider completion without trusting client-only state.
- Require approve/deposit or a proven provider contract-call path.
- Verify positive vault shares for the receiver.
- Store only safe receipt/recovery metadata.

Provider boundaries:

- Thirdweb can be concrete when docs, SDK, and backend routes are available.
- Coinbase and Stripe remain adapter interfaces until the repo has verified routes.
- Provider secrets, webhook keys, and raw payment sessions stay backend-only.
- Card Donate proof never satisfies Card Endow proof.
- Provider SDK code must stay outside framework-neutral manifest helpers.

## Management Module

Responsibilities:

- Read `balanceOf(owner)` or equivalent share ownership.
- Prefer shares-first redeem semantics when the vault exposes shares.
- Use estimates for returned asset value and label them as estimates.
- Keep connected-wallet and recovered-card-wallet ownership boundaries separate.
- Keep manage URLs route-local and free of private identifiers.

## Validation Module

Responsibilities:

- Parse the manifest and list missing fields.
- Enforce readiness gates before rendering transaction controls.
- Unit-test transaction shape without moving live value.
- Dry-run against complete, partial, and synthetic fixtures.

## Non-Goals

- No Green Goods package imports unless building inside Green Goods.
- No global generator assumptions.
- No hidden background writes.
- No public create-vault button from this skill alone.
