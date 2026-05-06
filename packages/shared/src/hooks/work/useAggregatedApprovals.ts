/**
 * Utility for fetching and de-duplicating work approvals across multiple
 * recipient addresses (typically garden IDs).
 *
 * This is a pure async function — no React hooks — suitable for use inside
 * `useQuery` queryFn callbacks or any async context.
 *
 * @module hooks/work/useAggregatedApprovals
 */

import { getWorkApprovals } from "../../modules/data/eas";

/**
 * Fetch work approvals for multiple recipients, de-duplicate by approval ID,
 * and return a flat array.
 *
 * @param recipients - Array of addresses (e.g. garden IDs) to query
 * @returns De-duplicated approvals across all recipients
 */
export async function fetchApprovalsByRecipients(recipients: string[]) {
  if (recipients.length === 0) return [];

  const uniqueRecipients = Array.from(
    new Map(
      recipients.filter(Boolean).map((recipient) => [recipient.toLowerCase(), recipient])
    ).values()
  );

  const approvalGroups = await Promise.all(
    uniqueRecipients.map((recipient) => getWorkApprovals(recipient))
  );

  const approvalById = new Map<string, (typeof approvalGroups)[number][number]>();
  for (const approvals of approvalGroups) {
    for (const approval of approvals) {
      approvalById.set(approval.id, approval);
    }
  }

  return Array.from(approvalById.values());
}
