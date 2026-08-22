import type { Address, CommitmentsToConfirm } from "@green-goods/shared";

export interface HubConfirmQueueProps {
  toConfirm: CommitmentsToConfirm;
  chainId: number;
  viewer?: Address;
  normalizedSearch: string;
  selectedCommitmentId: string | undefined;
  onOpenCommitment: (commitmentId: string) => void;
}

/**
 * W13, the Hub's Confirm stage (uiux-spec §6.9). Built in a later commit; the
 * stage is mounted now so its count and route exist.
 */
export function HubConfirmQueue(_props: HubConfirmQueueProps) {
  return null;
}
