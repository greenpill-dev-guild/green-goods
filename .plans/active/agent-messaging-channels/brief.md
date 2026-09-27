# WhatsApp impact reporting

> **Accepted review decisions, 26 September:** Afolabi ([afo@wefa.world](mailto:afo@wefa.world)) owns prototype support; Opus 5.5 builds and Astra reviews. Current handoffs are reconciled locally; the tracker/start gate remains before implementation. Durable terminal outcomes, dispatch-time publication controls, stable identity under key rotation and deployed privacy/configuration proof are required. See [current delivery](plan.todo.md#current-build-sequence) and [failure/operations contracts](technical-brief.md#11-failure-and-recovery-contract). No runtime proof or task dispatch is claimed.


**Status:** ACTIVE architecture work; implementation lanes remain blocked and unproven.
**Last updated:** 26 September 2026
**Product:** Green Goods. WEFA operates the initial WhatsApp integration.

**Current architecture:** [Technical brief, dependencies, state machines, ERD and sequences](technical-brief.md).
**Earlier research and slice:** [Specification history](spec.md).
**Delivery and proof:** [Plan](plan.todo.md), [acceptance](eval.md), [execution state](status.json).

## The experience

Gardeners report their work through the Green Goods WhatsApp agent. They send descriptions, photos, documents and spreadsheets, answer only the missing questions, correct the draft and confirm the exact report in chat.
Stewards discuss and prepare approval or rejection in WhatsApp. The browser is used for account
linking, application access, recovery or the final signature when needed. PWA installation is never
required.

The current prototype supports existing EOAs and existing Kernel passkey accounts. Creating a
passkey-first account for every user and adding an EOA from Profile are future work only. Linking a
messaging channel does not create a wallet, grant garden membership or transfer signing authority.
Work remains attributed to the gardener; review remains attributed to the steward.

## Accepted direction as of September 25

- A DM-first hackathon is acceptable. Recommend the existing Meta Cloud API direct path, with the
  selected TAS or Aiyeloja Family Garden confirmed in each report. An existing group is no longer a
  requirement for the demo, and a smaller group alone does not establish Groups API eligibility.
- EOAs sign exact publications and reviews. Existing Kernel passkey users can grant limited reporting
  permission and a separate review permission, then confirm each action in chat. Prove compatibility
  before enabling either grant. No EIP-7702 account upgrade. Record through WhatsApp Web.
- WEFA operates the WhatsApp integration, including its processor arrangements and
  participant support. Green Goods remains the product. Each garden's authorized stewards provide community context and review.
- Future groups are garden-scoped. A steward can authorize binding or changing a group's garden.
  Changes preserve existing drafts and published history.
- Recovery/relinking is required, while total loss of a wallet signer remains that wallet's recovery
  problem. Phone access cannot recover an EOA key.
- Jev-assisted interpretation is part of the target design. Green Goods owns durable state and
  authorization. Jev supplies bounded judgments; a separate model can extract open values and write
  conversational responses. The existing Action.inputs declaration remains the field contract.

## Recommended implementation path

Start with a synthetic message/API harness driving the real coordinator and SQLite. Add story-first
reporting, DM intake, public ceremonies and verified receipts. Prove Kernel permission setup, bounded
execution and revocation; retain exact owner signing as an explicit alternative. Add relinking. Enable Jev and OpenAI content processing
only after the applicable WEFA processing arrangements are settled. Document, visual and spreadsheet processing are required. Voice support has a separate proof requirement.

The technical brief proposes two reusable PWA-style browser view families, an explicit new-dependency
inventory, six platform-neutral wireframe states and account/access, grant, execution and recovery machines. API access
is scoped and temporary; it is separate from Kernel execution permission. Permission is offered when
first submitting or reviewing, after the person understands the action it enables.

## Remaining gates

The architecture document does not establish a working provider, a wallet ceremony, account roles,
a chain transaction or an installed new dependency. The selected garden, Meta provisioning, desktop and
mobile wallet handoff, processor terms and real-device/chain acceptance all need proof. Local draft-data retention is accepted; minimal audit/backup retention, provider settings and browser
access durations still require operational configuration.

The current lane handoffs now follow the technical brief. Opus 5.5 is assigned to build and Astra to review; existing Linear records still need the start-gate reconciliation before dispatch. No external tracker record was changed. The earlier no-model slice remains useful as a deterministic fallback; it
must not be presented as the complete conversational product now requested.

## Architecture review

The [September 25 review](reports/2026-09-25-architecture-review.md) corrects publication ownership,
prepared-payload reuse, cookie/proxy setup, receipt matching and recovery/concurrency boundaries in
the current technical brief. The user selected pre-enrolled participants; the reporting demo uses prepared accounts and verifies their actual roles. The newer passkey-first product direction is recorded below. TAS and Aiyeloja Family Garden are the prototype choices. Runtime lanes remain
blocked on tracker/start-gate reconciliation; ownership is assigned and implementation proof is still pending.

The [prototype garden decision](reports/2026-09-25-prototype-garden-decision.md) closes the review's onboarding question. WhatsApp linking and recovery remain in scope; each garden's membership is checked independently.

The [account and conversation amendment](reports/2026-09-25-account-and-conversation-amendment.md) records the latest research, ERD simplification tradeoffs and future personal EOA/passkey association. No runtime code or dependencies changed.

## Latest alignment

The API harness remains the first implementation phase. OpenAI is selected for document/visual
interpretation, conversation and voice transcription; exact spreadsheet parsing and arithmetic stay
in code. No external OCR provider is planned. Jev retains its typed decision role; automatic Office conversion is included. Use
`/agent/reporting/:requestId` and `/agent/reporting/recover/:requestId` across messaging platforms.

Passkey-first onboarding and optional Profile wallet configuration are entirely future work. The
current reporting flow uses proven existing EOA or Kernel accounts and their actual garden roles.
See the [scope clarification](reports/2026-09-25-openai-scope-alignment.md).

## Final review closure — 26 September

The [final review](reports/2026-09-26-final-brief-review.md) aligns the ERDs with required proof and
review content, specifies recovery/grant API commands and handoff behavior, and separates the API-harness
milestone from live release gates. The user accepted reporting grants of 24 hours/5 submissions,
review grants of 1 hour/5 decisions, a 24-hour pre-consent expiry and 7-day inactive-draft expiry,
plus private-source cleanup after publication/reconciliation. Measured gas caps and the minimal
audit/backup schedule remain required before their live stages.

The [accepted review decisions](reports/2026-09-26-accepted-review-decisions.md) record the support contact, Opus 5.5/Astra responsibilities and the updated outcome, identity, deployment and dispatch contracts.
