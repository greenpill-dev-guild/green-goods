import type {
  SeedCopyProgress,
  SeedTrayRow,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { COMMITMENT_COMPOSER_DEFAULTS } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";

const row = (clientCommitmentId: string, values: Partial<SeedTrayRow["values"]>): SeedTrayRow => ({
  clientCommitmentId,
  values: {
    ...COMMITMENT_COMPOSER_DEFAULTS,
    kind: "SEASON_CAMPAIGN",
    unitLabel: "rides",
    targetUnits: 12,
    dueInDays: 30,
    ...values,
  },
});

/**
 * Three answers from one sitting of Seed Promises: a set of ten, a single
 * steward-reviewed one, and one with a title long enough to need its ellipsis,
 * still inside the 60-character title limit.
 */
export const SEED_STORY_TRAY_ROWS: SeedTrayRow[] = [
  row("story-surveys", {
    title: "Household water survey",
    unitLabel: "survey",
    targetUnits: 1,
    count: 10,
  }),
  row("story-clinic", {
    title: "Clinic rides on Thursdays",
    targetUnits: 8,
    claimMode: "APPROVAL_GATED",
  }),
  row("story-school", {
    title: "Someone to walk the school group to the garden each weekday",
    direction: "REQUEST",
    unitLabel: "mornings",
    targetUnits: 1,
    dueInDays: 1,
  }),
];

/** Where a Create stands, as the Review's status row and the footer read it. */
export type SeedStoryPhase =
  | "ready"
  | "asking"
  | "confirming"
  | "sending"
  | "declined"
  | "refused"
  | "unconfirmed"
  | "partial"
  | "finishLater"
  | "created";

const copy = (index: number, status: SeedCopyProgress["status"], miss?: SeedCopyProgress["miss"]) =>
  ({
    clientCommitmentId: `story-copy-${index}`,
    status,
    ...(miss ? { miss } : {}),
    txHash: status === "created" ? `0x${"ab".repeat(32)}` : null,
    jobId: `story-job-${index}`,
  }) satisfies SeedCopyProgress;

/** A set that left nothing has its jobs cleared; its answers are the steward's again. */
const cleared = (copies: SeedCopyProgress[]) => copies.map((one) => ({ ...one, jobId: null }));

/**
 * Every copy of a set of `total` at one moment of a Create: the screens the
 * design draws (PRD-1022 screens 05–12), 7 created, 2 didn't send and 1 waits
 * for the partial result among them.
 */
export function storySeedCopies(phase: SeedStoryPhase, total = 10): SeedCopyProgress[] | null {
  const all = (status: SeedCopyProgress["status"], miss?: SeedCopyProgress["miss"]) =>
    Array.from({ length: total }, (_, index) => copy(index, status, miss));
  switch (phase) {
    case "ready":
      return null;
    case "asking":
      return all("wallet");
    case "confirming":
      return all("confirming");
    case "sending":
      return Array.from({ length: total }, (_, index) =>
        copy(index, index < 2 ? "created" : index === 2 ? "wallet" : "waiting")
      );
    case "declined":
      return cleared(all("not-sent", "declined"));
    case "refused":
      return cleared(all("not-sent", "refused"));
    case "unconfirmed":
      return all("not-sent", "failed");
    case "partial":
      return Array.from({ length: total }, (_, index) =>
        index < total - 3
          ? copy(index, "created")
          : index < total - 1
            ? copy(index, "not-sent", "declined")
            : copy(index, "later")
      );
    case "finishLater":
      return Array.from({ length: total }, (_, index) =>
        copy(index, index < total - 1 ? "created" : "later")
      );
    case "created":
      return all("created");
  }
}

/** Whether a Create is still running at this phase. */
export function storySeedSending(phase: SeedStoryPhase): boolean {
  return phase === "asking" || phase === "confirming" || phase === "sending";
}
