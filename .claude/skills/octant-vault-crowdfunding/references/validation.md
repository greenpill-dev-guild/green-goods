# Validation

Use this reference when closing out an Octant vault crowdfunding UI implementation or dry-running
the skill.

## Static Checks

- Manifest parses.
- Manifest follows `assets/schemas/existing-vault-manifest.schema.json`.
- Required transaction fields are present for wallet-ready campaigns.
- Partial fixtures list missing fields explicitly.
- Addresses are EVM-shaped and checksummed where the target repo supports checksum validation.
- Chain ID, vault address, asset address, decimals, and explorer links agree.
- `readiness` matches transaction gates and `missingFields`.

## UI Checks

- Campaign browse works without wallet connection.
- Amount selection happens before wallet connection.
- Pending campaigns are visible but transaction-disabled.
- Wallet Endow review shows vault, asset, chain, amount, and receiver semantics.
- Manage links do not place private identifiers in URLs.

## Card Checks

- Card controls stay hidden until recovered-wallet receiver and provider proof paths exist.
- Quote/session tuple mismatch fails closed.
- Completed payment without covering token balance does not start settlement.
- Share proof is read from chain or trusted backend, not accepted from client claims.
- Logs and receipts are redacted.

## Dry-Run Fixtures

Run the skill against:

- `assets/fixtures/greenpill-nyc.json`
- `assets/fixtures/evmavericks-partial.json`
- `assets/fixtures/synthetic-complete.json`

The expected outcome is a portable plan and manifest set, not Green Goods-specific code.

For each fixture, record:

- Readiness state and missing fields.
- Existing-vault UI output plan.
- Wallet Endow enablement decision.
- Card Endow enablement decision and provider proof requirements.
- Create-vault operator state.
- Validation commands the target repo should run.
