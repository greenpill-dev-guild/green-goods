import type { PublicImpactEvidenceKind } from "@green-goods/shared/public-contracts";

/**
 * Labels for the public evidence ledger's record kinds, indexed by
 * `PublicImpactEvidenceRecord.kind` (card tiles, source dialog, filter chips).
 *
 * Deliberately typed on the shared ledger contract and not on the
 * `PublicEvidencePipeline` node kinds: the pipeline tells a five-stage story
 * (Assessment → Commitment → Work → Confirmation → Impact Certificate), but
 * the ledger records only the three kinds whose source is a public
 * attestation or certificate. Commitment and Confirmation are never ledger
 * records — a ledger row names a Garden and a title, and a commitment record
 * would attach people to commitment outcomes, which the public surface
 * forbids. Keeping the two kind unions apart is what stops the pipeline's
 * stages from leaking into the ledger's filters.
 */
export const EVIDENCE_KIND_LABELS: Record<PublicImpactEvidenceKind, string> = {
  assessment: "Assessment",
  work: "Work",
  certificate: "Impact Certificate",
};
