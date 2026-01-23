# Green Goods Agent — Bugbot Rules (warnings-first)

Security-focused rules for the agent bot.

---

## A) Never store plaintext keys

If any changed file stores private keys without encryption:
- Pattern: `/db\.(insert|update).*privateKey/` without `prepareKeyForStorage`
- Add a non-blocking Bug titled "Agent security: plaintext key storage"
- Body: "Always encrypt with `prepareKeyForStorage(key)` before database storage. See `packages/agent/.cursor/rules/security.mdc`."

---

## B) Rate limiting required

If any changed file adds handler functions without rate limiting, then:
- Add a non-blocking Bug titled "Agent: verify rate limit"
- Body: "Add rate limiting via `rateLimiter.check(userId, action)` before expensive operations. See `packages/agent/.cursor/rules/security.mdc`."

---

## C) Input validation

If any changed file uses blockchain addresses without validation, then:
- Add a non-blocking Bug titled "Agent: verify address validation"
- Body: "Validate addresses with `isValidAddress(addr)` before use."

---

## D) No business logic in platform adapters

If any changed file in `platforms/` contains complex business logic, then:
- Add a non-blocking Bug titled "Agent arch: business logic in adapter"
- Body: "Platform adapters only transform messages. Business logic belongs in `handlers/`. See `packages/agent/.cursor/rules/architecture.mdc`."

---

## Reference

- `.cursor/rules/security.mdc` — Encryption, rate limiting, validation
- `.cursor/rules/architecture.mdc` — Handler patterns
