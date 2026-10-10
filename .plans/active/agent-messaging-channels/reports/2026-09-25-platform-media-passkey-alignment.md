# Platform-neutral ceremonies, broader evidence and passkey-first accounts

**Date:** 25 September 2026. Follow-up to the account/conversation amendment.
**Evidence:** repository `da329c99e556ad248dded850efc1f8e6cc0c75be` and primary documentation retrieved this turn.
**Status:** user decisions captured; tools recommended for evaluation; no runtime implementation, installation, provider upload or wallet operation performed.

## Accepted direction

The user accepted the Jev/LLM split, reproducible API harness as the first build phase, and ERD simplifications. Browser views must work across messaging platforms. Document processing and visual interpretation are required; the user explicitly included PDFs, Word documents, photographs and spreadsheets. Receipts, forms, scans and garden reports are proposed evaluation examples within those formats.

The account goal is normal passkey login to each person's Kernel account, with an existing EOA added from Profile if they have one. This clarifies the earlier application-login-only interpretation. Profile signer configuration remains future work; the messaging prototype uses prepared accounts and verified garden roles.

The [technical brief](../technical-brief.md) is the current architecture and owns the detailed contracts. Previous dated records remain historical.

## Research conclusions

**ESTABLISHED:** Kernel's [weighted validator](https://docs.zerodev.app/advanced/multisig) supports mixed WebAuthn and EOA signers and configurable thresholds. Our [current adapter](../../../../packages/shared/src/workflows/auth-passkey-adapters.ts) constructs one passkey owner through permissionless. Its installed constructor accepts an `owners: [owner]` tuple. Attaching an EOA as a co-signer is therefore a validator/configuration integration, not an ordinary profile-table insert.

**INFERRED / RECOMMENDED:** keep passkey as the normal login. Profile wallet proof creates a verified association; a distinct explicit owner-approved change may grant that wallet account control. A one-of-two signer configuration lets either credential act alone, avoiding dual prompts but increasing the consequences of either credential being compromised. Recovery-only authority needs a separately proven policy. Preserve the Kernel address and verify effective authority after configuration. EOA assets/roles/history do not move automatically. EOA compatibility signing remains available during deliberate account migration.

**ESTABLISHED:** [Mistral OCR](https://docs.mistral.ai/studio/document-processing/basic_ocr) exposes document structure, tables and regions and documents PDF/DOCX support. Its [document annotation mode](https://docs.mistral.ai/studio/document-processing/annotations) feeds a bounded subset of figures into whole-document interpretation. Do not equate successful extraction with complete visual coverage.

**ESTABLISHED:** [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs) distinguish PDF page-image processing from non-PDF text ingestion and bounded spreadsheet augmentation. The integration needs its own exact cell/range path and coverage checks. [ExcelJS 4.4.0](https://raw.githubusercontent.com/exceljs/exceljs/v4.4.0/README.md) reads XLSX/CSV and does not evaluate formulas. It is declared at the repository root but not in the Agent manifest.

**RECOMMENDED CANDIDATES:** Mistral OCR for document structure; OpenAI Responses for vision/conversation/field extraction; ExcelJS for spreadsheet cells; Sharp for images; Jev over textual observations. Compare with [Gemini document interpretation](https://ai.google.dev/gemini-api/docs/document-processing) and a one-provider multimodal path. [Docling](https://github.com/docling-project/docling/blob/main/docs/usage/supported_formats.md) is the local-processing alternative, with a new Python/model operating footprint. These capabilities are documented; comparative accuracy, latency and cost have not been measured.

## Changes to implementation boundaries

- Generic browser routes `/continue/:requestId` and `/recover/:requestId`; generic `/messaging/*` API behind `/api/messaging/*`. Meta keeps its provider-specific webhook.
- Each request retains its originating channel/realm. Dynamic copy and return navigation do not change who may redeem a challenge. No arbitrary return URL or cross-platform authority transfer.
- Required file formats start with PDF, DOCX, JPEG/PNG/WebP, XLSX and CSV. Unsafe active formats and unsupported conversions are explicit failures, not silent truncation.
- Extracted document facts, visual observations and computed spreadsheet values retain provenance and uncertainty. The gardener reviews proposed facts and public excerpts before publication.
- A bounded processing manifest stays with MediaAsset; accepted facts stay in DraftRevision. No table per pipeline stage. AccountBinding describes the identity association, not owner signer power.
- First build slice uses the production-intended coordinator, temporary SQLite and deterministic external-adapter fixtures through Hono in-process requests. No real provider or chain is needed for that gate. Live processor evaluation follows separately; mocked OCR responses do not prove OCR quality.

## Remaining choices and proof

Pin models and SDKs after a representative synthetic/consented corpus evaluation. Test accented text, scans, multiple pages/figures, DOCX embedded images, mixed units, hidden cells, formulas, row limits and uncertain visuals. Show incomplete coverage. Confirm applicable provider retention/region/deletion terms before personal data is sent. No provider has been approved merely by naming it here.

Prove the exact Kernel module versions, owner/signature formats, in-place account configuration, revoke/recovery behavior and compatibility with reporting/review grants. Choose secondary signing versus recovery-only behavior before implementing Profile changes. No new wallet owner was installed, and no existing account or role was migrated.
