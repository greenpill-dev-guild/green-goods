// Command Surface: a season's or campaign's details over Home (DL-127).
import type { CommitmentCycleRecord } from "@green-goods/shared/commitment-pooling";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { lazy, Suspense, useEffect, useState } from "react";

// The details sheet, and the app's sheet frame with it, load with the first details opened rather
// than with Home.
const CycleDetailsSheet = lazy(() =>
  import("@/components/Features/Commitments/CycleDetailsSheet").then(({ CycleDetailsSheet }) => ({
    default: CycleDetailsSheet,
  }))
);

export interface JournalCycleDetailsProps {
  cycle: CommitmentCycleRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

/** The cycle Show Its Promises opens the garden's open promises at: its id, and its kind. */
type PromisesFor = { cycleId: string; cycleType: CommitmentCycleRecord["cycleType"] };

/**
 * A season's or campaign's details sheet, opened from a Highlights card or a cycle line. Its Show
 * Its Promises opens the garden's open promises at the cycle (`TakePartSheet`) only once the
 * details have closed: closing hands focus back to the card or line that opened them, so that
 * sheet records it as its opener and returns focus there, not to the details' own button, which
 * unmounts.
 */
export function JournalCycleDetails({ cycle, isOpen, onClose }: JournalCycleDetailsProps) {
  const openTakePartSheet = useUIStore((state) => state.openTakePartSheet);
  const [promisesFor, setPromisesFor] = useState<PromisesFor | null>(null);
  // Mounted from the first opening on, so every later opening and closing plays as before.
  const [requested, setRequested] = useState(isOpen);
  if (isOpen && !requested) setRequested(true);

  // Runs after the commit that closed the details, whose opener focus was restored before it.
  useEffect(() => {
    if (isOpen || promisesFor === null) return;
    setPromisesFor(null);
    openTakePartSheet(promisesFor);
  }, [isOpen, promisesFor, openTakePartSheet]);

  if (!requested) return null;
  return (
    <Suspense fallback={null}>
      <CycleDetailsSheet
        cycle={cycle}
        isOpen={isOpen}
        onClose={onClose}
        onShowPromises={(cycleId) => {
          setPromisesFor({ cycleId: cycleId.toString(), cycleType: cycle?.cycleType ?? null });
          onClose();
        }}
      />
    </Suspense>
  );
}
