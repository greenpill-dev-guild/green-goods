# Local service-access integration

**Selected 2026-10-21 23:10 UTC; implementation in progress.** The user authorized the next
local sequence: Indexer projections, Shared state/actions, then member journeys. The user also
authorized cohesive local commits, superseding the earlier instruction to leave completed work
uncommitted. No push, PR, live configuration, deployment, broadcast or release waiver is authorized.
The existing `feature/cosmo-local-contracts` checkout and unrelated changes are preserved.

The [contract execution record](codex-service-access-execution.md) and
[selected contract API](codex-service-access-api.md) retain their dated working-tree evidence.
None of those results has become commit-attributed proof. The prompt-preparation session remains
aligned on this sequence and the separate live gates.

## Selected integration boundary

1. **Indexer:** add ten entities for service revisions, claim consent, personal purchases and
   typed deposit receipts, voucher endpoint configuration, source redemption, destination
   custody, actions, results and acknowledgment observations. Identity includes chain and
   emitting module. Preserve exact large integers, separate field cursors, replay protection,
   withdrawal tombstones and independent source/destination observations. Existing confirmation
   provenance stays authoritative. Existing networks, addresses and start blocks remain unchanged;
   new endpoint definitions are dormant. Full terms omitted by events remain explicitly incomplete.
   Earned-history and direct-swap projections are outside this bounded stage.
2. **Shared:** extend the existing commitment-pooling public owner with a typed service-access
   snapshot, strict projection reader, pure action eligibility and a hook/controller. Bind chain,
   module, commitment, buyer, canonical route, revision, terms hash, claim hash and request nonce.
   Require authoritative configured contract views before live action preparation. Missing data
   never implies Legacy. Source buyer, Celo depositor, Gnosis holder and privileged stewards are
   distinct actors. Reuse existing G$ fee vocabulary and central query keys. Keep production
   mutations unavailable until reviewed deployment, chain and signer configuration exists.
3. **Member journeys:** integrate native consent, payment-status and voucher-delivery controls
   into the existing commitment detail. One accepted revision selects one payment route. Suppress
   legacy claim actions for known opted-in service offers. Show source acceptance, steward-attested
   payment, voucher custody and durable destination results independently. Explicit cumulative
   service approval and voucher allocations support partial discharge and agreed returns.

Local member walks use an explicitly labeled, stateful DEV rehearsal adapter behind the same
Shared interface. Its observations are simulated, without transaction hashes, authenticated
signing or passkey claims. Existing generic demo mutation guards remain intact. This stage adds
neither unused live transport scaffolding nor an automatic offline monetary queue. G$ to voucher
purchases, mixed checkout and external service activation remain outside scope.

## Commit and proof boundaries

The bounded validator repair passed a fresh precommit QA selector: **3/3 checks**, including
**399/399 validation-system tests**, with zero reused checks. Command:

```sh
PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH node scripts/dev/ci-local.js --intent qa --changed scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs,scripts/dev/setup-env.test.mjs
```

`validator-precommit.log` records this dirty-tree result. Only those three files were staged.
The local commit's identity and formatting hooks passed, but Git failed at required GPG signing.
The permission profile forbids keyring access. No commit was created, no signing configuration was
changed. The user chose to keep signing required and make the commits from their terminal;
the reviewed validator files remain staged for that signed commit. A temporary copy
of the same hook disables only lint-staged's automatic stash/hiding, honoring the no-stash constraint;
it retains identity and formatting checks, forbids package installation and disables dotenv reads.

The user then created signed validator commit
`a19a0b0d46996a269c840592764a798c69234ffd` at 23:15 UTC. Its commit object contains a GPG
signature header; keyring access is unavailable here, so local signature verification is not
claimed. All three implementation paths are clean. At 23:18 UTC the exact QA command above
passed again against that committed implementation: **3/3 fresh checks, 399/399 tests**, zero
reused or unrun, suite 37.193s. Output: `validator-postcommit-qa.log`. The stricter five-check
Push Gate is still pending; it is not replaced by this QA receipt. Other packages are being
edited concurrently and are outside this validator-only receipt.

After each successful local commit, record its actual hash, clean validated paths, exact fresh
selector/conditional commands and observed results. Keep failed checks and live-only proof limits
explicit. Contract critical overrides, Indexer codegen/build/boundary proof, Shared consumer proof
and labeled rendered member evidence remain required for their respective stages. Receipt reuse is
disabled here because its complete environment fingerprint is unavailable under this profile.

Release locks and canonical deployments remain unchanged. The changed linked libraries require
a newly reviewed candidate/rehearsal; an unchanged library-name inventory does not permit reusing
historical addresses. COM-46 terms, actual issuer approval, capacity, Safe custody, member signing,
the Gnosis WebAuthn validator gap and live transport/activation remain separate gates.

Task record: cosmo-local-credit-interop | Type: feature | Outcome: partial
Agent/model: Codex / unknown | Coverage: local integration continuation from 23:06 UTC

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Verify | 2026-10-21 23:06:35 → end unknown | Validator precommit selector passed 3/3; 399 tests |
| Review | 2026-10-21 23:06 → 23:10 | Exact staged validator diff, planning ownership and selected integration interfaces reviewed |
| Publish (local only) | Start unknown → 2026-10-21 23:15 | Agent attempt failed at GPG after hooks; user then signed validator commit a19a0b0 |
| Implement | 2026-10-21 23:10 → ongoing | Disjoint Indexer, Shared and member-journey work follows the selected dependency order |
| Wait | 2026-10-21 23:10 → 23:15 | User retained signing and created the validator commit from their terminal |
| Verify | Start unknown → 2026-10-21 23:18 | Fresh validator post-commit QA passes; exact scoped paths clean |

Human corrections: 0 observed in this segment; attention: unknown.
