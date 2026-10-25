import type { Garden } from "@green-goods/shared/types/domain";
import type { MemberGarden } from "../homeGardens";
import { HighlightsCarousel } from "./HighlightsCarousel";
import { RecentActivity } from "./RecentActivity";
import { TakePart } from "./TakePart";

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
 * Continue (step 8), Take Part (step 9), then the About entry (step 10). Each section brings its
 * own 16px gutter, so the carousel can scroll to the screen's edges.
 */
export function HomeJournal({ garden }: HomeJournalProps) {
  return (
    <div data-component="HomeJournal" className="flex flex-col gap-4">
      <HighlightsCarousel gardenId={garden.id} />
      <RecentActivity gardenId={garden.id} />
      <TakePart gardenId={garden.id} />
    </div>
  );
}
