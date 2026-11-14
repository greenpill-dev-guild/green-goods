# Continue Grove

**State as of 13 November 2026:** capture → review → share remains the product loop. Solid is now the preferred optional storage adapter, with client-side encryption; Yjs is preferred for optional co-editing, with verified writers. Community/member identity and private keys remain local. EDV and Automerge + Keyhive stay research alternatives; Keyhive is experimental and synthetic-data-only. C0a/E24 passkey/offline unlock/recovery and all other runtime gates remain unrun. This updates the idea-stage design, not application behavior.

## Start here

Read the [brief](../brief.md), [architecture](../spec.md), [community-sharing contract](../community-sharing.md), [flow diagrams](../architecture-flows.md), [source-backed research](../sharing-research.md), [C0–C6 delivery order](../plan.todo.md#community-sharing-delivery-order) and [acceptance gates](../eval.md#community-sharing-gates). The earlier prototype, first spike and KOI contract are labeled baselines where their scope differs.

Remain on the current checkout/branch unless explicitly authorized otherwise. Inspect current instructions and status before editing; unrelated concurrent edits were present during this revision. Do not recreate a second Grove hub, install dependencies, change runtime code or publish externally from this planning request.

## What exists and what remains unbuilt

The immutable [24 October G0 report](../reports/2026-10-24-g0-feasibility.md) records synthetic desktop graph/model feasibility, in-memory Pi recovery and a WebMCP fixture. It does not establish phone performance, actual Hub integration, persistent Pi tab-close recovery, local vault protection or private community sharing. Product lanes and all 18 S/P/K checkpoints remain unchanged; C0–C6 and E15–E21 are newly planned and unrun.

The five existing Linear A0–A4 milestones and parent-only RESR-103 metadata remain historical coordination state. No Linear query/write or sync confirmation was performed for this revision. Reconcile externally only under an accepted coordination/execution scope; do not advance lastSyncedAt from local edits.

## Follow-up accepted in this session

C1a/E22 specify the [two-device storage spike](../storage-comparison-spike.md), now validating preferred optional Solid first and retaining EDV as research. Independent local keys, recovery, scoped permissions and host privacy remain hard gates. Record actual library reuse, Grove-owned code, services, licences and bundle cost. No experiment or installation ran.

The [identity/role mapping](../identity-role-mapping.md) distinguishes community versus member accounts, scoped roles, private associations and explicit key grants; E23 adds deny-by-default bridge cases. Existing six protocol roles remain authoritative; student/learner is proposed local context only.

The [local-first shortlist](../local-first-options.md) keeps Dexie/encrypted records as the baseline and now names Yjs as preferred for optional co-editing. Automerge + Keyhive remains an experimental research alternative, with its own recovery/security limits. Loro and Classic/current Jazz observations remain research only. No candidate was installed or proven ready.

The [Pi refresh](../durable-execution.md#research-refresh-13-november-2026) inspected a 1.5.2 upstream source manifest, not a release/install pin. Capture saving and human review do not depend on Pi. Pi resumes enrichment/review preparation using references and idempotent domain receipts. Deferred progress is not an acknowledgment of a durable save.

Interactive companion: synthetic identity/role map shown in this chat. DOM-simulated interaction and 320/520/736 geometry checks pass; browser rendering remains unverified. The preview helper could not bind a sandboxed loopback server; browser security then rejected file-protocol navigation. No workaround or additional browser surface was used. The local modern-web-guidance command also hit a network allowlist block; semantic/native controls and repository guidance were used without a package refresh.

## Latest accepted comparison scope

[The comparison contract](../collaboration-passkey-spike.md) owns two independent passes. **C0a/E24** tests the actual existing credential/RP/account recipe, PRF availability, blocked-network lock/reopen, unsupported/cancelled unlock, device and credential loss, protected export and revoked-device readmission. A synced passkey is not a device identity; local recovery does not prove Ethereum account recovery. Keep an independently proven local unlock/recovery path when existing-passkey reuse fails.

**C5/E20** proves preferred optional Yjs co-editing only when needed; **E25** retains the same two-device synthetic comparison with Automerge + Keyhive as independent research. Test recipient-side writers/admins, offline edits/restarts, revocation, history/presence, recovery and host migration. A successful merge cannot satisfy confidentiality or authorization. Alternative research does not block a passing Yjs slice.

Keyhive's inspected core warns against production use and records unresolved revocation gaps; the integration guide describes no recovery and full history for new readers. Exact packaged-version applicability is unverified. Keep it experimental and synthetic-data-only even if the happy path succeeds. No package was installed or experiment run. Prior observations below remain historical evidence, not completion of the new gates.

## Next bounded work

Scope **C0 identity/pairing/recovery** and **C1 envelope/key custody** before private use. C0a proves existing-passkey/offline unlock/recovery. For hosted storage, validate preferred Solid in C1a/C3; EDV remains research. For optional co-editing, validate Yjs in C5/E20; retain experimental Automerge + Keyhive comparison under E25. Start with synthetic fixtures and keep local/direct capture → review → share complete without either optional feature.

The first complete experience needs no wallet, provider login or model to capture and review. Pair a phone companion and desktop extension, share one selected encrypted capture with an authorized reviewer, and produce a separately approved partner summary. Prove unauthorized-device and operator views. C3 adds Solid/EDV storage only if justified and selected; C4 proves actual networking/device support. C5 compares Yjs/Automerge + Keyhive as research; production co-editing and MLS remain conditional. External associations and public release are optional C6 work, with no public upload or chain transaction authorized here.

## Evidence that affects implementation

- Coop source pin is `901f57871ec578b0a31bb38c1eacdd0a85eed83a`. Local encrypted payloads/redacted records are useful patterns, but the wrapping secret is in the same DB. Its server-side Y.Doc sees ordinary synced content. HMAC receiver frames authenticate without encrypting. Do not import these as proof of Grove E2EE.
- Solid runs as a client in the extension; a conventional Pod runs separately. Local DIDs need explicit service-principal associations. Pod ACLs never confer decryption grants.
- WebRTC needs authenticated signaling and may need STUN/TURN. Prove LAN-only operation separately. Web Bluetooth is for supported GATT peripherals, not a general phone/browser mesh. Encrypted files remain the offline fallback.
- No Yjs document is shared more broadly by filtering its current visible state: historical text may remain. Create fresh audience-scoped projections/documents. Keep governance and signed writer authority outside CRDT state.
- Existing Green Goods uploads data before its onchain Work submission. Public-release review belongs before the first upload. Verify contract accounts through ERC-1271 and actual garden roles; Certified's inspected EVM-link schema is EOA-only.
- Exact source licensing, trusted phone app/update delivery, crypto-library maturity and browser support remain prerequisites. The source note distinguishes established behavior from inferred design and unresolved proof.

## Validation and phase record

Validation passed: `node scripts/harness/plan-hub.mjs validate` validated 32 hubs; the QA selector selected formatting only for the 16 Grove paths; its local Biome formatting command passed after formatting status.json. Focused checks resolved 142 local links/anchors, preserved lane/Linear values and found unique unchecked C0–C6 and E15–E21 entries. Installed Mermaid 11.17.2 parsed all eight diagrams in architecture-flows.md/spec.md. `git diff --check -- .plans/ideas/grove` passed. Initial formatter and sequence-syntax failures were corrected before these final passes. No dependencies were installed. No application UI changed; rendered Grove runtime proof for this revision: **none**. The Mermaid diagrams describe a proposal, not a working network.

Task record: Grove community sharing | Type: guidance/investigation | Outcome: complete (plan revision)
Agent/model: Codex / unknown | Coverage: this plan revision

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-11-13 09:08:37 → 09:15:00 | Existing hub, current Green Goods boundary, pinned Coop source and primary standards research. |
| Implement plan | 2026-11-13 09:15:00 → 09:30:00 | Current contract, diagrams, research, checkpoints and historical scope boundaries; no runtime edits. |
| Verify | unknown → 2026-11-13 09:30:00 | Hub, links, scope/state, format, diff and Mermaid syntax checks above passed; runtime gates remain unrun. |


### Follow-up verification record

Task: Grove storage spike, identity/roles and local-first/Pi research | Type: planning/research | Outcome: plan and interactive explanation complete; runtime experiments unrun.
Agent/model: Codex / unknown. Coverage: this follow-up. Working-copy evidence, base HEAD `a0d503abc`, with prior Grove edits and unrelated checkout changes present; no commit-attributed implementation receipt.

| Phase | Observed interval (UTC) | Evidence / limit |
|---|---|---|
| Investigate | 2026-11-13 09:56:24 → 10:00:00 | Current role implementation, primary sync-library sources and Pi upstream source; detailed edits followed as research narrowed. |
| Implement plan/visual | 2026-11-13 10:00:00 → 10:15:23 | C1a/E22/E23, identity-role mapping, package shortlist, Pi phase contract and synthetic interactive map. No runtime/dependency changes. |
| Verify | start unknown → 2026-11-13 10:15:23 | `node scripts/harness/plan-hub.mjs validate`: 32 hubs; focused local-link/anchor script: 181; installed Mermaid 11.17.2: 10 diagrams; QA selector for 19 Grove paths selected formatting only (`automatic-hygiene`); local Biome format passed; diff check passed. Interactive DOM simulations cover role combinations, independent key grants, account/protocol-proof gating, public association state, state saving and 320/520/736 widths with 14/20 font sizes. Browser rendering blocked as described above; no authenticated or product runtime proof. |

All C/E experiment checkpoints remain unchecked/unrun. No Linear write or sync confirmation, branch switch, dependency install, deployment or public identity binding was performed.

### Passkey and collaboration planning verification

Task record: Grove two-device collaboration and passkey comparison | Type: planning | Outcome: complete (plan only)
Agent/model: Codex / gpt-6.1-sol | Coverage: this follow-up, existing dirty checkout at base HEAD `a0d503abc`; no commit-attributed runtime receipt.

| Phase | Observed interval (UTC) | Evidence / limit |
|---|---|---|
| Investigate | 2026-11-13 21:54:04 → 21:55:24 | Existing hub/role contracts, current WebAuthn/Kernel construction and prior source-backed Keyhive/Yjs research. |
| Implement plan | 2026-11-13 21:55:24 → 22:00:09 | Added comparison contract, C0a/E24, revised C5/E25, optional storage boundaries and consistent plan links. No runtime/account/dependency changes. |
| Verify | 2026-11-13 22:00:09 → 22:01:41 | `node scripts/harness/plan-hub.mjs validate`: 32 hubs. Focused checker: 233 local links/anchors across 26 Markdown files, balanced fences, unique pending C0a/C5/E24/E25 and unchanged lane/Linear metadata. Installed Mermaid 11.17.2 parsed 10 diagrams in the four touched diagram files; syntax proof only. QA selector for the 13 explicit Grove paths selected formatting only (`automatic-hygiene`); local Biome formatting passed after formatting status.json (Markdown is not supported by that formatter). Initial selector argument syntax was corrected to comma-separated paths. Final diff/link consistency checks follow this record; no browser or product experiment proof. |

Human corrections: 0 observed in this segment; attention: unknown. All experiment gates remain unrun. No dependency installation, public identity binding, account migration, chain transaction, external tracker write or branch change occurred. Grove runtime rendered proof: **none**, as this revision changes plan documents only. Keyhive remains experimental and synthetic-data-only; Solid/EDVs remain optional.

### Preferred adapters: plan and visual verification

Task record: Grove preferred Solid/Yjs adapters | Type: planning/visual | Outcome: complete (design update)
Agent/model: Codex / gpt-6.1-sol | Coverage: this follow-up; dirty working copy at base HEAD `a0d503abc`, no commit-attributed implementation receipt.

| Phase | Observed interval (UTC) | Evidence / limit |
|---|---|---|
| Investigate | 2026-11-14 00:38:04 → end unknown | Current hub, prior accepted research and scoped worktree state; preference is the user's decision. |
| Implement plan/visual | start/end unknown | Solid preferred optional storage, Yjs preferred optional co-editing, local identity/keys and research alternatives reflected across 12 plan paths and the architecture view. Old view state clears example approvals when migrating to version 2. No dependency/runtime changes. |
| Verify | start unknown → 2026-11-14 00:50:56 | `node scripts/harness/plan-hub.mjs validate`: 33 hubs. QA selector for 12 explicit Grove paths selected only `format` via `automatic-hygiene`; selected Biome command passed (one supported JSON file; Markdown unsupported). Focused checker: 229 local links/anchors, balanced fences, pending gate IDs, unchanged lanes/Linear. Installed Mermaid 11.17.2 parsed nine diagrams in architecture-flows/spec/comparison. Eight DOM viewport/font simulations plus legacy/current state cases passed. Clean-room Brave rendered desktop light and 360px dark views; native controls verified preferred Solid default, preferred Yjs selection, EDV research label and approval reset. Browser reconnects required fresh isolated pages; this is explanatory-view proof, not authenticated Grove runtime or actual phone proof. |

Human corrections: 0 observed in this segment; attention: unknown. Solid/Yjs preferences do not complete any privacy, recovery, phone or production gate. EDV and Automerge + Keyhive remain research alternatives, Keyhive experimental/synthetic only. No installation, account migration, branch change, chain/public upload or Linear sync occurred. Final diff/state/format checks follow this record.

### Publication preparation

The user authorized commit and push of the Grove updates on 13 November 2026. The [standalone architecture page](../artifacts/demos/grove-architecture.html) and [editable fragment](../artifacts/demos/grove-architecture.fragment.html) are now included in the hub, with the demo index updated. They contain synthetic display state only, no live keys or private account bindings. The exported copy uses only widget-state APIs from its host integration.

Publication scope is the Grove hub only; unrelated application and infrastructure edits in the shared checkout are excluded. Current branch: `fix/work-approval-feedback`. No open PR exists for that branch. The live GitHub connector reports develop at `3ee6594ef3e5a7259881119e5c6a9fa3f4e2833b`, matching the existing local remote-tracking ref. Git network fetches over SSH and HTTPS were blocked by the execution environment; the connected GitHub integration is the publication fallback. Commit, exact-tree push-gate evidence and remote verification will be reported in chat after execution. This preparation record does not claim a successful push or CI readiness.
