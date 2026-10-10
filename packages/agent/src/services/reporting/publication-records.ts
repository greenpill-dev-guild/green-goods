import { getBlockExplorerTxUrl, getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import type { OutboundLink } from "./transport";

/**
 * What the chain has shown of one publication, and the public records it opens for any channel
 * to draw: the attestation, which holds what was attested, then the transaction that carried it.
 * An attestation UID and a transaction hash are both 32 bytes and open on different explorers, so
 * this is the one place that pairs each identifier with its page.
 *
 * The attestation's own record can be offered as soon as the chain returns it: its explorer
 * answers a UID its index does not have yet with a waiting page, not an error. The garden's
 * public page lists a report only once a steward has approved it, so a link there would open on
 * "not available" for work just published.
 */
export interface PublicationEvidence {
  chainId: number;
  transactionHash: string;
  /** Null while the transaction is mined but the attestation it carries cannot be read yet. */
  attestationUid: string | null;
}

export function publicationRecords(
  label: (key: "publish.viewAttestation" | "publish.viewTransaction") => string,
  evidence: PublicationEvidence
): OutboundLink[] {
  const transaction = {
    url: getBlockExplorerTxUrl(evidence.chainId, evidence.transactionHash),
    label: label("publish.viewTransaction"),
  };
  if (!evidence.attestationUid) return [transaction];
  return [
    {
      url: getEASExplorerUrl(evidence.chainId, evidence.attestationUid),
      label: label("publish.viewAttestation"),
    },
    transaction,
  ];
}
