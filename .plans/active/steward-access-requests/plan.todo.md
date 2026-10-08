# Steward Access Requests Plan

**Feature Slug**: `steward-access-requests`
**Status**: ACTIVE
**Created**: 2026-10-07

## Decisions

1. Reuse the request capability with a signed steward_access kind; keep legacy membership signatures unchanged.
2. Keep labeled entry in empty state and Profile, with the existing AdminDialog pattern.
3. Steward approval must confirm actual role assignment; the service never grants roles.
4. Keep selected target/request metadata in account-scoped memory and explicit signature-driven status checks.
5. Use the existing local release branch and preserve unrelated report work. No external tracking mirror is required for this bounded task.

## Steps and requirements coverage

- [x] Shared: RED/GREEN protocol, transport, kind-scoped signing/session/cache and availability support.
- [x] Agent: RED/GREEN memory/SQLite parity, lossless index migration, private kind filtering and strict target-role admission/reconciliation.
- [x] Admin: RED/GREEN catalog/link selection, request/review/status/withdraw flow and explicit steward queue role grant.
- [ ] Integration: typechecks, boundary and ontology guards, legacy membership regression and build proof.
- [x] Browser: labeled desktop/mobile request and pending screenshots; record authenticated proof limits.
- [ ] Current-tree release validation and local commit evidence; push stays subject to the unrelated immutable-report blocker.

## Validation

The selector owns gates. Focused tests exercise legacy and new requests, negative authorization, scope changes, role confirmation and SQLite migration. Run package typechecks for changed public contracts and root cross-package/release checks. No real request submissions or role transactions during proof. Fresh committed evidence goes in lane handoffs; dirty-tree proof is explicitly provisional.
