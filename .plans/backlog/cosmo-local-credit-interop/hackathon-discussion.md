# Sustainable Finance hackathon discussion

**Observed:** 2026-10-09.

> Subsequent reconciliation: [the current plan](plan.todo.md) and [project record](project-reconciliation.md)
> now resolve the canonical-document drift and issue ownership described below. This discussion
> preserves the earlier findings; it is not the current task list.

 **Purpose:** connect the existing integration, PWA and pitch work;
record gaps and recommendations for discussion. This is planning evidence, not an implementation
dispatch, accepted new design, deployment authorization or validation receipt.

**Follow-up:** [CLC v0.8 review and Nigerian diaspora narrative](whitepaper-v8-review.md)
checks the latest supplied white paper against this checkout, records 275 passing focused tests,
and distinguishes implemented foundations from the missing CLC integration. It adds the user's
hub/community/diaspora/institution framing and sourced remittance context. Its findings refine
this discussion without accepting new runtime scope or changing deployment gates.

The proposed demonstration follows one learner through a useful contribution, confirmation,
recognition and service use, then shows a sponsor what was delivered and what the hub still owes.
Tech and Sun supplies the services; Green Goods records commitments and evidence; Cosmo-Local
provides the planned exchange mechanism. The PWA makes that journey understandable.

## Established work and source conflicts

The current integration target is [PRD-857](https://linear.app/greenpill-dev-guild/issue/PRD-857)
and the September amendments in [RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73).
The latter explicitly retires this hub's August contribution-weighting model. Consequently,
the older `brief.md`, `spec.md`, `plan.todo.md` and `eval.md` are historical design inputs until
reconciled; their valuation-policy, added pool-type and Gnosis-consideration-rail steps must not
be dispatched as the October build. This note does not certify the replacement implementation.

[RESR-74](https://linear.app/greenpill-dev-guild/issue/RESR-74) is Done and has a September
findings comment, including fork observations and the decision to deploy community-owned
instances. Its reads are dated evidence, not current deployment certification. The current Product
issues remain Todo: [local rehearsal PRD-1096](https://linear.app/greenpill-dev-guild/issue/PRD-1096),
[passport PRD-1097](https://linear.app/greenpill-dev-guild/issue/PRD-1097), and
[conditional deployment PRD-1100](https://linear.app/greenpill-dev-guild/issue/PRD-1100).

The [PWA hub](../pwa-interface-simplification/brief.md) already records accepted product direction,
conditional implementation steps and proposed usability checks. Layout, scope and execution
acceptance remain open; [RESR-93](https://linear.app/greenpill-dev-guild/issue/RESR-93) now mirrors
the planning work. The Community PWA, Agent Messaging and Green Goods OS work retain their
own owners and are not prerequisites for this bounded PWA improvement.

## Current integration target

1. **Arbitrum owns the commitment.** Preserve the accountable provider, eligible confirmer,
   evidence, fulfillment and declared terms. A contribution record remains non-transferable.
   Current code supports one declared payment, with `ArbitrumExternal` or `CeloSettlement` rails;
   `declaredUnitValue` and `declaredValueBasis` are informational declarations, not token balances.
2. **Only authorization travels.** A hat-authorized sender checks the qualifying source record
   and sends a message-only command to Gnosis. Each pool's Safe owns its issuer. The issuer checks
   source chain/sender, deduplicates commands and enforces its season cap; its proposed rights are
   credit minting and limiter configuration, with no authority to withdraw pool money. Safe calls
   to the issuer are the documented fallback. The garden-account owner relay is not this path.
3. **Two issuers owe two sets of services.** Tech and Sun issues hub-service credits; Green Goods
   issues credits for its services. Each community owns its credit, registry, limiter, fee policy
   and pool instances, with upgrade authority behind the agreed delay. Mutual acceptance at initial
   parity and roughly 500 units of cross-holding capacity are planning parameters, not evidence of
   cash backing, deliverable capacity or an approved loan.
4. **The gardener exchanges on Gnosis.** Prove the intended Kernel account derivation and sponsored
   transaction path. Read admission, inventory, quote, fees and limits before a bounded swap.
   Published protocol documentation describes minimum-output/deadline protection; verify the
   selected deployed bytecode exposes that interface before relying on it. A swap changes holdings;
   delivery and discharge require separate evidence. No wider route execution is assumed.
5. **G$ remains a separate Celo lane.** Keep authorization, dispatch and authenticated settlement
   acknowledgment distinct. Neither a local timeout nor an Arbitrum declaration proves receipt.
   No money bridge or new Gnosis payment rail is part of the October target.
6. **The passport joins records.** Link commitments, earned or purchased issuance, current pool
   state, service use, outstanding obligations and payment receipts. Show source time and live versus
   rehearsal status. Public summaries must not expose participant addresses or create rankings.

The proposed code ownership follows existing boundaries: contracts enforce sender/issuer authority;
indexer projections carry source and destination receipts; Shared owns the CLC adapter, domain
translation, state and hooks; client owns the learner journey and public presentation. This is a
package-level recommendation, not a settled file/interface design. Keep vendor-specific mechanics
behind the adapter and preserve the hand-written-interface clean-room boundary.

## Gaps to resolve

| Gap | Why it changes the build | Existing owner / next decision |
|---|---|---|
| Canonical hub drift | August tasks contradict the current Product target; some completed research still appears open. | RESR-73: reconcile the canonical spec, task sequence and evaluation before dispatch; preserve dated evidence and open gates. |
| Earned versus purchased issuance | The pitch's “only kept promises mint credits” excludes its sponsor-purchase journey. | PRD-857 / MAR-32: define separate source kinds. Recommendation: confirmed contribution or verified purchase receipt, both under issuer capacity limits. |
| Sponsor purchase | Asset, destination, receipt finality, duplicate protection, recipient allocation and refund/replacement authority are unspecified. | PRD-857: settle this path without silently adding a bridge or Gnosis consideration rail. |
| Redemption and obligations | Swapping or returning a token does not prove a service was delivered. Current token burn authority is also distinct from issuer writer authority. | PRD-1096 / COM-28: specify booking, delivery, eligible confirmation, partial/non-delivery and exactly-once discharge; decide what happens to returned credits. |
| Terms, prices and capacity | “Face value” leaves G$ token units versus dollar service units ambiguous; issuance cap and cross-holding limit control different risks. | COM-28 / PRD-857: publish service quantities, availability, price basis, cap, signer responsibilities and recovery terms. Tech and Sun cash swap-back remains rehearsal-only. |
| PWA design acceptance | No selected composition, remembered-garden policy, sheet scope or complete destination map. | PWA hub: choose compact journal versus featured activity, management placement, personal-sheet scope and first delivery slice. |
| End-to-end evidence | Todo/Done states alone do not prove a runnable integration or usable flow. | PRD-1096 / PRD-1097: attach actual receipts, negative-case results and labeled rendered observations; measure assistance and recovery. |
| Pitch and event assumptions | Finance-readiness, minting and deadline claims can overstate evidence. | MAR-32 / GROW-43: reconcile claims; confirm exact submission cutoff, timezone, format, pitch duration and sandbox requirements at bootcamp. |

## PWA recommendation for discussion

Keep Home / Garden / Profile and one-tap Wallet, Promises and Your Work sheets. Home should open
in the member's garden: discovery for no memberships, the sole garden for one, and a clear remembered
switcher for several. Use the hub's confirmed order: bounded recent activity, unfinished work, then
ways to participate. A compact journal is the recommended composition, still awaiting acceptance.

Carry valid garden and promise context into submission. A resumed draft keeps its own garden,
evidence and saved step even when Home changes. Reuse the existing work queue, sheets and permission
checks. Group occasional management actions without hiding evaluator responsibilities or qualifying
depositors' Endowment access. Align the canonical PWA design guide's different content ordering when
the new layout is accepted.

For the later credit journey, lead with a useful service and its availability, cost, issuer and help
route. Show G$ payment state separately from each issuer's service credits. Prefer “Resume draft”,
“Waiting for confirmation” and “Use a hub day” over chain or token terminology. Recognition should
refer to the person and contribution; optional thanks or shared memories are proposals, not a new
score or engagement system. The brief's four learner destinations are an information hierarchy,
not a request for four new tabs. A “Partly” response needs a supported resolution model before UI.

Compare the current flow with the selected prototype using the same tasks: find a useful activity,
submit evidence, resume after interruption, identify support actually received, use a service and
get help. Record independent completion, assistance, wrong turns, repeated selections and recovery.
Include 320/375px, long en/es/pt content, reduced motion, keyboard/screen-reader use and offline states.
No usability improvement or runtime browser proof is claimed by this planning record.

## Narrative and delivery recommendation

**Proposed center:** Tech and Sun helps people learn and contribute; Green Goods makes that work
and the hub's service commitments visible, so a sponsor can fund access and follow delivery.

Open with one adult learner's need for power, connectivity and a place to learn. Show a useful
contribution, the recipient's confirmation, recognition, access to a real service, and the sponsor's
view of delivery and remaining obligations. Explain Cosmo-Local after the audience understands why
exchanging service credits helps. A passport informs a funding decision; it does not establish
creditworthiness, audited impact, guaranteed redemption or a financial return.

Separate the proposed asks: funding for Tech and Sun's service capacity, and funding for Green Goods'
reusable integration, support and evidence infrastructure. The amount, buyer and pilot terms remain
decisions. The operating test is repeat useful participation and a payer's concrete next step.

Three feasible emphases remain for discussion: PWA plus passport alone is lowest integration risk;
the **recommended rehearsal-first complete journey** adds the two-pool local loop and preserves a
credible submission if live gates are unmet; a mainnet-first emphasis adds operational risk and
compresses time for participant use. This recommendation preserves the existing conditional live
target rather than canceling it.

Existing internal dates: rehearsal by **21 October**, go/no-go **22 October**, dry run **24 October**,
submission **27 October**, pitch **28 October**. The official agenda confirms bootcamp on 16 October
and the 16–27 October build window, but states the submission cutoff as “2–3 PM” without a timezone.
Treat 14:00 London as the internal conservative assumption, pending confirmation. On no-go, show real
Arbitrum records beside explicitly labeled local Gnosis execution; a fork receipt is not a live receipt.
Any mainnet substitution of the PRD-651 audit, ownership, timelock, testnet or rollback gates remains
an explicit human decision. This discussion grants none.

## Sources and limits

- Current Linear issues and their dated comments, observed 2026-10-09, linked above; event and pitch
  owners: [GROW-43](https://linear.app/greenpill-dev-guild/issue/GROW-43),
  [MAR-32](https://linear.app/greenpill-dev-guild/issue/MAR-32),
  [COM-28](https://linear.app/greenpill-dev-guild/issue/COM-28).
- [PWA specification](../pwa-interface-simplification/spec.md),
  [current Home](../../../packages/client/src/views/Home/index.tsx),
  [payment interface](../../../packages/contracts/src/interfaces/ICommitmentPoolingModule.sol).
- Current public [CLC contract documentation](https://docs.cosmolocal.credit/protocol/smart-contracts/)
  and [network description](https://docs.cosmolocal.credit/protocol/network/). Documentation was read;
  deployed configuration, chain state and CCIP availability were not independently re-tested here.
- Official [event agenda](https://www.sustainablefinance.live/hackathon-agenda).
- User-supplied 8 October research brief: recommendations and leads, not execution instructions.
  Selected passages from the supplied design and engineering books informed the discussion; no
  source files, private reports, participant details or book excerpts are copied into this repository.

Tracking updates authorized by the user's 9 October request preserve current issue states, cycles
and dates. This hub stays backlog, all existing implementation blocks remain, and no application
code, dependencies, deployments or branch state change.

### Book reference lenses

These are supporting design methods, not product decisions: *Don't Make Me Think* (PDF page 56)
on clear hierarchy; *Refactoring UI* (PDF page 8) on starting from a useful feature; *Atomic Design*
(PDF page 46) on composing existing patterns; *Learning Domain Driven Design* (PDF page 80) on
translating an external model at the integration boundary; *The Pragmatic Programmer* (PDF pages
110–111) on proving a narrow path through the real architecture before expanding it.

## Planning proof and task record

Planning verification: `node scripts/harness/plan-hub.mjs validate` passed for 27 hubs;
`git diff --check` passed; a read-only link check found 54 valid local Markdown/status targets.
Both hubs' lane objects were compared with HEAD and are unchanged, including dependencies,
manual blocks and proof records. RESR-93 was read back with its Backlog state, plans/green-goods
labels and related issues; its identifier and confirmed sync are recorded in the PWA hub.
Discussion comments were saved on RESR-73, PRD-857 and MAR-32. Repository changes remain local.

Application tests are not applicable to this planning-only change. Rendered proof: **none**.
No chain read, contract rehearsal, deployed behavior or usability improvement is certified here.

Task record: Sustainable Finance hackathon discussion | Type: investigation | Outcome: complete
for the requested outline and tracking; product decisions and canonical reconciliation remain open.
Agent/model: Codex / unknown | Coverage: this discussion and tracking segment only.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | unknown → 2026-10-09T10:01:23Z | Supplied brief and selected book passages, repository sources, current Linear and official event/CLC documentation. First clock observation was 09:52:24Z, after investigation had begun. |
| Implement planning records | unknown → unknown | Local discussion, historical-model notices and hub metadata; no application implementation. |
| Publish tracker updates | 2026-10-09T09:58:01Z → 2026-10-09T09:59:42Z | RESR-93 creation and three discussion comments; existing issue states and dates preserved. No Git publication. |
| Verify | unknown → 2026-10-09T10:01:23Z | Hub validation, links, diff and unchanged-lane comparison described above; final record edits receive a closing validation pass. |

Human corrections: 0 observed in this segment; attention: unknown.
