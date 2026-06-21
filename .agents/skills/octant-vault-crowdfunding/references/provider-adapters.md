# Provider Adapters

Use this reference when Card Endow is in scope. The skill treats Card Endow as a provider adapter
boundary, not as a hard dependency on any one SDK.

## Adapter Contract

Inputs:

- Campaign slug and manifest version/source.
- Chain ID, vault address, asset address, asset decimals, and expected contribution amount.
- User-owned receiver wallet address.
- Return route and route-local manage path.
- Safe public receipt fields.

Outputs:

- Redacted provider status: `not_started`, `pending`, `completed`, `failed`, or `blocked`.
- Tuple proof that matches chain, token, amount, receiver, vault, and provider route.
- Settlement readiness: token balance or proven direct contract-call path.
- User-authorized settlement result: approve/deposit or proven provider contract-call.
- Share proof from vault reads or a trusted backend proof route.

Failure behavior:

- Fail closed on quote/session mismatch.
- Do not start settlement after a completed payment unless token balance or direct-call proof covers
  the expected amount.
- Do not mark Card Endow complete from client-only claims.
- Do not expose provider session IDs, emails, receipt tokens, wallet addresses, or replay/session
  links in URLs or public logs.

## Thirdweb Reference Path

Use Thirdweb as the first concrete adapter only when the target repo has SDK support and backend
routes for any required proof or receipt storage.

Required path:

1. Recover or create a user-owned in-app/email wallet receiver.
2. Prepare provider funding for the exact chain, asset, amount, and receiver tuple.
3. Confirm completion through provider status and tuple proof.
4. Require user authorization for ERC-20 approve plus ERC-4626 deposit unless a direct provider
   contract-call path is proven.
5. Verify positive vault shares for the receiver with `balanceOf(receiver)` or a trusted proof
   route.
6. Store only safe recovery metadata needed for route-local management.

## Future Provider Shapes

Coinbase and Stripe are future adapters. For v1, document their expected inputs and outputs only
when a target repo already has verified provider routes. Do not imply they are ready because
Thirdweb is ready.

## Card Donate Boundary

Card Donate proof does not unlock Card Endow. Endow requires a vault receiver, settlement path, and
share proof for the selected vault.
