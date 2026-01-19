# Green Goods Contracts — Bugbot Rules (warnings-first)

These rules only apply when contracts files change (Bugbot traverses upward from changed files).

---

## A) Schema immutability (EAS)

If any changed file path matches `/packages\/contracts\/config\/schemas\.json$/`, then:
- Add a non-blocking Bug titled "GG invariant: do not modify contracts/config/schemas.json"
- Body: "This is production schema metadata. Use `schemas.test.json` for experiments, or `deploy.ts --update-schemas` for metadata refresh. See `packages/contracts/.cursor/rules/schema-management.mdc`."

---

## B) Prefer deploy.ts wrapper (not raw forge broadcast)

If any changed file contains `/forge\s+script\b/` and contains `/--broadcast\b/`, then:
- Add a non-blocking Bug titled "GG deploy: use deploy.ts (not raw forge --broadcast)"
- Body: "Use `bun script/deploy.ts ... --broadcast` so root env loading, schema handling, verification, and Envio updates are consistent. See `packages/contracts/.cursor/rules/deployment-patterns.mdc`."

---

## C) Custom errors only (no require strings)

If any changed file path matches `/packages\/contracts\/.*\.sol$/` and contains `/\brequire\s*\(/`, then:
- Add a non-blocking Bug titled "Solidity: require() found — use custom errors"
- Body: "Replace `require(..., 'msg')` with custom errors + `revert`. See `packages/contracts/.cursor/rules/rules.mdc`."

---

## D) Storage gaps for upgradeable contracts

When reviewing changes to upgradeable contracts:
- New storage variables must only be appended (never reorder/remove).
- Storage gaps must be preserved/adjusted.
- Upgrade safety tests must be updated when storage changes.

If an upgradeable contract's storage layout changes without a corresponding test update, then:
- Add a non-blocking Bug titled "UUPS upgrade safety risk"
- Body: "Storage layout changes require explicit upgrade-safety coverage (layout + initialization + gap). See `packages/contracts/.cursor/rules/uups-upgrades.mdc`."

---

## Reference

- `packages/contracts/.cursor/rules/` — Detailed contract rules
- `packages/contracts/AGENTS.md` — Contract architecture guide
