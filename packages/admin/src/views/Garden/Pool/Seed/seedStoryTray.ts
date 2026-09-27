import type { SeedTrayRow } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { COMMITMENT_COMPOSER_DEFAULTS } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";

const row = (
  clientCommitmentId: string,
  values: Partial<SeedTrayRow["values"]>,
  notSent?: true
): SeedTrayRow => ({
  clientCommitmentId,
  values: {
    ...COMMITMENT_COMPOSER_DEFAULTS,
    kind: "SEASON_CAMPAIGN",
    unitLabel: "rides",
    targetUnits: 12,
    dueInDays: 30,
    ...values,
  },
  ...(notSent ? { notSent } : {}),
});

/**
 * Three commitments from one sitting of the seeding console. The middle one was
 * sent and nothing was created for it; the last one has a title long enough to
 * need its ellipsis, and still inside the 60-character title limit.
 */
export const SEED_STORY_TRAY_ROWS: SeedTrayRow[] = [
  row("story-market", { title: "Market rides for the co-op" }),
  row(
    "story-clinic",
    { title: "Clinic rides on Thursdays", targetUnits: 8, claimMode: "APPROVAL_GATED" },
    true
  ),
  row("story-school", {
    title: "Someone to walk the school group to the garden each weekday",
    direction: "REQUEST",
    unitLabel: "mornings",
    targetUnits: 1,
    dueInDays: 1,
  }),
];
