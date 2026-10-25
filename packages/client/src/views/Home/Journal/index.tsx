import type { Garden } from "@green-goods/shared/types/domain";
import { lazy, Suspense } from "react";
import { HomeLoading } from "../HomeStates";
import type { MemberGarden } from "../homeGardens";
import { Continue } from "./Continue";
import { HighlightsCarousel } from "./HighlightsCarousel";
import { RecentActivity } from "./RecentActivity";
import { TakePart } from "./TakePart";

// The interim end of the journal is the whole garden page (tabs, sheets, pools), so it loads on
// its own and stays out of the installed app's startup bundle.
const GardenPage = lazy(() =>
  import("../Garden/GardenPage").then(({ GardenPage }) => ({ default: GardenPage }))
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
 * Continue (step 8), Take Part (step 9), then the About entry (step 10), whose place is reviewed
 * once the first slice renders. Until About lands, the garden's own page closes the journal in
 * its place, its banner, tabs and actions without Back, so nothing that page offers is out of
 * reach from Home.
 */
export function HomeJournal({ garden }: HomeJournalProps) {
  return (
    <div className="flex flex-col">
      <HighlightsCarousel gardenId={garden.id} />
      <RecentActivity gardenId={garden.id} />
      <Continue />
      <TakePart gardenId={garden.id} />
      <div className="pt-4">
        <Suspense fallback={<HomeLoading remembered />}>
          <GardenPage garden={garden} layout="home" />
        </Suspense>
      </div>
    </div>
  );
}
