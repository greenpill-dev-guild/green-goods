# Input Schema

Use this reference when defining manifests, fixtures, or intake forms for an Octant vault
crowdfunding UI. Keep JSON fixtures compatible with
`assets/schemas/existing-vault-manifest.schema.json`.

## Required Campaign Context

- `communityName`: public campaign/community name.
- `campaignSlug`: stable URL-safe slug.
- `campaignGoal`: what the crowdfunding effort supports.
- `vaultStory`: why this vault exists and how supporters should understand it.
- `impactFraming`: plain-language description of the expected public-goods outcome.
- `ctaLabels`: labels for browse, wallet endow, card endow, and manage actions.
- `riskNotes`: concise, non-alarmist risks and proof limits.
- `sourceLinks`: safe public docs, briefs, explorer links, or project references.

## Required Existing Vault Tuple

- `chainId`: numeric chain ID.
- `vaultAddress`: EVM address for the deployed vault.
- `vaultDisplayName`: public display name.
- `vaultTokenSymbol`: vault share symbol when known.
- `vaultDecimals`: vault share decimals when known.
- `assetAddress`: EVM address for the underlying asset.
- `assetSymbol`: asset symbol.
- `assetDecimals`: asset decimals.
- `explorerLink`: vault explorer URL.
- `assetExplorerLink`: asset explorer URL.

## Transaction-Enabling Fields

- `campaignCopy`: public copy approved for the transaction review surface.
- `recipientRoutingSummary`: human-readable routing summary.
- `positionRead`: owner/share/redeem read strategy when management is included.
- `runtime`: target framework, router, wallet stack, RPC policy, chain switching policy, and
  validation commands.

If either `campaignCopy` or `recipientRoutingSummary` is missing, keep the campaign browsable but
do not enable Wallet Endow or Card Endow.

## Optional Modules

- `factoryEvidence`: creator/factory metadata with source and proof limits. Treat it as metadata
  unless current Octant factory/API proof makes it transaction-relevant.
- `indexerSupport`: query endpoint or null.
- `cardProvider`: adapter ID plus receiver, tuple, settlement, and share-proof status. No secrets.
- `createVaultOperatorModule`: checklist path and blocked/ready status when create-vault setup is
  in scope.

## Readiness States

- `browse_ready`: enough safe copy to display the campaign; transaction controls disabled.
- `wallet_ready`: complete existing-vault tuple, campaign copy, routing summary, runtime policy,
  and wallet Endow validation path.
- `card_ready`: wallet-ready plus recovered-wallet receiver proof, provider tuple proof,
  settlement path, and share-proof path.
- `pending_details`: browsable, but transaction controls disabled with specific missing fields.
- `operator_only`: setup guidance only; no public transaction controls.

## Privacy Contract

Manifest data may include public addresses, campaign copy, explorer links, and proof-limit notes.
Do not put emails, OTPs, provider session IDs, receipt tokens, replay/session URLs, private webhook
keys, or direct contact/payment identifiers in manifests, URLs, or public logs.

## Fixture Policy

Real partial fixtures are allowed. Represent missing fields directly instead of inventing them.
Synthetic complete fixtures are required for portability testing so the skill does not hardcode a
single project. A partial real fixture should use `pending_details` unless the missing fields are
strictly optional for the requested output.
