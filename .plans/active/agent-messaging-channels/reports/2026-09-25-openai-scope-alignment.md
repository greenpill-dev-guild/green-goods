# OpenAI processing, reporting routes and current account scope

**Date:** 25 September 2026. Supersedes conflicting provider/account wording in the preceding alignment.
**Status:** user decisions recorded; documentation only. No runtime changes, installations, external uploads or wallet operations.

## Accepted decisions

- OpenAI handles content processing: conversation, structured extraction, document/photo interpretation and voice transcription. Jev remains the typed decision evaluator. Green Goods owns durable state and authorization.
- Browser routes are `/agent/reporting/:requestId` and `/agent/reporting/recover/:requestId`. Both retain the PWA design system and work independently of message platform. Source-channel proof remains specific to the initiating request.
- Automatic conversion of Office visuals to PDF/images is included. Asking for an export is the failure fallback, not the normal journey.
- The entire passkey-first account model with optional Profile wallet linking is future work. Existing EOA and Kernel passkey accounts are the current paths, including exact signing and separately scoped Kernel report/review permissions. No new account or migration is required.

## Established capability and design limits

[OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs) include PDF page images, but native non-PDF inputs omit embedded visuals. Native spreadsheet augmentation covers a bounded row subset. Exact XLSX/CSV parsing and code-owned totals therefore remain required, alongside conversion for visuals. [Audio transcription](https://developers.openai.com/api/docs/guides/speech-to-text) has documented container limits; normalize unsupported WhatsApp audio before uploading. These are capability facts, not measured quality results.

[LibreOffice batch conversion](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html) supports the recommended conversion direction. Its headless flag does not provide a security sandbox. Pin and prove a restricted worker, PDF inspection/rendering, permitted-content coverage and cleanup. Account for recalculated formulas and layout differences; converted visuals never replace original cell provenance or validated arithmetic.

## Current specification

The [technical brief](../technical-brief.md) owns the current contracts and dependencies. Its section 14 records the future account model separately. The current ERD omits the speculative account-usage field, and wireframes offer existing account methods without requiring passkey-first onboarding.

Models, conversion binaries, custody integration, provider settings and deployment details still require implementation proof. The API harness remains the first build phase, with deterministic OpenAI/Jev/converter fixtures and a separate live quality/compatibility evaluation.
