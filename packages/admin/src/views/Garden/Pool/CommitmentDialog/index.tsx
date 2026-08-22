import type { Address } from "@green-goods/shared";

export interface CommitmentDialogPanelProps {
  chainId: number;
  garden: Address;
  commitmentId: string;
  tone: "garden" | "hub" | "community";
}

/**
 * W10, one commitment in the steward's dialect (uiux-spec §6.7). Built in a
 * later commit; this shell keeps the inspector route mounted.
 */
export function CommitmentDialogPanel(_props: CommitmentDialogPanelProps) {
  return null;
}
