import type { Address } from "@green-goods/shared";

export interface SeedCommitmentDialogProps {
  open: boolean;
  chainId: number;
  garden: Address;
  onClose: () => void;
}

/**
 * W8, the steward's seeding console (uiux-spec §6.3). Built in the next
 * commit; this shell keeps the route mounted so the descriptor can open it.
 */
export function SeedCommitmentDialog(_props: SeedCommitmentDialogProps) {
  return null;
}
