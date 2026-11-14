# Continue: Green Goods, fully local, with Grove

**State as of 14 November 2026:** two independent reviewers examined the architecture and MVP, and the owner settled ten decisions on the architecture and then five on what the agent does. Later the same day the owner corrected the framing: the project makes Green Goods work in a fully local environment with a phone, a browser and an extension, and Grove is only the extension (D31 to D36). The owner then answered eight questions that set the plan's shape (D37 to D44), and the plan is now reworked function by function. The hub's documents and the architecture page carry all of it. Nothing is built beyond the disposable G0 spike, and every gate is unrun. The work sits on the branch `research/grove-architecture-alignment`.

## Start here

Read [spec.md](../spec.md) first. It holds the MVP contract with its nine function blocks, a table of each Green Goods function's local form, and the one decision log: decisions D1 to D45, recommendations R1 to R19, assumptions W1 to W4 and open questions O1 to O18. Then read the [sharing contract](../community-sharing.md), the [flows](../architecture-flows.md), the [MVP order](../plan.todo.md#mvp-order) and the [gates the MVP needs](../eval.md#which-gates-the-mvp-needs). The [architecture page](../artifacts/demos/grove-architecture.html) shows the same model as one page.

Remain on the current checkout and branch unless explicitly authorized otherwise. Inspect current instructions and status before editing. Do not create a second hub, install dependencies, change runtime code or publish externally from a planning request.

## Decided on 14 November

- The project makes Green Goods work in a fully local environment, with just a phone, a browser and an extension. All current Green Goods functionality works there in essence (D31).
- Grove is the extension, and only the extension: knowledge capture and agentic flows that give insights and structure data, on the device and across a mesh of devices (D32).
- Locally a community is its Garden, with Green Goods' own roles, Actions, work reports, approvals, assessments and promises (D33). This supersedes D23.
- Work and promises can be reported free-form or through the existing screens (D34).
- An agent structures a free-form report or promise at any review on a laptop (D35), into the existing report contract and promise fields (D36).
- The gardener app and the steward cockpit gain local operation together, so every current function is available locally from the first version (D37).
- A new garden starts fully locally; an existing garden is brought local with one connected read of its public roles, Actions and current assessment (D38).
- The plan follows the Green Goods chain: Actions and assessment, work, approval, the report; then promises, joining and roles, and money and certificates (D39).
- Money and certificates are recorded now and settled when connected (D40).
- On a laptop, Grove works beside the app's screens through a bridge limited to the Green Goods pages, and keeps its own page for the graph (D41).
- Carried files come first; direct sync between open devices is the next lane, ahead of the hosted mailbox (D42).
- The garden's current assessment is the agent's focus, with extra topics a steward may add (D43).
- Local operation lives in separate local builds of the app and the cockpit, with no analytics and no hosted calls (D44).
- A steward can include an approved work report in a report to a funder or partner on the steward's approval alone (D45).
- The phone and the extension ship together (D2). The phone runs Green Goods itself.
- The author approves every share of their own capture, and again if a corrected version leaves the community. A steward approves partner summaries and public releases (D17).
- One steward signs member and device changes, with a recovery code at setup and a second controller before real data (D18).
- The existing passkey unlocks the vault where its provider supports it; a passphrase does otherwise. C0a is a gate (D19).
- "The operator cannot decrypt" covers storage and relay hosts. Green Goods is trusted as publisher of the client code (D20).
- Encrypted files carry records in the MVP; a hosted mailbox with Solid preferred is a later lane (D21).
- The MVP graph shows the records held on the device; the Hub snapshot and KOI exchange are next lanes (D22).
- A device stops sharing when its member list is older than seven days, adjustable per community (D24).
- The graph, Gemma suggestions and Pi investigations stay in the MVP (D14, D25).
- The agent captures relevant knowledge and resources as a person uses their browser, and brings them in for that person to review and then share (D26).
- It may read every page visited, except private windows and a block list of sensitive sites (D27).
- A person reviews everything it brings in and can discard it. The agent brings in only what it judges relevant, never something it would recommend discarding (D28).
- Its assessment first covers why an item was brought in, its source, author and date, and whether it is safe to share (D29).
- The steward writes the garden's focus locally (D30).

## Next bounded work

Each step needs its own authorization before anything is installed or built.

1. Two owner decisions unblock the build: the exact addresses of the local builds (O2), and whether any Coop code may be copied (O5).
2. Three questions from the reframing stay open. Design settles how local records map onto the onchain ones when published (O16) and which side holds a garden's keys on a laptop (O17, in C9). E29 answers whether a small local model can structure a report well enough (O18).
3. **C0b**, then **C0a**. Both are experiments on a physical phone and laptop and need no protocol code. C0b decides which phones may hold keys. C0a decides who gets passkey unlock and who gets the passphrase.
4. **P0** alongside: the Pi tab-close proof on persistent storage, which the G0 spike left owed and nothing blocks now.
5. Then C7, C1, C0, recovery, C8, and the function blocks F1 to F7 with C2, in the [MVP order](../plan.todo.md#mvp-order).
6. The agent's checkpoints, S13 to S16, and the bridge, C9, belong to Grove's lane. S14 asks for access to all sites, a manifest change that needs its own review (O12).

The recommendations R1 to R19 in the decision log are advice from the review. None is decided. R2 (no identifier scheme in the MVP) and R3 (the member list's shape) change what C0 builds and should be confirmed or rejected before C0 starts. O8, what limits code updates to the Green Goods app, must be answered before any sensitive record is admitted.

## Validation and phase record, 14 November

Checked on the working copy, develop `3ee6594ef` plus this hub:

- `node scripts/harness/plan-hub.mjs validate`: 31 hubs validated.
- A local link and anchor checker over the hub's 26 Markdown files: every local link resolves. `check-guidance-links.mjs` and `check-immutable-plan-reports.mjs` pass. Before the edits, one link pointed into an uninitialized submodule; it now points upstream at the pinned commit.
- All 26 Mermaid diagrams parse with Mermaid 11.4.1, and the new or changed ones were rendered and looked at. Two diagrams in `prototype-architecture.md` failed to parse before; a semicolon in each was the cause and both are fixed.
- The architecture page was rendered in a browser pane from a local static server (isolated profile, not authenticated): desktop in light and dark, and 360 px wide. Stepping by button, by menu and by keyboard works; the nine steps, including the agent's, highlight the right parts; the later-work toggle shows and hides seven items; there are no console messages, no request beyond the page itself and no stored state. Computed contrast is at least 5.4:1 for text and 3.6:1 for control borders in both themes.
- Draft PR #1601's checks were green at `175d3051f` when read; they do not cover these edits.
- After the reframing later on 14 November: all 27 Mermaid diagrams parse, and the seven changed or new ones were rendered and looked at. The architecture page was rendered again in the same pane: its ten steps highlight the right parts, at desktop width in dark and 360 px wide in light, with no console messages.

Not checked: a screen reader, forced-colors mode, a real phone, GitHub's own Mermaid rendering, Linear, and any gate in [eval.md](../eval.md). No experiment was run. The outside facts in [dependencies](../dependencies.md#versions-maturity-and-licenses) were read by a reviewer on 13 November except where a row says it was verified on 14 November.

Task record: Grove architecture review (PR #1601) | Type: review and guidance | Outcome: complete (documentation aligned; no gate run)
Agent/model: Claude Code / claude-fable-5-2, with reviewer subagents claude-opus-5-5 and claude-fable-5-2 | Coverage: this session

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | 2026-11-14 02:17 → 03:48 | Hub and code read; two independent reviews; code and source re-checks |
| Wait | 03:48 → about 04:58 | Ten owner decisions, in two rounds of five |
| Implement plan and visual | about 04:58 → 05:21 | Documents aligned; architecture page rebuilt as one self-contained file |
| Verify | 05:13 → 05:23 | Hub validator, links, diagrams and rendered page, as listed above |
| Wait | 05:27 → 06:15 | Commit signing locked until the owner unlocked it; five agent decisions settled meanwhile |
| Implement plan and visual | 06:17 → 06:22 | Agent decisions written into the hub and the architecture page |
| Verify | 06:20 → 06:22 | Validators, links, diagrams and rendered page; the push gate runs after the commit |

Human corrections: 1 observed, on scope: the first alignment left passive capture out of the MVP and defined no assessment step, and the owner restored both. Three recommended defaults were also declined in favor of the fuller plan. Attention: unknown.

## Earlier records, 13 November

These records are kept as written, with one dead link removed. Where they differ from the sections above, the sections above govern.

### What exists and what remains unbuilt

The immutable [24 October G0 report](../reports/2026-10-24-g0-feasibility.md) records synthetic desktop graph/model feasibility, in-memory Pi recovery and a WebMCP fixture. It does not establish phone performance, actual Hub integration, persistent Pi tab-close recovery, local vault protection or private community sharing. Product lanes and all 18 S/P/K checkpoints remain unchanged; C0–C6 and E15–E21 are newly planned and unrun.

The five existing Linear A0–A4 milestones and parent-only RESR-103 metadata remain historical coordination state. No Linear query/write or sync confirmation was performed for this revision. Reconcile externally only under an accepted coordination/execution scope; do not advance lastSyncedAt from local edits.

### Follow-up accepted in this session

C1a/E22 specify the [two-device storage spike](../storage-comparison-spike.md), now validating preferred optional Solid first and retaining EDV as research. Independent local keys, recovery, scoped permissions and host privacy remain hard gates. Record actual library reuse, Grove-owned code, services, licences and bundle cost. No experiment or installation ran.

The [identity/role mapping](../identity-role-mapping.md) distinguishes community versus member accounts, scoped roles, private associations and explicit key grants; E23 adds deny-by-default bridge cases. Existing six protocol roles remain authoritative; student/learner is proposed local context only.

The [local-first shortlist](../local-first-options.md) keeps Dexie/encrypted records as the baseline and now names Yjs as preferred for optional co-editing. Automerge + Keyhive remains an experimental research alternative, with its own recovery/security limits. Loro and Classic/current Jazz observations remain research only. No candidate was installed or proven ready.

The [Pi refresh](../durable-execution.md#research-refresh-13-november-2026) inspected a 1.5.2 upstream source manifest, not a release/install pin. Capture saving and human review do not depend on Pi. Pi resumes enrichment/review preparation using references and idempotent domain receipts. Deferred progress is not an acknowledgment of a durable save.

Interactive companion: synthetic identity/role map shown in this chat. DOM-simulated interaction and 320/520/736 geometry checks pass; browser rendering remains unverified. The preview helper could not bind a sandboxed loopback server; browser security then rejected file-protocol navigation. No workaround or additional browser surface was used. The local modern-web-guidance command also hit a network allowlist block; semantic/native controls and repository guidance were used without a package refresh.

### Latest accepted comparison scope

[The comparison contract](../collaboration-passkey-spike.md) owns two independent passes. **C0a/E24** tests the actual existing credential/RP/account recipe, PRF availability, blocked-network lock/reopen, unsupported/cancelled unlock, device and credential loss, protected export and revoked-device readmission. A synced passkey is not a device identity; local recovery does not prove Ethereum account recovery. Keep an independently proven local unlock/recovery path when existing-passkey reuse fails.

**C5/E20** proves preferred optional Yjs co-editing only when needed; **E25** retains the same two-device synthetic comparison with Automerge + Keyhive as independent research. Test recipient-side writers/admins, offline edits/restarts, revocation, history/presence, recovery and host migration. A successful merge cannot satisfy confidentiality or authorization. Alternative research does not block a passing Yjs slice.

Keyhive's inspected core warns against production use and records unresolved revocation gaps; the integration guide describes no recovery and full history for new readers. Exact packaged-version applicability is unverified. Keep it experimental and synthetic-data-only even if the happy path succeeds. No package was installed or experiment run. Prior observations below remain historical evidence, not completion of the new gates.

### Next bounded work

Scope **C0 identity/pairing/recovery** and **C1 envelope/key custody** before private use. C0a proves existing-passkey/offline unlock/recovery. For hosted storage, validate preferred Solid in C1a/C3; EDV remains research. For optional co-editing, validate Yjs in C5/E20; retain experimental Automerge + Keyhive comparison under E25. Start with synthetic fixtures and keep local/direct capture → review → share complete without either optional feature.

The first complete experience needs no wallet, provider login or model to capture and review. Pair a phone companion and desktop extension, share one selected encrypted capture with an authorized reviewer, and produce a separately approved partner summary. Prove unauthorized-device and operator views. C3 adds Solid/EDV storage only if justified and selected; C4 proves actual networking/device support. C5 compares Yjs/Automerge + Keyhive as research; production co-editing and MLS remain conditional. External associations and public release are optional C6 work, with no public upload or chain transaction authorized here.

### Evidence that affects implementation

- Coop source pin is `901f57871ec578b0a31bb38c1eacdd0a85eed83a`. Local encrypted payloads/redacted records are useful patterns, but the wrapping secret is in the same DB. Its server-side Y.Doc sees ordinary synced content. HMAC receiver frames authenticate without encrypting. Do not import these as proof of Grove E2EE.
- Solid runs as a client in the extension; a conventional Pod runs separately. Local DIDs need explicit service-principal associations. Pod ACLs never confer decryption grants.
- WebRTC needs authenticated signaling and may need STUN/TURN. Prove LAN-only operation separately. Web Bluetooth is for supported GATT peripherals, not a general phone/browser mesh. Encrypted files remain the offline fallback.
- No Yjs document is shared more broadly by filtering its current visible state: historical text may remain. Create fresh audience-scoped projections/documents. Keep governance and signed writer authority outside CRDT state.
- Existing Green Goods uploads data before its onchain Work submission. Public-release review belongs before the first upload. Verify contract accounts through ERC-1271 and actual garden roles; Certified's inspected EVM-link schema is EOA-only.
- Exact source licensing, trusted phone app/update delivery, crypto-library maturity and browser support remain prerequisites. The source note distinguishes established behavior from inferred design and unresolved proof.

### Validation and phase record

Validation passed: `node scripts/harness/plan-hub.mjs validate` validated 32 hubs; the QA selector selected formatting only for the 16 Grove paths; its local Biome formatting command passed after formatting status.json. Focused checks resolved 142 local links/anchors, preserved lane/Linear values and found unique unchecked C0–C6 and E15–E21 entries. Installed Mermaid 11.17.2 parsed all eight diagrams in architecture-flows.md/spec.md. `git diff --check -- .plans/ideas/grove` passed. Initial formatter and sequence-syntax failures were corrected before these final passes. No dependencies were installed. No application UI changed; rendered Grove runtime proof for this revision: **none**. The Mermaid diagrams describe a proposal, not a working network.

Task record: Grove community sharing | Type: guidance/investigation | Outcome: complete (plan revision)
Agent/model: Codex / unknown | Coverage: this plan revision

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-11-13 09:08:37 → 09:15:00 | Existing hub, current Green Goods boundary, pinned Coop source and primary standards research. |
| Implement plan | 2026-11-13 09:15:00 → 09:30:00 | Current contract, diagrams, research, checkpoints and historical scope boundaries; no runtime edits. |
| Verify | unknown → 2026-11-13 09:30:00 | Hub, links, scope/state, format, diff and Mermaid syntax checks above passed; runtime gates remain unrun. |


#### Follow-up verification record

Task: Grove storage spike, identity/roles and local-first/Pi research | Type: planning/research | Outcome: plan and interactive explanation complete; runtime experiments unrun.
Agent/model: Codex / unknown. Coverage: this follow-up. Working-copy evidence, base HEAD `a0d503abc`, with prior Grove edits and unrelated checkout changes present; no commit-attributed implementation receipt.

| Phase | Observed interval (UTC) | Evidence / limit |
|---|---|---|
| Investigate | 2026-11-13 09:56:24 → 10:00:00 | Current role implementation, primary sync-library sources and Pi upstream source; detailed edits followed as research narrowed. |
| Implement plan/visual | 2026-11-13 10:00:00 → 10:15:23 | C1a/E22/E23, identity-role mapping, package shortlist, Pi phase contract and synthetic interactive map. No runtime/dependency changes. |
| Verify | start unknown → 2026-11-13 10:15:23 | `node scripts/harness/plan-hub.mjs validate`: 32 hubs; focused local-link/anchor script: 181; installed Mermaid 11.17.2: 10 diagrams; QA selector for 19 Grove paths selected formatting only (`automatic-hygiene`); local Biome format passed; diff check passed. Interactive DOM simulations cover role combinations, independent key grants, account/protocol-proof gating, public association state, state saving and 320/520/736 widths with 14/20 font sizes. Browser rendering blocked as described above; no authenticated or product runtime proof. |

All C/E experiment checkpoints remain unchecked/unrun. No Linear write or sync confirmation, branch switch, dependency install, deployment or public identity binding was performed.

#### Passkey and collaboration planning verification

Task record: Grove two-device collaboration and passkey comparison | Type: planning | Outcome: complete (plan only)
Agent/model: Codex / gpt-6.1-sol | Coverage: this follow-up, existing dirty checkout at base HEAD `a0d503abc`; no commit-attributed runtime receipt.

| Phase | Observed interval (UTC) | Evidence / limit |
|---|---|---|
| Investigate | 2026-11-13 21:54:04 → 21:55:24 | Existing hub/role contracts, current WebAuthn/Kernel construction and prior source-backed Keyhive/Yjs research. |
| Implement plan | 2026-11-13 21:55:24 → 22:00:09 | Added comparison contract, C0a/E24, revised C5/E25, optional storage boundaries and consistent plan links. No runtime/account/dependency changes. |
| Verify | 2026-11-13 22:00:09 → 22:01:41 | `node scripts/harness/plan-hub.mjs validate`: 32 hubs. Focused checker: 233 local links/anchors across 26 Markdown files, balanced fences, unique pending C0a/C5/E24/E25 and unchanged lane/Linear metadata. Installed Mermaid 11.17.2 parsed 10 diagrams in the four touched diagram files; syntax proof only. QA selector for the 13 explicit Grove paths selected formatting only (`automatic-hygiene`); local Biome formatting passed after formatting status.json (Markdown is not supported by that formatter). Initial selector argument syntax was corrected to comma-separated paths. Final diff/link consistency checks follow this record; no browser or product experiment proof. |

Human corrections: 0 observed in this segment; attention: unknown. All experiment gates remain unrun. No dependency installation, public identity binding, account migration, chain transaction, external tracker write or branch change occurred. Grove runtime rendered proof: **none**, as this revision changes plan documents only. Keyhive remains experimental and synthetic-data-only; Solid/EDVs remain optional.

#### Preferred adapters: plan and visual verification

Task record: Grove preferred Solid/Yjs adapters | Type: planning/visual | Outcome: complete (design update)
Agent/model: Codex / gpt-6.1-sol | Coverage: this follow-up; dirty working copy at base HEAD `a0d503abc`, no commit-attributed implementation receipt.

| Phase | Observed interval (UTC) | Evidence / limit |
|---|---|---|
| Investigate | 2026-11-14 00:38:04 → end unknown | Current hub, prior accepted research and scoped worktree state; preference is the user's decision. |
| Implement plan/visual | start/end unknown | Solid preferred optional storage, Yjs preferred optional co-editing, local identity/keys and research alternatives reflected across 12 plan paths and the architecture view. Old view state clears example approvals when migrating to version 2. No dependency/runtime changes. |
| Verify | start unknown → 2026-11-14 00:50:56 | `node scripts/harness/plan-hub.mjs validate`: 33 hubs. QA selector for 12 explicit Grove paths selected only `format` via `automatic-hygiene`; selected Biome command passed (one supported JSON file; Markdown unsupported). Focused checker: 229 local links/anchors, balanced fences, pending gate IDs, unchanged lanes/Linear. Installed Mermaid 11.17.2 parsed nine diagrams in architecture-flows/spec/comparison. Eight DOM viewport/font simulations plus legacy/current state cases passed. Clean-room Brave rendered desktop light and 360px dark views; native controls verified preferred Solid default, preferred Yjs selection, EDV research label and approval reset. Browser reconnects required fresh isolated pages; this is explanatory-view proof, not authenticated Grove runtime or actual phone proof. |

Human corrections: 0 observed in this segment; attention: unknown. Solid/Yjs preferences do not complete any privacy, recovery, phone or production gate. EDV and Automerge + Keyhive remain research alternatives, Keyhive experimental/synthetic only. No installation, account migration, branch change, chain/public upload or Linear sync occurred. Final diff/state/format checks follow this record.

#### Publication preparation

The user authorized commit and push of the Grove updates on 13 November 2026. The [standalone architecture page](../artifacts/demos/grove-architecture.html) and an editable fragment (removed on 14 November, when the page was rebuilt as one file) are now included in the hub, with the demo index updated. They contain synthetic display state only, no live keys or private account bindings. The exported copy uses only widget-state APIs from its host integration.

Publication scope is the Grove hub only; unrelated application and infrastructure edits in the shared checkout are excluded. Current branch: `fix/work-approval-feedback`. No open PR exists for that branch. The live GitHub connector reports develop at `3ee6594ef3e5a7259881119e5c6a9fa3f4e2833b`, matching the existing local remote-tracking ref. Git network fetches over SSH and HTTPS were blocked by the execution environment; the connected GitHub integration is the publication fallback. Commit, exact-tree push-gate evidence and remote verification will be reported in chat after execution. This preparation record does not claim a successful push or CI readiness.
