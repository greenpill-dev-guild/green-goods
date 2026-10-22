import type { MessageDescriptor } from "react-intl";

/**
 * The Garden cycle as `/impact` tells it (`PublicEvidencePipeline`): Needs →
 * Commitment → Work → Learnings (experience audit AD-9). The array is the single
 * source of the order and the descriptors the single source of the words. The home
 * page's "How it works" (`PublicRecordLoop`) borrows the first three stages' names
 * and descriptions under its own action titles, so the two pages cannot drift.
 *
 * Descriptions stay in one length band so the four columns on `/impact` end level.
 */
export const CYCLE_STEPS = ["needs", "commitment", "work", "learnings"] as const;

export type CycleStepKind = (typeof CYCLE_STEPS)[number];

export const CYCLE_STEP_MESSAGES: Record<
  CycleStepKind,
  { title: MessageDescriptor; description: MessageDescriptor }
> = {
  needs: {
    title: { id: "public.impact.pipeline.step.needs.title", defaultMessage: "Needs" },
    description: {
      id: "public.impact.pipeline.step.needs.description",
      defaultMessage:
        "Understand what the place and its people need. An assessment records the starting conditions.",
    },
  },
  commitment: {
    title: { id: "public.impact.pipeline.step.commitment.title", defaultMessage: "Promise" },
    description: {
      id: "public.impact.pipeline.step.commitment.description",
      defaultMessage:
        "People agree on what needs doing, who will do it, and by when. The community can follow each one.",
    },
  },
  work: {
    title: { id: "public.impact.pipeline.step.work.title", defaultMessage: "Work" },
    description: {
      id: "public.impact.pipeline.step.work.description",
      defaultMessage:
        "Participants record the work with photos and notes. Stewards review it before it goes public.",
    },
  },
  learnings: {
    title: { id: "public.impact.pipeline.step.learnings.title", defaultMessage: "Learnings" },
    description: {
      id: "public.impact.pipeline.step.learnings.description",
      defaultMessage:
        "Compare the evidence with the starting conditions. Assessments record the baseline and evidence standards.",
    },
  },
};

/** The line that closes the cycle under its last step. */
export const CYCLE_LOOP_MESSAGE: MessageDescriptor = {
  id: "public.impact.pipeline.loop",
  defaultMessage: "→ and what was learned shapes the next season's needs.",
};
