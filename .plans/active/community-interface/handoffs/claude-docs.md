# Community documentation handoff

**Status:** BLOCKED — behavioral docs wait for shipped surfaces and verified evidence.

## Inputs

- Final specs, public language rules, UI screenshots, operator/research runbooks, verified/live status matrix.

## Outputs

- Community/member, operator triage, funder, evaluator/export, privacy/retraction, and glossary documentation with planned/live/reported/verified labels.

## Acceptance

- No unsupported metrics or prohibited vocabulary; built vs planned is explicit; en/es/pt UI terms agree; screenshots match shipped routes/states; oracle/funding verification wording is precise.

## RED / GREEN or proof limit

- RED: docs audit/vocabulary link or screenshot checklist records current gaps.
- GREEN: docs audit/build/vocab and Codex-doc checks pass. Proof limit: screenshots remain blocked until authenticated surfaces exist.

## Exact commands

```sh
bun run docs:audit
bun run build:docs
bun run lint:vocab
node scripts/quality/check-codex-docs.js
```

## Out of scope

Claiming implementation or pilot outcomes, publishing private research/identities, and product-code fixes.

## Unblock evidence

Final route/state evidence, approved public provenance table, and screenshot access for authenticated surfaces.
