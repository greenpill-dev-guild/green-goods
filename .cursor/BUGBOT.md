# Green Goods — Bugbot Rules (warnings-first)

Goal: keep PR reviews focused by automatically flagging known footguns.
For the first rollout, everything here is NON-BLOCKING warnings.
(After ~2 weeks, promote the zero-false-positive ones to blocking.)

---

## A) Env discipline (Root .env only)

If any changed file path matches `/(^|\/)packages\/[^\/]+\/\.env(\.|$)/`, then:
- Add a non-blocking Bug titled "GG invariant: package-level .env file"
- Body: "All packages use the single root `.env`. Remove this file and use root `.env` + `.env.example` docs. See `CLAUDE.md`."

If any changed file path matches `/(^|\/)\.env$/`, then:
- Add a non-blocking Bug titled "GG invariant: committed root .env"
- Body: "Root `.env` should never be committed. Remove it from git history and rotate any exposed credentials."

---

## B) Secrets discipline

If any changed file contains `/(BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xoxb-[0-9A-Za-z-]{10,}|sk_live_[0-9A-Za-z]{10,})/`, then:
- Add a non-blocking Bug titled "GG security: potential secret committed"
- Body: "Remove the secret, rotate it immediately, and use `.env` + `.env.example` placeholders instead."

If any changed file contains `/(PRIVATE_KEY|ENCRYPTION_SECRET|TELEGRAM_BOT_TOKEN)\s*[:=]\s*['"]?[^'"\n]{8,}/`, then:
- Add a non-blocking Bug titled "GG security: secret-like value added"
- Body: "Secrets must not be committed. Use root `.env` locally and keep `.env.example` as placeholders."

---

## C) Contracts schemas are immutable (EAS)

If any changed file path matches `/packages\/contracts\/config\/schemas\.json$/`, then:
- Add a non-blocking Bug titled "GG invariant: do not modify contracts/config/schemas.json"
- Body: "This file represents production EAS schema metadata. Editing it can create duplicate schemas and break indexing. Use `schemas.test.json` for experiments or `deploy.ts --update-schemas` for metadata-only updates. See `.claude/context/contracts.md`."

---

## D) Hooks boundary (hooks live in shared only)

If any changed file path matches `/packages\/(client|admin)\/src\/hooks\//`, then:
- Add a non-blocking Bug titled "GG invariant: hooks must live in @green-goods/shared"
- Body: "Client/admin may consume hooks but must not define them. Move to `packages/shared/src/hooks/...` and re-export. See `CLAUDE.md` and `.claude/context/shared.md`."

If any changed file path matches `/packages\/(client|admin)\/src\/.*\.(ts|tsx)$/` and contains `/export\s+(function|const)\s+use[A-Z]\w*/`, then:
- Add a non-blocking Bug titled "GG invariant: exported hook found outside shared"
- Body: "All hooks must live in shared. Move it to `packages/shared/src/hooks/...` and export via shared indexes."

---

## E) Cross-package import boundaries

If any changed file contains `/@green-goods\/shared\/src\//`, then:
- Add a non-blocking Bug titled "GG invariant: forbidden deep import from @green-goods/shared"
- Body: "Do not import from shared internals. Export from shared and import via `@green-goods/shared` (or allowed subpaths like `@green-goods/shared/hooks`). See `.claude/context/shared.md`."

If any changed file contains `/(\.\.\/){2,}packages\/(client|admin|shared|agent|indexer)\/src\//`, then:
- Add a non-blocking Bug titled "GG invariant: forbidden cross-package source import"
- Body: "Never import another package's source directly. Move shared logic into `packages/shared` and import via `@green-goods/shared`."

---

## F) Single-chain invariant (no runtime switching, no wallet chainId)

If any changed file contains `/(useSwitchChain|switchChain\()/`, then:
- Add a non-blocking Bug titled "GG invariant: runtime chain switching is forbidden"
- Body: "Apps are single-chain; derive chain from `VITE_CHAIN_ID` via `getDefaultChain()` / `DEFAULT_CHAIN_ID`."

If any changed file contains `/\{\s*[^}]*\bchainId\b[^}]*\}\s*=\s*useAccount\(/`, then:
- Add a non-blocking Bug titled "GG invariant: wallet chainId usage is forbidden"
- Body: "Never derive chain from the wallet. Use env chain via shared config (`useCurrentChain()` / `DEFAULT_CHAIN_ID`)."

---

## G) TODO/FIXME hygiene (GitHub issue numbers)

If any changed file contains `/(?:^|\s)(TODO|FIXME)(?:\s*:|\s+)/`, then:
- Add a non-blocking Bug titled "TODO/FIXME found (needs GitHub issue ref)"
- Body: "Replace with a tracked reference: `TODO(#123): ...` or `TODO(GG-123): ...`, or remove it."
- If the TODO references `/#\d+|GG-\d+/`, mark the Bug as resolved automatically.

---

## Reference

- [Cursor Bugbot docs](https://docs.cursor.com/en/bugbot)
- [Bugbot rules cookbook](https://cursor.com/docs/cookbook/bugbot-rules)
- `.claude/context/` — Package-specific context files
