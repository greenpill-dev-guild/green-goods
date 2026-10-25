// Command Surface: a season's or campaign's details over Home (DL-127).
import type { CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { useEffect, useState } from "react";

import { CycleDetailsSheet } from "@/components/Features/Commitments";

export interface JournalCycleDetailsProps {
  cycle: CommitmentCycleRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A season's or campaign's details sheet, opened from a Highlights card or a cycle line. Its Show
 * Its Promises opens the Promises sheet filtered to the cycle only once the details have closed:
 * closing hands focus back to the card or line that opened them, so the Promises sheet records
 * that as its opener and returns focus there, not to the details' own button, which unmounts.
 */
export function JournalCycleDetails({ cycle, isOpen, onClose }: JournalCycleDetailsProps) {
  const openCommitmentsSheet = useUIStore((state) => state.openCommitmentsSheet);
  const [promisesFor, setPromisesFor] = useState<string | null>(null);

  // Runs after the commit that closed the details, whose opener focus was restored before it.
  useEffect(() => {
    if (isOpen || promisesFor === null) return;
    setPromisesFor(null);
    openCommitmentsSheet({ cycleId: promisesFor });
  }, [isOpen, promisesFor, openCommitmentsSheet]);

  return (
    <CycleDetailsSheet
      cycle={cycle}
      isOpen={isOpen}
      onClose={onClose}
      onShowPromises={(cycleId) => {
        setPromisesFor(cycleId.toString());
        onClose();
      }}
    />
  );
}
