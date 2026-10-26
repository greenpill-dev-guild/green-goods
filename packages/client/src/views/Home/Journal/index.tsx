import { useStewardDuties } from "@green-goods/shared/hooks/garden/useStewardDuties";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Garden } from "@green-goods/shared/types/domain";
import { lazy, Suspense, useEffect } from "react";

import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import type { MemberGarden } from "../homeGardens";
import { AboutGarden } from "./AboutGarden";
import { Continue } from "./Continue";
import { HighlightsCarousel } from "./HighlightsCarousel";
import { NeedsYourAttention } from "./NeedsYourAttention";
import { RecentActivity } from "./RecentActivity";
import { TakePart } from "./TakePart";

// The garden's open promises load on first use and stay out of the installed app's startup bundle.
const TakePartSheet = lazy(() =>
  import("./TakePartSheet").then(({ TakePartSheet }) => ({ default: TakePartSheet }))
);

export interface HomeJournalProps {
  /** The active garden's record (`useActiveGarden().garden` once `ready`). */
  garden: Garden;
  /** The account's roles in the active garden, owner first, and a pending open join. */
  membership: MemberGarden["membership"];
}

/**
 * Home's body in the member's active garden (DL-123, DL-127), under Home's sticky header and
 * inside the app's scroller. Home mounts it only once the active garden is `ready`; loading,
 * error, no garden and the chooser are Home's own states.
 *
 * This is the one place the compact journal's sections mount, in this order: Needs Your
 * Attention for stewards (step 19), the Highlights carousel and Recent Activity (step 7),
 * Continue (step 8), Take Part (step 9), then About This Garden (step 10, DL-128), whose rows
 * and sheets keep every entry point the garden page offered within reach of Home. Where About
 * sits is reviewed once the first slice renders.
 *
 * The garden's duties are read once here. Needs Your Attention draws them, and a duty card in
 * the carousel would take the first of the same read, so both show one count. Take Part's See
 * All and a cycle's Show Its Promises open the garden's open promises over the journal; they
 * close when the journal leaves Home or turns to another garden.
 */
export function HomeJournal({ garden }: HomeJournalProps) {
  const duties = useStewardDuties(garden);
  const takePartOpen = useUIStore((state) => state.takePartSheet !== null);
  const closeTakePartSheet = useUIStore((state) => state.closeTakePartSheet);
  // The sheet stays mounted until its exit has played.
  const takePartPresent = useExitPresence(takePartOpen, getPwaSheetExitMs);
  // The store outlives the journal: leaving Home or turning to another garden closes the sheet,
  // so it never reopens stale.
  useEffect(() => closeTakePartSheet, [closeTakePartSheet, garden.id]);
  return (
    <div className="flex flex-col pb-4">
      <NeedsYourAttention garden={garden} duties={duties} />
      <HighlightsCarousel gardenId={garden.id} />
      <RecentActivity gardenId={garden.id} />
      <Continue />
      <TakePart gardenId={garden.id} />
      <AboutGarden garden={garden} />
      {takePartPresent ? (
        <Suspense fallback={null}>
          <TakePartSheet garden={garden} />
        </Suspense>
      ) : null}
    </div>
  );
}
