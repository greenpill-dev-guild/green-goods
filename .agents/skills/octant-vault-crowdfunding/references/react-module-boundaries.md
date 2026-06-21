# React Module Boundaries

Use this reference when the target repo is React-based. Keep the pattern repo-neutral: adapt to the
target router, wallet stack, i18n system, data-fetching library, and design system.

## Suggested Boundaries

- Manifest loader: parses the existing-vault manifest, derives readiness, and exposes missing
  fields without enabling transactions.
- Campaign route/page: renders browse, detail, amount, review, confirmation, and manage entry
  states.
- Campaign components: render public copy, vault details, technical details, and risk/proof notes.
- Wallet Endow service: prepares amount parsing, chain validation, approval, deposit, and
  transaction lifecycle around the target wallet stack.
- Provider adapter: handles Card Endow receiver recovery, provider quote/session proof, settlement
  readiness, user authorization, and share proof.
- Position/manage module: reads share ownership, estimated redeemable asset value, and shares-first
  redeem semantics when the vault exposes ERC-4626-style reads.

## Hook And Service Rules

- Use the target repo's hook placement rules.
- Keep SDK-specific provider code outside shared/domain-only modules.
- Keep manifest helpers pure and framework-light when they may be reused outside React.
- Keep wallet connection out of browse and amount selection.
- Keep connected-wallet and recovered-card-wallet ownership boundaries separate.

## Tests

- Unit-test readiness gates, amount parsing, tuple matching, and provider failure modes.
- UI-test browse without wallet, wallet-last review, disabled pending campaigns, and privacy-safe
  management links.
- Browser-proof visible route changes in the target repo before claiming UX readiness.
