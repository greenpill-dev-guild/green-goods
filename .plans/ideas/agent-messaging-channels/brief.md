# Agent Messaging Channels

**Slug**: `agent-messaging-channels`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-04-17`

## Problem

Rural gardeners and operators in Season One pilot gardens do not reliably have web access or app literacy. The existing Telegram-only agent covers a narrow slice; WhatsApp and SMS are the dominant messaging surfaces in target regions. Without those channels, transactional activity (submit / approve / reject / join) funnels back through the PWA, blocking adoption for exactly the users the platform was built for.

## Desired Outcome

- Agent reachable on **WhatsApp + SMS** in addition to Telegram.
- Users text a phone number and can execute transactional actions scoped by ERC-4337 session keys (not an agent-held EOA).
- Tier-Y capability: read-only unlimited, transactional rate-limited (submit 10/day, approve/reject 20/day, join 3/day).
- Dual revoke path: web (passkey) OR `REVOKE` keyword via messaging.
- At least one Season One pilot garden runs a real work cycle via SMS or WhatsApp by **2026-06-30**.

## Scope Notes

- In scope:
  - `packages/agent` platform adapters (`whatsapp.ts`, `sms.ts`, `_base.ts`), session-key service, linking service, rate-limit service, handler refactor to `InboundMessage`.
  - `packages/contracts/src/validators/SessionKeyValidator.sol` (or thin wrapper if Pimlico ships one).
  - `packages/shared/src/hooks/usePhoneLinking.ts` + `modules/{sessionKeys,agentCommands}.ts` (barrel-exported).
  - `packages/client/src/views/Profile/PhoneLinking/` UX.
- Out of scope:
  - New transactional commands beyond the existing handler set (`submit`, `approve`, `reject`, `join`).
  - Message templates / opt-in marketing flows (verification submission unblocks future work but is not the Q2 outcome).
  - Indexer changes — messaging state is off-chain per spec and per `CLAUDE.md` indexer-boundary rule.

## Success Signal

Both WA and SMS channels have sent ≥1 successful transactional message in production from a Season One pilot garden, with `SessionKeyValidator.sol` cleared by the shared Q2 audit and outcome milestone #14 closed.
