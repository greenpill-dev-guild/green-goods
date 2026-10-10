# WhatsApp technical brief — architecture review

**Date:** 25 September 2026. **Intent:** evidence review with user-authorized document fixes.
**Scope:** the current technical brief, wireframe semantics, generated HTML content, and their Plan Hub pointers. Runtime source was read for compatibility evidence; no runtime implementation was changed.
**Repository baseline:** `da329c99e556ad248dded850efc1f8e6cc0c75be`, with uncommitted documentation changes. This is a working-copy review, not a reviewed release commit.

## Coverage

| Batch | Coverage | Result |
| --- | --- | --- |
| Agent and data | Sections 1–6: scope, ownership, dependencies, state, Jev and ERDs | Read in full; publication ownership, persistence records and lifecycle gaps corrected |
| Client and identity | Section 7: routes, dependencies, six wireframes, three client machines | Read in full; session bootstrap, transport, private access and queue integration corrected |
| Execution and operations | Sections 8–13: all sequences, sessions, processors, failure/recovery, delivery and acceptance | Read in full; receipt matching, retries, recovery races and launch prerequisites corrected |

The user's settled constraints remain: WhatsApp-first reporting/review, browser ceremonies without installation, ordinary wallet signing, DM-first demo recorded through WhatsApp Web, Green Goods product identity, WEFA's WhatsApp operations, and no account upgrades or unattended signing.

## Findings and closure

### 1. Publication and client integration — high

The original draft combined Agent media ownership with a browser-upload sequence and described the existing work queue as directly reusable. That queue calls an encoder that uploads files, and its persistence includes private draft data. Reusing it unchanged could duplicate preparation or sign a payload different from the confirmed server revision.

**Evidence:** `packages/shared/src/modules/job-queue/job-executors.ts`, `types/job-queue.ts`, `utils/eas/encoders.ts`, `modules/data/ipfs/upload.ts`; `packages/agent/src/services/pinata-upload-signer.ts` issues upload URLs, not a complete server publication pipeline.

**Closed in the proposal:** Agent-owned sanitized upload; versioned immutable envelope; independent browser validation; explicit Shared preparation adaptation; minimal client send checkpoints; fixed role/action checks; reuse of TransactionSender and sendWithCheckpoint. Removed the leftover optional-relay paragraph. A wallet attempt freezes the revision because changing a server record cannot cancel an already-open wallet prompt.

**Sibling review:** the current JobQueue provider restricts automatic flush to commitment jobs, so this review does not claim existing work automatically sends. The ceremony must also avoid mounting unrelated commitment execution. Existing send checkpoints and ownership guards are reuse evidence, not proof that the new ceremony is implemented.

### 2. Identity, sessions and deployment — high

The brief assumed a same-origin gateway without defining it. It omitted how a browser resumes pairing without letting a forwarded URL redeem another browser's session. Recovery suspension also lacked an explicit authenticated-owner condition.

**Evidence:** `packages/client/vercel.json` currently has a static SPA catch-all and no WhatsApp API proxy; `routes/WalletRuntimeProviders.tsx` includes PWA identity analytics; `routes/Root.tsx` emits pageviews. The garden-join auth route supplies signature verification and nonce claiming but owns a different proof envelope.

**Closed in the proposal:** fixed `/api/whatsapp/*` proxy; Agent-issued host-only cookies; bounded bootstrap and pre-authentication cookie; signed browser nonce; CSRF and exact Origin checks; atomic one-use proof consumption; scoped pairing status; owner-authenticated recovery with epoch comparison; reviewer access limited to published work and their own intent. Added private media and attempt-reservation endpoints and analytics exclusions. Direct route trees, presentation loaders and SPA rewrite precedence remain explicit implementation work.

### 3. Outcomes, state and operational consistency — high/medium

“Receipt verified” lacked a complete acceptance contract. Several machines omitted unknown-send, rejection, upload failure and reorganization paths. Database diagrams lacked outbound destinations and some attempt context. Decision sequence semantics assumed more than the current resolver guarantees.

**Evidence:** `packages/contracts/src/resolvers/Work.sol` requires membership, action timing/domain and required fields. `WorkApproval.sol` rejects self-review, requires an active action, never revokes decisions, and increments decision sequences only when the commitment module is configured. `modules/work/send-with-checkpoint.ts` distinguishes definitely-not-sent from may-have-sent.

**Closed in the proposal:** receipt/emitter/schema/attester/payload matching; current canonical-chain inclusion distinguished from L1 finality; bounded lost-hash reconciliation; immutable attempt history; no retry on uncertainty; reorganization transitions; advisory review sequence with event-order fallback; late-message/prompt rules; fenced leases; explicit destination records; realistic outbox delivery limits; pre-consent quarantine; backup/key/migration requirements and model failure/locale bounds.

## Requirement closure

| Requirement | Document status | Remaining proof |
| --- | --- | --- |
| WhatsApp reporting, correction and human review | SATISFIED in design | Real Meta DM exchange and role-correct work/review receipts |
| Browser routes, client dependencies and wireframes | SATISFIED in design | Implement routes, provider composition and exact-send path |
| General wallet signing without account upgrades | SATISFIED in design | Installed wallet and phone/desktop compatibility |
| Authentication, grants and relinking | SATISFIED in proposed contracts | Proxy/cookie, CSRF, pairing, recovery and concurrency tests |
| State machines, ERDs and sequences | SATISFIED as architecture artifacts | Implement migrations, guards and durable jobs |
| Green Goods identity / WEFA WhatsApp role | SATISFIED in document | Confirm real operating terms and participant notices |
| Demo account onboarding | BLOCKED on product choice | Existing enrolled users, or include account creation and joining |
| Agent interpretation providers | Defined boundary; selection pending | Select/evaluate Jev and extraction model versions and processor terms |
| Production/runtime readiness | OUT_OF_SCOPE for this review | Implementation, deployment and live acceptance |

## Safety facts

- **Human signing authority remains with the actual account.** Proof level: PATH_TRACED through TransactionSender, work/approval builders and resolvers. This does not establish a successful transaction for the supplied wallet.
- **Unknown sends must reconcile before retry.** Proof level: PATH_TRACED through sendWithCheckpoint and both work/approval executors. The proposed Agent/browser bridge has not been executed.

## External evidence and limits

TypeSafe's current State documentation still describes text/JSON judgment input and lower non-English accuracy. Vercel's rewrite documentation supports external-origin routing; it does not prove this project's cookie/header behavior. The Meta webhook reference could not be opened in this review; live provider conformance remains a required gate. The previous group-provider research is historical context and is outside the selected DM implementation.

No authenticated browser, Meta sender, deployment secrets or live wallet were exercised. Earlier browser rendering was blocked by the unavailable approval-review capability; this review does not retry or present static checks as browser proof. The HTML retains dark mode and local rendering, with PDF/interactive visual verification still unproven.

## Verification performed

- `node /private/tmp/check-gg-mermaid.mjs`: all 17 current diagrams parsed with the installed Mermaid library.
- `node scripts/harness/plan-hub.mjs validate`: 27 Plan Hubs validated.
- `bun run check --plan -- --intent review --base HEAD` and the matching execution: eight documentation/artifact paths; no runtime checks selected.
- Direct link check: 79 local documentation targets exist.
- Generated HTML checks: valid JavaScript, title first, section anchors, 17 diagrams plus the wireframe figure, no external renderer script; System/Light/Dark selection and saved preference checked using JSDOM.
- `git diff --check`: no whitespace errors.

These are syntax, structure and source-compatibility checks. They do not prove browser layout, PDF output, provider conformance, privacy-policy acceptance, wallet execution or chain finality.

## Verdict

**COMMENT_ONLY — evidence review, with identified specification gaps corrected.** No unaddressed contradictory publication/session path remains in the reviewed current brief. The open onboarding decision and external setup/compatibility gates prevent an implementation-readiness or production approval. This review cannot guarantee the absence of unknown issues.

Review evidence recorded at 2026-09-25T07:49:05.265210+00:00. Technical brief SHA-256: `c4ddfb3e37380f2eebf295c15dab64d225eef7fd7c9e3234451f11114e224924`.
