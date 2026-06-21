# Create-Vault Operator Module

This module is intentionally non-runnable in v1. It is a planning and handoff surface for operators
who may later create new Octant vaults before exposing them in a campaign UI.

## Required Proof Before Implementation

- Current Octant factory or API documentation.
- Verified factory/API deployment address or endpoint.
- Supported chain and asset list.
- Strategy type and parameter schema.
- Recipient/routing setup requirements.
- Access-control or operator account requirements.
- Dry-run and post-create verification commands.

If any item is missing, output a blocked checklist. Do not provide transaction scripts or default
addresses.

## Allowed V1 Outputs

- Blocked checklist naming the missing proof.
- Operator handoff notes for the target repo.
- Manifest update instructions for after a vault exists.
- Validation commands the operator should run after creation.

## Disallowed V1 Outputs

- Deploy scripts.
- Copy-paste transaction commands.
- Default factory addresses.
- Public create-vault controls.
- Hidden background writes from a campaign UI.

## Operator Checklist

1. Confirm target chain and asset.
2. Confirm strategy and recipient/routing design.
3. Confirm factory/API proof source.
4. Confirm operator account and permissions.
5. Dry-run vault creation outside the public UI.
6. Verify deployed vault metadata and asset metadata.
7. Add the created vault to the existing-vault manifest.
8. Run the existing-vault UI validation path.
9. Expose the vault publicly only after manifest validation passes.

## Public UI Boundary

Create-vault setup is operator scaffolding, not a public campaign control. A public user should see
only verified campaign/vault data after the operator has completed setup and manifest validation.
