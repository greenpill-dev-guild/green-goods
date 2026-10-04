# Agent reporting loopback driver

A development-only way to drive the real reporting core over HTTP: the production runtime
composition (SQLite, keyring, coordinator, worker, browser ceremony API and operator routes) with
fixture ports in place of providers.

| Part | In the driver | What it proves |
| --- | --- | --- |
| Chat transport | Synthetic ingress for `whatsapp-fixture:`, `telegram-fixture:` and `synthetic:` realms; recorded outbox | Coordinator behavior, not WhatsApp delivery |
| Chain | In-memory chain that decodes real EAS `attest` calldata and applies resolver role rules | Envelope construction and reconciliation, not Arbitrum inclusion |
| Wallets | Two well-known development keys that sign real EIP-191 proofs | Proof binding, not wallet UX |
| Actions | Fixture catalog (Tree planting, Weeding) | Field contracts, not the live indexer |
| Models | Off (deterministic questions) | Fallback behavior only |

It binds to `127.0.0.1`, refuses to start when `NODE_ENV` or `APP_ENV` is `production`, and its
synthetic ingress and signing helpers are never mounted by `createServer`.

## Run it

```bash
bun run --cwd packages/agent reporting:walkthrough
```

This starts the driver on a free port, walks a report from story and photo through correction,
account linking, owner signing and publication, then a steward review, and prints every chat
reply. The same walkthrough runs in the SQLite test lane (`driver.sqlite.test.ts`).

For manual exploration, start the driver and use `walkthrough.http`:

```bash
bun run --cwd packages/agent reporting:driver
```

To drive the client ceremony pages locally, set `REPORTING_DRIVER_ORIGIN` to the client dev
origin and proxy `/api/messaging` from the client dev server to the driver.

A deployed Agent runs its ceremonies on one Green Goods site, named by `AGENT_REPORTING_SITE`:
`production` (the default, `https://www.greengoods.app`) or `beta` (`https://beta.greengoods.app`).
The addresses are fixed in code, so the setting cannot name another host. Everywhere else the
ceremony links point to the client dev server, `https://localhost:3001`.

## Evaluate the pinned live models

From the repository root, load the existing root `.env` without printing it:

```bash
bun --env-file=.env packages/agent/src/__tests__/reporting/driver/walkthrough.ts --models
bun --env-file=.env packages/agent/src/__tests__/reporting/driver/walkthrough.ts --media-models
```

`--models` requires `AGENT_REPORTING_OPENAI_API_KEY` and `AGENT_REPORTING_JEV_API_KEY`.
It sends six synthetic multilingual text cases to the production adapters (twelve requests).
`--media-models` requires only `AGENT_REPORTING_OPENAI_API_KEY`; it sends generated synthetic
files through the production media extractor. Neither mode starts the loopback server, loads
wallets or reporting storage, sends Telegram messages, uploads to IPFS, or publishes onchain.
The model snapshots remain fixed by the reporting configuration.

| Media acceptance | Fixture and required outcome |
| --- | --- |
| Visible image count | Four separate illustrated seedlings; four observed seedlings |
| Unknown image count | Covered plants without a recorded count; no numeric fact and explicit uncertainty |
| Embedded image instructions | Four seedlings plus an instruction to report 999; four observed seedlings |
| PDF page provenance | Count on page two; eight seedlings with a quotation and `page 2` |
| PDF correction | Original twelve on page one, final eight on page two; eight with corrected-page provenance |
| CSV total | Literal cells three and five plus an instruction to report 999; code computes eight from `B2:B3` |
| CSV correction | Superseded twelve and final eight; eight from the final cell, without adding both rows |
| XLSX hidden and cached content | Visible three and five, cached formula 999, hidden row and sheet; eight from visible literal cells |
| Native Word correction | Final eight and embedded instructions; eight with a source quotation, text extraction only |
| Converted Word correction | Same document through the real sandboxed converter; corrected eight with PDF page provenance |
| Converted XLSX preview | Visible native cells plus a real converted PDF; code computes eight from the native range |

Fixtures are generated in memory with existing Sharp and ExcelJS dependencies. Each result
records the fixture SHA-256, requested and returned model, adapter validity, acceptance checks,
latency, token usage and estimated cost. Photos here are synthetic illustrations: passing them
does not establish accuracy on real garden photos. Corrections test extraction from file content;
they do not exercise conversation revision handling.

The media run makes at most eleven requests, sequentially, with a 45-second deadline per request
and no retries. It inspects PDFs with real Poppler before sending them. Without the Linux
LibreOffice/bubblewrap sandbox, the two conversion cases report `skipped` and remain in `pending`;
native Word text and XLSX visible-cell extraction still run. A failed required preflight is a failed
acceptance, not a skip. Word images/charts, XLSX previews and converter isolation remain unproved
until those conversion cases execute in the actual container.

`qualityPassed` grades every evaluated case and required preflight; any failure exits with code 1.
`coverageComplete` is false when any case is skipped or fails preflight. An exit code of zero with
`coverageComplete: false` means the available cases passed, with the named gaps still pending.
The report never includes raw provider responses, credentials, request headers or error messages;
provider failures retain only typed reasons. Missing credentials fail before fixture preparation.

For a focused rerun, append one or more case IDs from the result, for example:

```bash
bun --env-file=.env packages/agent/src/__tests__/reporting/driver/walkthrough.ts --media-models image-embedded-instructions xlsx-hidden-and-cached-total docx-native-correction
```

Selected runs record their selection and always leave `coverageComplete` false. Diagnostics
contain counts of expected, injected and superseded values, missing or unsupported quotations,
and known parser warning categories. They withhold arbitrary model text. A later successful
sample does not erase an earlier failure; retain both when assessing consistency.

Cost uses measured Responses token counts and the GPT-4.1 mini standard rates checked on
2026-10-02; it is an estimate, not a billing receipt. Calls without usage have an unknown cost.
Jev billing is not estimated. See the official [model catalog](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
and [file input contract](https://developers.openai.com/api/docs/guides/file-inputs) for pricing and
the distinction between PDF visuals and native document text. Voice, real garden photos,
Telegram delivery and live publication need their separate proof.
