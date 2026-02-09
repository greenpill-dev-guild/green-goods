# Green Goods — Bugbot Rules (warnings-first)

Goal: keep PR reviews focused by automatically flagging known footguns.
For the first rollout, everything here is NON-BLOCKING warnings.
(After ~2 weeks, promote the zero-false-positive ones to blocking.)

---

## Global Rules

### A) Env Discipline (Root .env only)

If any changed file path matches `/(^|\/)packages\/[^\/]+\/\.env(\.|$)/`, then:
- Add a non-blocking Bug titled "GG invariant: package-level .env file"
- Body: "All packages use the single root `.env`. Remove this file and use root `.env` + `.env.example` docs. See `CLAUDE.md`."

If any changed file path matches `/(^|\/)\.env$/`, then:
- Add a non-blocking Bug titled "GG invariant: committed root .env"
- Body: "Root `.env` should never be committed. Remove it from git history and rotate any exposed credentials."

---

### B) Secrets Discipline

If any changed file contains `/(BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xoxb-[0-9A-Za-z-]{10,}|sk_live_[0-9A-Za-z]{10,})/`, then:
- Add a non-blocking Bug titled "GG security: potential secret committed"
- Body: "Remove the secret, rotate it immediately, and use `.env` + `.env.example` placeholders instead."

If any changed file contains `/(PRIVATE_KEY|ENCRYPTION_SECRET|TELEGRAM_BOT_TOKEN)\s*[:=]\s*['"]?[^'"\n]{8,}/`, then:
- Add a non-blocking Bug titled "GG security: secret-like value added"
- Body: "Secrets must not be committed. Use root `.env` locally and keep `.env.example` as placeholders."

---

### C) Hooks Boundary (hooks live in shared only)

If any changed file path matches `/packages\/(client|admin)\/src\/hooks\//`, then:
- Add a non-blocking Bug titled "GG invariant: hooks must live in @green-goods/shared"
- Body: "Client/admin may consume hooks but must not define them. Move to `packages/shared/src/hooks/...` and re-export. See `CLAUDE.md` and `.claude/context/shared.md`."

If any changed file path matches `/packages\/(client|admin)\/src\/.*\.(ts|tsx)$/` and contains `/export\s+(function|const)\s+use[A-Z]\w*/`, then:
- Add a non-blocking Bug titled "GG invariant: exported hook found outside shared"
- Body: "All hooks must live in shared. Move it to `packages/shared/src/hooks/...` and export via shared indexes."

---

### D) Cross-Package Import Boundaries

If any changed file contains `/@green-goods\/shared\/src\//`, then:
- Add a non-blocking Bug titled "GG invariant: forbidden deep import from @green-goods/shared"
- Body: "Do not import from shared internals. Export from shared and import via `@green-goods/shared` (or allowed subpaths like `@green-goods/shared/hooks`). See `.claude/context/shared.md`."

If any changed file contains `/(\.\.\/){2,}packages\/(client|admin|shared|agent|indexer)\/src\//`, then:
- Add a non-blocking Bug titled "GG invariant: forbidden cross-package source import"
- Body: "Never import another package's source directly. Move shared logic into `packages/shared` and import via `@green-goods/shared`."

---

### E) Single-Chain Invariant (no runtime switching)

If any changed file contains `/(useSwitchChain|switchChain\()/`, then:
- Add a non-blocking Bug titled "GG invariant: runtime chain switching is forbidden"
- Body: "Apps are single-chain; derive chain from `VITE_CHAIN_ID` via `getDefaultChain()` / `DEFAULT_CHAIN_ID`."

If any changed file contains `/\{\s*[^}]*\bchainId\b[^}]*\}\s*=\s*useAccount\(/`, then:
- Add a non-blocking Bug titled "GG invariant: wallet chainId usage is forbidden"
- Body: "Never derive chain from the wallet. Use env chain via shared config (`useCurrentChain()` / `DEFAULT_CHAIN_ID`)."

---

### F) TODO/FIXME Hygiene

If any changed file contains `/(?:^|\s)(TODO|FIXME)(?:\s*:|\s+)/`, then:
- Add a non-blocking Bug titled "TODO/FIXME found (needs GitHub issue ref)"
- Body: "Replace with a tracked reference: `TODO(#123): ...` or `TODO(GG-123): ...`, or remove it."
- If the TODO references `/#\d+|GG-\d+/`, mark the Bug as resolved automatically.

---

### G) Hardcoded Addresses (all packages)

If any changed file path matches `/packages\/(client|admin|shared|agent)\/src\/.*\.(ts|tsx)$/` and contains `/['"]0x[a-fA-F0-9]{40}['"]/`, then:
- Add a non-blocking Bug titled "GG invariant: hardcoded address found"
- Body: "Use deployment artifacts, not hardcoded addresses. Import from `../contracts/deployments/*-latest.json`."

---

## Contracts Rules

### Schema Immutability (EAS) — CRITICAL

If any changed file path matches `/packages\/contracts\/config\/schemas\.json$/`, then:
- Add a non-blocking Bug titled "GG invariant: do not modify contracts/config/schemas.json"
- Body: "This file represents production EAS schema metadata. Editing it can create duplicate schemas and break indexing. Use `schemas.test.json` for experiments or `deploy.ts --update-schemas` for metadata-only updates. See `.cursor/rules/schema-management.mdc`."

### Prefer deploy.ts (not raw forge broadcast)

If any changed file contains `/forge\s+script\b/` and contains `/--broadcast\b/`, then:
- Add a non-blocking Bug titled "GG deploy: use deploy.ts (not raw forge --broadcast)"
- Body: "Use `bun script/deploy.ts ... --broadcast` so root env loading, schema handling, verification, and Envio updates are consistent. See `.cursor/rules/deployment-patterns.mdc`."

### Custom Errors Only (no require strings)

If any changed file path matches `/packages\/contracts\/.*\.sol$/` and contains `/\brequire\s*\(/`, then:
- Add a non-blocking Bug titled "Solidity: require() found — use custom errors"
- Body: "Replace `require(..., 'msg')` with custom errors + `revert`. See `.cursor/rules/rules.mdc`."

### UUPS Storage Safety

When reviewing changes to upgradeable contracts:
- New storage variables must only be appended (never reorder/remove).
- Storage gaps must be preserved/adjusted.
- Upgrade safety tests must be updated when storage changes.

If an upgradeable contract's storage layout changes without a corresponding test update, then:
- Add a non-blocking Bug titled "UUPS upgrade safety risk"
- Body: "Storage layout changes require explicit upgrade-safety coverage (layout + initialization + gap). See `.cursor/rules/uups-upgrades.mdc`."

---

## Client Rules (packages/client)

### Polling Detected

If any changed file path matches `/packages\/client\/.*\.(ts|tsx)$/` and contains `/setInterval.*queryClient|polling|refetchInterval/`, then:
- Add a non-blocking Bug titled "Client: polling detected"
- Body: "Avoid polling. Use useJobQueueEvents for event-driven updates."

### Orphan Blob URL

If any changed file path matches `/packages\/client\/.*\.(ts|tsx)$/` and contains `/URL\.createObjectURL(?!.*mediaResourceManager)/`, then:
- Add a non-blocking Bug titled "Client: orphan blob URL"
- Body: "Use mediaResourceManager.getOrCreateUrl() to prevent memory leaks."

### Missing isReady Check

If any changed file path matches `/packages\/client\/.*\.(ts|tsx)$/` and contains `/smartAccountClient\.(send|write)(?!.*isReady)/`, then:
- Add a non-blocking Bug titled "Client: missing isReady check"
- Body: "Guard smartAccountClient calls with isReady check."

---

## Admin Rules (packages/admin)

### Missing Permission Check

If any changed file path matches `/packages\/admin\/src\/views\/.*\.tsx$/` and contains `/function.*View|export default/` and does NOT contain `/useRole|hasPermission|RequireRole/`, then:
- Add a non-blocking Bug titled "Admin: missing permission check"
- Body: "Admin views should check permissions with useRole or RequireRole."

### Hardcoded Permission

If any changed file path matches `/packages\/admin\/.*\.(ts|tsx)$/` and contains `/role\s*===?\s*['"]/`, then:
- Add a non-blocking Bug titled "Admin: hardcoded permission"
- Body: "Use hasPermission(role, Permission.X) instead of hardcoded role checks."

### Data Exposure Risk

If any changed file path matches `/packages\/admin\/.*\.(ts|tsx)$/` and contains `/console\.log.*(user|garden|wallet)/`, then:
- Add a non-blocking Bug titled "Admin: data exposure risk"
- Body: "Remove sensitive data from console.log before commit."

---

## Shared Rules (packages/shared)

### Hook Naming Convention

If any changed file path matches `/packages\/shared\/src\/hooks\/.*\.ts$/` and contains `/export function [^u]/`, then:
- Add a non-blocking Bug titled "Shared: hook naming convention"
- Body: "Hook must start with 'use' prefix (e.g., useGarden, useAuth)."

### Provider Missing Display Name

If any changed file path matches `/packages\/shared\/src\/providers\/.*\.tsx$/` and contains `/createContext/` and does NOT contain `/displayName/`, then:
- Add a non-blocking Bug titled "Shared: provider missing displayName"
- Body: "Add displayName to context for React DevTools debugging."

### Missing Query Key Export

If any changed file path matches `/packages\/shared\/src\/hooks\/.*use.*\.ts$/` and contains `/queryKey:\s*\[/` and does NOT reference `query-keys.ts`, then:
- Add a non-blocking Bug titled "Shared: missing query key export"
- Body: "Add query key to hooks/query-keys.ts for consistency."

---

## Agent Rules (packages/agent)

### Exposed Private Key

If any changed file path matches `/packages\/agent\/.*\.ts$/` and contains `/privateKey|PRIVATE_KEY|secret/` and does NOT contain `/decrypt|process\.env/`, then:
- Add a non-blocking Bug titled "Agent: exposed private key"
- Body: "NEVER hardcode private keys. Use encrypted storage or environment variables."

### Missing Rate Limit

If any changed file path matches `/packages\/agent\/src\/handlers\/.*\.ts$/` and contains `/export.*handler|handle/` and does NOT contain `/rateLimit|cooldown/`, then:
- Add a non-blocking Bug titled "Agent: missing rate limit"
- Body: "Add rate limiting to prevent abuse."

### Unsafe Error Message

If any changed file path matches `/packages\/agent\/.*\.ts$/` and contains `/catch.*reply\(.*error|catch.*send\(.*error/`, then:
- Add a non-blocking Bug titled "Agent: unsafe error message"
- Body: "Don't expose raw errors to users. Use sanitized messages."

### Missing Input Validation

If any changed file path matches `/packages\/agent\/src\/handlers\/.*\.ts$/` and contains `/ctx\.message\.text|update\.message/` and does NOT contain `/validate|sanitize|zod/`, then:
- Add a non-blocking Bug titled "Agent: missing input validation"
- Body: "Validate and sanitize all user input."

---

## Indexer Rules (packages/indexer)

### Missing chainId Field

If any changed file path matches `/packages\/indexer\/src\/.*\.ts$/` and contains `/context\.(\w+)\.set\(/` and does NOT contain `/chainId/`, then:
- Add a non-blocking Bug titled "Indexer: missing chainId field"
- Body: "Entity MUST include chainId field for multi-chain support."

### Non-Composite ID

If any changed file path matches `/packages\/indexer\/src\/.*\.ts$/` and contains `/id:\s*event\.params/` and does NOT contain `/\$\{.*chainId/`, then:
- Add a non-blocking Bug titled "Indexer: non-composite ID"
- Body: "Use composite ID: `${chainId}-${uid}` for cross-chain uniqueness."

### Missing Create-If-Not-Exists

If any changed file path matches `/packages\/indexer\/src\/.*\.ts$/` and contains `/context\.(\w+)\.get\(/` and does NOT contain `/if.*null|\?\?/`, then:
- Add a non-blocking Bug titled "Indexer: missing null check"
- Body: "Handle null case - entity may not exist yet."

---

## Reference

- [Cursor Bugbot docs](https://docs.cursor.com/en/bugbot)
- `.cursor/rules/` — Detailed contract rule files
- `.claude/context/` — Package-specific context files
