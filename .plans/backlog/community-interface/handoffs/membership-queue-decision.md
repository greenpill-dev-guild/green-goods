# Membership queue decision handoff

**Status:** IMPLEMENTED LOCALLY — production activation remains manually blocked.

## Selected operating model

- Green Goods is the data controller; Fly.io is the processor.
- Afo owns the initial 32-byte encryption key and incident response.
- Pending requests expire after 30 days; resolved requests are deleted 30 days after resolution.
- The agent stores one AES-256-GCM encrypted personal payload and a keyed account digest. Raw addresses, names, notes, reasons, signatures, and request IDs do not enter analytics or logs.
- On-chain Garden/Hats membership is authoritative. The agent never grants membership and reconciles manual additions on the next member or operator read.
- Public on-chain requests, Linear-as-queue, implicit localStorage transport, notifications, contract changes, and indexer changes remain excluded.

## Implemented surfaces

- Closed, non-member garden detail: signed request dialog with required display name, optional note, explicit status check, withdrawal, decline reason, and welcomed username prompt.
- PWA Gardeners tab: steward/owner queue above the roster with welcome/decline actions and persistent results.
- Admin `/community/members`: the same authorized queue above the member directory.
- Agent: origin checks, signed EOA/ERC-1271/EIP-6492 proof verification, garden-role scoping, rate limits, replay guards, encrypted SQLite persistence, 30-day sweeps, and on-chain reconciliation.
- Shared: dependency-light public contract, transport, auth-mode-aware hook, and passkey-capable member role mutation.

## Remaining production activation gate

- Install `JOIN_REQUESTS_ENCRYPTION_KEY` in the Fly.io secret store.
- Name a backup operator with access to the recovery procedure.
- Rehearse manual member addition during agent downtime and verify the next signed status/list read reconciles the row.
- Complete authenticated Brave proof against a production-shaped local or staging surface.

## RED / GREEN evidence

- Shared contract RED: missing `join-requests` module; GREEN: four validator/message/authorization tests pass.
- Agent storage RED: missing encrypted store and SQLite table; GREEN: memory and SQLite lifecycle/encryption tests pass.
- Agent API RED: route suite returned no implementation; GREEN: create, self-read, role-scoped list/decline, on-chain welcome reconciliation, signature failure, and replay tests pass.
- UI GREEN: PWA request dialog, client garden roster, admin queue, and membership sender tests pass. Browser proof remains part of the activation gate above.

## Exact commands

```sh
node scripts/harness/plan-hub.mjs validate
node scripts/harness/plan-hub.mjs linear-sync --feature community-interface --json
```

## Out of scope

Storing real join identities in repo/Linear, changing `waiting_for_hat` into join transport, adding contract/indexer state, or activating collection before the remaining production gate clears.

## Activation evidence

Named backup operator, Fly.io secret receipt, dated recovery rehearsal, authenticated Brave screenshots, and an intentional status change setting this sublane's `manual_blocked` false.
