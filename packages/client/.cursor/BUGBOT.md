# Green Goods Client — Bugbot Rules (warnings-first)

Rules for offline-first PWA patterns. These apply when client files change.

---

## A) No polling — use event-driven updates

If any changed file contains `/setInterval\s*\(/` or `/setTimeout\s*\([^)]*,\s*\d{3,}\)/`, then:
- Add a non-blocking Bug titled "Client: polling detected (use events)"
- Body: "Use `useJobQueueEvents()` for reactive updates instead of polling. See `packages/client/.cursor/rules/offline-architecture.mdc`."

---

## B) Media URL management

If any changed file contains `/URL\.createObjectURL\(/` and does NOT contain `mediaResourceManager`, then:
- Add a non-blocking Bug titled "Client: raw blob URL without cleanup tracking"
- Body: "Use `mediaResourceManager.getOrCreateUrl(file, trackingId)` for stable URLs with cleanup tracking. Raw `URL.createObjectURL` creates memory leaks. See `packages/client/.cursor/rules/offline-architecture.mdc`."

---

## C) Chain from environment (not wallet)

If any changed file contains `/useAccount\(\).*chainId/` or `/\{\s*chainId\s*\}\s*=\s*useAccount\(/`, then:
- Add a non-blocking Bug titled "Client: wallet chainId usage forbidden"
- Body: "Client is single-chain. Use `useCurrentChain()` or `DEFAULT_CHAIN_ID` from `@green-goods/shared`. See `packages/client/.cursor/rules/authentication.mdc`."

---

## D) Auth mode branching

If any changed file contains `/smartAccountClient\./` without nearby check for auth mode, then:
- Add a non-blocking Bug titled "Client: consider auth mode check"
- Body: "Verify `authMode === 'passkey'` before using `smartAccountClient`. Wallet users should use direct transactions. See `packages/client/.cursor/rules/authentication.mdc`."

---

## Reference

- `.cursor/rules/offline-architecture.mdc` — Job queue patterns
- `.cursor/rules/authentication.mdc` — Auth mode branching
