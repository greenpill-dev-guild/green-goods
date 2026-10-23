# Cosmo-Local and Green Goods 2.1.0 delivery alignment

**Accepted planning scope:** 15 October 2026. The user aligned both projects around the four
goals below and requested voucher terminology. This authorizes planning and Linear updates;
existing implementation dispatch, design acceptance and live-operation gates remain in force.

## Ownership and priorities

Cosmo-Local owns the voucher integration, participating issuers, passport, hackathon package and
Q4 strategy content. Green Goods 2.1.0 owns the PWA delivery, bounded admin/PWA cohesion, public-site
delivery and release acceptance. Each issue has one project home; cross-project relations connect
the work. Existing unrelated 2.1.0 work keeps its ownership and priority.

High priority means work needed to settle or deliver these four goals. Medium priority covers
broader outreach variants and follow-on documentation. Parked federation and the separate
Commitment Credit lending companion are not hackathon prerequisites. No Urgent priority is added.

| Goal | Canonical work and project home | Completion evidence |
|---|---|---|
| Integrate Cosmo-Local on Gnosis | Cosmo-Local: RESR-73 architecture; COM-46 issuer terms; PRD-857 delivery; PRD-1096 rehearsal; PRD-1097 passport; PRD-1197 decision; conditional PRD-1100 live release | Earned and purchased voucher paths, direct exchange, service presentment, confirmed fulfillment, once-only discharge and recovery; dated receipts and explicit live/rehearsal labels |
| Tell the Green Goods, commitment-pooling and Tech and Sun story | Cosmo-Local: RESR-94 evidence; MAR-35 case study; MAR-32 pitch; GROW-43 event | One learner and one supporter journey, evidence-backed claims, separate TAS service-capacity and Green Goods coordination asks, and usable go/no-go demo variants |
| Simplify the PWA and cohere its design with admin | 2.1.0: RESR-93 scope; PRD-1260 PWA delivery; PRD-1261 paired-surface cohesion; PRD-1262 release acceptance | Garden context and draft continuity, a bounded member/steward journey, consistent language and state feedback, and rendered mobile/desktop checks in en/es/pt |
| Make Q4 strategy publicly accessible | Cosmo-Local: GROW-68 content and approval. 2.1.0: PRD-1194 public-site delivery. MAR-34 reuses the approved evidence for broader outreach | A stable public URL reachable without sign-in, an October–December roadmap with owners and evidence, a readable funding ask, links to reviewed assets, and source dates |

## Work from both ends

Research, strategy and pitch drafts can advance while implementation is pending. The first
audience recorded in RESR-94 is Omo Yoruba of Southern California. The $30 seat, $800 TAS season
pack and $1,200 Green Goods coordination package remain labeled scenarios pending COM-46 terms;
the exact gift method and named first supporter remain unconfirmed. Use the current draft package
in [PR #1068](https://github.com/greenpill-dev-guild/green-goods/pull/1068), not a second deck.

Product works forward from a useful member action to evidence, voucher access, service fulfillment
and remaining obligations. Pitch works backward from the supporter's decision to the service offer
and evidence they need. COM-46's agreed offer and PRD-1097's passport connect those directions.
The pitch must not wait for live deployment to prepare its rehearsal version.

## Dependencies

Native Linear blockers express completion prerequisites; drafting, fixtures and exploration may
proceed alongside the prerequisite. Keep related-but-independent work as related links.

- RESR-73 and COM-46 → PRD-1096. Resolve issuance eligibility, purchase receipts, member accounts,
  units and recovery before accepting the rehearsal. The 10 October passkey-validator observation
  is a dated open issue to recheck, not a new current-chain certification.
- RESR-73 and PRD-1096 → PRD-1097. Passport layout can start from real Arbitrum data and labeled
  fixtures; final acceptance consumes the rehearsal's issuance and fulfillment receipts.
- PRD-1096 and COM-46 → PRD-1197 → PRD-1100. The live gate and its original audit, Safe, timelock,
  testnet and rollback requirements are unchanged. COM-28 also needs terms and rehearsal.
- RESR-93 → PRD-1260 and PRD-1261. The PWA and cohesion slices can proceed together after accepted
  scope; neither depends on live Gnosis deployment. The cohesion slice pairs a member promise/work
  journey with its steward review and preserves each surface's approved dialect and permissions.
- RESR-94, GROW-68, MAR-35, PRD-1097 and PRD-1197 → MAR-32 → GROW-43. These gate the finished
  submission package, not the start of pitch drafting. The decision selects live or rehearsal claims.
- GROW-68 → MAR-34 and PRD-1194. Strategy drafting does not depend on completed integration; it
  labels planned and deferred work. PRD-1194 retains the site's existing operator/privacy prerequisite
  PRD-1116 and verifies the already-reviewed garden listings rather than inventing a new filter rule.
- PRD-1262 is the explicit 2.1.0 QA milestone item. It consumes the release-prep scope and the
  included PWA/admin proof. Related work is not a blanket blocker: a feature excluded from the cut
  needs a recorded deferral and truthful release claims. PRD-1157 supplies the existing practical
  gardener/Portuguese QA input; PRD-957 remains the known proposed-versus-executed Safe boundary.

## Dates and release boundary

The hackathon and the monthly app release are different checkpoints. Existing internal targets
remain: terms and rehearsal 21 October, human decision 22 October, pitch dry run 24 October.
The official agenda lists the bootcamp 16 October, conference 20 October, submission 27 October
and pitches 28 October; the published submission window has no explicit timezone, so GROW-43
still owns confirmation. See the [official agenda](https://www.sustainablefinance.live/hackathon-agenda).

Green Goods 2.1.0 retains QA on 30 October and the monthly cut/production verification target of
2 November. October demos use the named beta/rehearsal build and must not be called the production
2.1.0 release. Release-prep admits or defers app changes; only the QA milestone gates the cut.
The Q4 strategy's overdue October-only target is cleared because its scope changed; a replacement
publication date needs owner confirmation. This pass does not manufacture a new date.

## Terminology decision

The supplied *Cosmo-Local Credit whitepaper v0.8*, dated 30 September 2026, pages 9–11, defines a
voucher as a token or record representing an issuer's commitment under published terms. Use
**service voucher**, shortened to **voucher**, for the TAS and Green Goods instruments.

- **Cosmo-Local Credit (CLC)** remains the product-family name. The **Commitment Pooling Protocol
  (CPP)** is the protocol model; a CLC Commitment Pool is its governed arrangement, while
  `SwapPool` is the current vault/direct-swap contract component.
- A **Green Goods promise/commitment** retains its non-transferable record and confirmation rules.
  A **voucher** is the separately transferable issuer instrument in this planned integration.
  Earning or buying a voucher, swapping it, presenting it, fulfilling its service and discharging
  its obligation are separate facts. A swap or token return alone proves no service delivery.
- **Credit facility**, **credit line**, the official hackathon challenge's Community Credit title,
  **Commitment Credit** and **carbon credit** retain their meanings. Ordinary vouchers are not
  automatically loans. G$ remains a separate payment asset, not a voucher unit or a US dollar.
- Apply the wording to current project overviews, open delivery issues, acceptance copy and new
  public materials. Preserve historical reports, Done descriptions, quoted source titles, code
  identifiers and the existing hub slug. PR #1068's editable deck/ledger terminology follow-up is
  owned by MAR-32 and RESR-94; its artifacts are not present in this checkout and were not rewritten.

The [integration specification](spec.md) owns the planned meaning and boundaries. This decision
does not rename a deployed contract, token, ABI, schema or the separate lending product.


## Verification and task record

Working-tree verification on 16 October 2026 UTC (15 October Pacific): the Plan Hub validator
passed for 28 hubs; 72 relative Markdown/status links resolved; the two status files were formatted;
all 21 touched Linear issue records and both projects were read back. Eleven dependency requirements
were checked with no cycles. Existing issue states, embedded architecture attachments, implementation
lane/execution objects and workflow status were preserved. Four milestone descriptions changed;
project and milestone target dates did not. No runtime tests, rendered implementation proof,
commit, push, merge, deployment or public-site publication is claimed.

Task record: Cosmo-Local / Green Goods 2.1.0 four-goal alignment | Type: planning | Outcome: complete
Agent/model: Codex / model unknown | Coverage: this planning and tracker-update segment

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-10-16T04:04:33Z → unknown | Supplied v0.8 PDF, current plans, live projects/issues and design guidance |
| Implement | unknown → 2026-10-16T04:16:51Z | Canonical planning updates, two overviews, four milestones, 18 existing issues and three new Product issues |
| Verify | 2026-10-16T04:16:51Z → 2026-10-16T04:18:44Z | Checks and readback above; corrected native relation types and re-read their blockers |

Human corrections: 0 observed in this segment; attention: unknown.
