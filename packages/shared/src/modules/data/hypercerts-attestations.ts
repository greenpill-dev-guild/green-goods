import type { Address } from "viem";
import type { AttestationFilters, HypercertAttestation } from "../../types/hypercerts";
import { logger } from "../app/logger";
import { getWorkApprovals, getWorkApprovalsByUIDs, getWorks, getWorksByUIDs } from "./eas";
import { applyAttestationFilters } from "./hypercerts-filters";
import { extractWorkMetadata } from "./hypercerts-metadata";
import { getGardenHypercerts } from "./hypercerts-fetch";

// =============================================================================
// EAS Attestation Fetching
// =============================================================================

/**
 * Fetches approved work attestations for a garden from EAS.
 *
 * This function queries the EAS indexer (not Envio) to get:
 * 1. All work submissions for the garden
 * 2. All approved work approvals
 * 3. Joins them to create HypercertAttestation objects
 *
 * @param gardenId - The garden address to fetch attestations for
 * @param filters - Optional filters for date range, domain, etc.
 * @param _limit - Unused, kept for API compatibility
 * @returns Array of approved work attestations ready for bundling into hypercerts
 */
export async function getApprovedAttestations(
  gardenId: string,
  filters?: AttestationFilters,
  _limit = 100
): Promise<HypercertAttestation[]> {
  try {
    // Fetch works and approvals in parallel from EAS, scoped to garden
    const [works, allApprovals] = await Promise.all([
      getWorks(gardenId),
      getWorkApprovals(gardenId),
    ]);

    // Filter to only approved work approvals
    const approvedApprovals = allApprovals.filter((approval) => approval.approved);

    // Create a map of workUID -> approval for O(1) lookups
    const approvalsByWorkUID = new Map<string, (typeof approvedApprovals)[0]>();
    for (const approval of approvedApprovals) {
      approvalsByWorkUID.set(approval.workUID, approval);
    }

    // Join works with their approvals
    const attestations: HypercertAttestation[] = [];

    for (const work of works) {
      const approval = approvalsByWorkUID.get(work.id);
      if (!approval) continue; // Skip works without approval

      const metadata = extractWorkMetadata(work.metadata);

      attestations.push({
        id: approval.id,
        uid: approval.id,
        workUid: work.id,
        gardenId: work.gardenAddress,
        title: work.title || "Untitled work",
        actionType: metadata.actionType,
        domain: metadata.domain,
        workScope: metadata.workScope ?? [],
        gardenerAddress: work.gardenerAddress as Address,
        gardenerName: null, // ENS lookup would need separate query
        mediaUrls: work.media ?? [],
        metrics: metadata.metrics ?? null,
        createdAt: work.createdAt,
        approvedAt: approval.createdAt,
        approvedBy: approval.operatorAddress as Address,
        feedback: approval.feedback || null,
      });
    }

    // Sort by approvedAt descending (most recent first)
    attestations.sort((a, b) => b.approvedAt - a.approvedAt);

    return applyAttestationFilters(attestations, filters);
  } catch (error) {
    logger.error("Failed to fetch approved attestations from EAS", {
      source: "getApprovedAttestations",
      gardenId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Fetches specific attestations by their UIDs.
 * More efficient than getApprovedAttestations when you have specific UIDs to fetch.
 *
 * @param uids - Array of attestation UIDs (work approval UIDs) to fetch
 * @returns Array of approved work attestations matching the UIDs
 */
export async function getAttestationsByUIDs(uids: string[]): Promise<HypercertAttestation[]> {
  if (uids.length === 0) return [];

  try {
    // Fetch only the specific approvals by UID
    const approvals = await getWorkApprovalsByUIDs(uids);
    if (approvals.length === 0) return [];

    // Filter to only approved ones
    const approvedApprovals = approvals.filter((approval) => approval.approved);
    if (approvedApprovals.length === 0) return [];

    // Get the work UIDs we need
    const workUIDs = approvedApprovals.map((a) => a.workUID);
    const works = await getWorksByUIDs(workUIDs);

    // Create lookup map
    const worksByUID = new Map(works.map((w) => [w.id, w]));

    // Build attestations
    const attestations: HypercertAttestation[] = [];
    for (const approval of approvedApprovals) {
      const work = worksByUID.get(approval.workUID);
      if (!work) continue;

      const metadata = extractWorkMetadata(work.metadata);
      attestations.push({
        id: approval.id,
        uid: approval.id,
        workUid: work.id,
        gardenId: work.gardenAddress,
        title: work.title || "Untitled work",
        actionType: metadata.actionType,
        domain: metadata.domain,
        workScope: metadata.workScope ?? [],
        gardenerAddress: work.gardenerAddress as Address,
        gardenerName: null, // ENS lookup would need separate query
        mediaUrls: work.media ?? [],
        metrics: metadata.metrics ?? null,
        createdAt: work.createdAt,
        approvedAt: approval.createdAt,
        approvedBy: approval.operatorAddress as Address,
        feedback: approval.feedback || null,
      });
    }

    // Sort by approvedAt descending (most recent first) to match getApprovedAttestations behavior
    attestations.sort((a, b) => b.approvedAt - a.approvedAt);

    return attestations;
  } catch (error) {
    logger.error("Failed to fetch attestations by UIDs from EAS", {
      source: "getAttestationsByUIDs",
      uidCount: uids.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// =============================================================================
// Bundle Checking
// =============================================================================

export interface BundledAttestationInfo {
  uid: string;
  hypercertId: string;
  hypercertTitle?: string | null;
}

/**
 * Checks if any of the given attestation UIDs are already bundled in a hypercert.
 *
 * This uses the Hypercert entity's attestationUIDs list (indexer data) and
 * requires a gardenId to scope the query efficiently.
 */
export async function checkAttestationsBundled(
  uids: string[],
  gardenId: string,
  chainId: number,
  limit = 200
): Promise<BundledAttestationInfo[]> {
  if (!uids.length || !gardenId) return [];

  const hypercerts = await getGardenHypercerts(gardenId, chainId, undefined, limit);
  if (!hypercerts.length) return [];

  const uidSet = new Set(uids);
  const bundledByUid = new Map<string, BundledAttestationInfo>();

  for (const hypercert of hypercerts) {
    const attestationUIDs = hypercert.attestationUIDs ?? [];
    if (!attestationUIDs.length) continue;

    for (const uid of attestationUIDs) {
      if (!uidSet.has(uid) || bundledByUid.has(uid)) continue;
      bundledByUid.set(uid, {
        uid,
        hypercertId: hypercert.id,
        hypercertTitle: hypercert.title ?? null,
      });
    }
  }

  return Array.from(bundledByUid.values());
}
