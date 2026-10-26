/**
 * The one submission flow (PWA Home decision 21, DL-131)
 *
 * Logging work and adding evidence to a promise are one flow with two kinds: one stage sequence
 * (Start, Media, Details, Review; evidence has no Start), one forward act, one pinned promise, and
 * the media tools on the Media stage. Each kind keeps its own module (the work submission flow
 * controller, the proof composer controller), its own pieces at each stage and its own job-queue
 * path, with every payload as it was. This controller composes a kind's module into the flow's
 * stage machinery for the shared shell: which stage shows, where Back and the forward act go, how
 * far the markers have come, and the promise pinned under every heading.
 *
 * Work keeps its step in the work flow store, where a draft saves it and a resumed draft restores
 * it, so the work module owns the stage. Evidence saves no step, so the flow holds it, and starts
 * over whenever the composer is opened for another promise or by another account.
 *
 * Start has no forward act: choosing a promise or an action moves on. When its answer is known
 * the step is skipped, so the work's path opens on Media while the markers stay four, and Back
 * follows the path taken: through Start's own screens, then out of the flow.
 *
 * @module hooks/client-ui/submission/useSubmissionFlowController
 */

import { useEffect, useState } from "react";

import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types";
import { WorkTab } from "../../../stores/workFlowTypes";
import type { ProofComposerController } from "../commitment/proof-controller.types";
import type { ProofBeat, ProofBlockedReason } from "../commitment/proofReadiness";
import type { useWorkSubmissionFlowController } from "../work/useWorkSubmissionFlowController";

export type SubmissionKind = "work" | "evidence";
export type SubmissionStage = "start" | "media" | "details" | "review";

/** One stage sequence; evidence has no Start, since its promise is already chosen (decision 17). */
const SUBMISSION_STAGES: Record<SubmissionKind, readonly SubmissionStage[]> = {
  work: ["start", "media", "details", "review"],
  evidence: ["media", "details", "review"],
};

/** The step markers' names, one per stage, as DL-058 names them. */
const STAGE_LABEL_IDS: Record<SubmissionStage, string> = {
  start: "app.work.step.start",
  media: "app.work.step.media",
  details: "app.work.step.details",
  review: "app.work.step.review",
};

export type SubmissionPromiseDirection = NonNullable<CommitmentReadModel["direction"]>;

/** The promise the submission is for, pinned under every stage's heading (DL-058). */
export interface SubmissionPromise {
  title: string;
  direction: SubmissionPromiseDirection | null;
}

/** The forward act on the current stage, except where it goes. */
export interface SubmissionForwardAct {
  labelId: string;
  disabled: boolean;
  loading: boolean;
  /** Why the act waits, said above it; null when nothing is said. */
  blockedReasonId: string | null;
}

/** The Media stage's tools: the kind's own photo and camera inputs, and the voice note. */
export interface SubmissionMediaTools {
  openGallery: () => void;
  openCamera: () => void;
  toggleRecording: () => void;
  isRecording: boolean;
  /** Photos are still being prepared, so more can't be added yet. */
  disabled: boolean;
}

type WorkSubmissionFlowController = ReturnType<typeof useWorkSubmissionFlowController>;

export type SubmissionKindInput =
  | { kind: "work"; controller: WorkSubmissionFlowController }
  | {
      kind: "evidence";
      controller: ProofComposerController;
      /** The promise the composer was opened for; the flow starts over when it changes. */
      commitmentId: bigint | null;
      /** Back from Media: to the promise, or wherever the composer was opened from. */
      leave: () => void;
      /** The promise's title as the view names it: its words, else its units, else untitled. */
      promiseTitle: string;
    };

export interface SubmissionFlowController {
  kind: SubmissionKind;
  stages: readonly SubmissionStage[];
  stage: SubmissionStage;
  /** The marker the flow is on, 1-based; one past the last once the submission is done. */
  progress: number;
  stageLabelIds: readonly string[];
  goToStage: (stage: SubmissionStage) => void | Promise<void>;
  /** The previous stage on the path taken, or out of the flow from its first stage. */
  back: () => void;
  /** None on Start, where choosing a promise or an action moves on (DL-131). */
  forward: (SubmissionForwardAct & { run: () => void }) | null;
  /** On the Media stage only. */
  mediaTools: SubmissionMediaTools | null;
  promise: {
    pinned: SubmissionPromise | null;
    /** The pinned card's sheet, open over the same stage. */
    open: boolean;
    show: () => void;
    hide: () => void;
  };
}

/** What a kind's module hands the flow: its stage, when it keeps one, and its pieces of the act. */
interface SubmissionKindModule {
  stage: SubmissionStage | null;
  goToStage: ((stage: SubmissionStage) => void | Promise<void>) | null;
  /** Start's answer is known, so the path skips it (decision 17). */
  skipsStart: boolean;
  leave: () => void;
  submit: () => unknown;
  forward: (stage: ForwardStage) => SubmissionForwardAct;
  mediaTools: SubmissionMediaTools;
  completed: boolean;
  promise: SubmissionPromise | null;
  /** Whose submission this is; the flow's own state starts over when it changes. */
  identity: string | null;
}

const WORK_TAB_STAGE: Record<WorkTab, SubmissionStage> = {
  [WorkTab.Intro]: "start",
  [WorkTab.Media]: "media",
  [WorkTab.Details]: "details",
  [WorkTab.Review]: "review",
};
const STAGE_WORK_TAB: Record<SubmissionStage, WorkTab> = {
  start: WorkTab.Intro,
  media: WorkTab.Media,
  details: WorkTab.Details,
  review: WorkTab.Review,
};
/** The stages with a forward act: every one but Start. */
type ForwardStage = Exclude<SubmissionStage, "start">;

const WORK_FORWARD_LABEL_IDS: Record<ForwardStage, string> = {
  media: "app.garden.submit.tab.media.label",
  details: "app.garden.submit.tab.details.label",
  review: "app.garden.submit.tab.review.label",
};

const clickInput = (id: string) => document.getElementById(id)?.click();

/** Logging work: the step lives in the work flow store, saved and restored with the draft. */
function workKind(controller: WorkSubmissionFlowController): SubmissionKindModule {
  const stage = WORK_TAB_STAGE[controller.activeTab] ?? null;
  return {
    stage,
    goToStage: (next) => controller.changeTab(STAGE_WORK_TAB[next]),
    skipsStart: controller.start.skipped,
    // On Start, Back first returns through the step's own screens (a promise's, the actions).
    leave: () => {
      if (stage !== "start" || !controller.start.back()) controller.exit();
    },
    submit: controller.submit,
    forward: (current) => ({
      labelId:
        current === "review" && controller.isWalletRequestExpired
          ? "app.garden.submit.tab.review.retryLabel"
          : WORK_FORWARD_LABEL_IDS[current],
      disabled:
        !controller.canProceed ||
        controller.isSchedulingDependentLink ||
        controller.hasPendingLinkRecovery,
      loading: false,
      blockedReasonId: null,
    }),
    mediaTools: {
      // The media step registers its own openers once mounted; its hidden inputs are the fallback.
      openGallery: () => {
        if (controller.mediaClickRef.current) controller.mediaClickRef.current();
        else clickInput("work-media-upload");
      },
      openCamera: () => {
        if (controller.cameraClickRef.current) controller.cameraClickRef.current();
        else clickInput("work-media-camera");
      },
      toggleRecording: controller.toggleAudioRecording,
      isRecording: controller.isRecording,
      disabled: false,
    },
    // A send that failed after the queue took the work retires the draft with no outcome; its
    // markers stay on Review while the composer leaves for Your Work.
    completed:
      controller.submissionCompleted &&
      controller.submissionOutcome !== null &&
      controller.submissionOutcome.kind !== "awaiting-confirmation",
    promise: controller.linkIntent
      ? {
          title: controller.linkIntent.commitmentTitle,
          direction: controller.linkIntent.direction ?? null,
        }
      : null,
    identity: null,
  };
}

const EVIDENCE_FORWARD_LABEL_IDS: Record<ProofBeat, string> = {
  media: "app.proof.next.details",
  details: "app.proof.next.review",
  review: "app.proof.submit",
};
/** The blockers the bar can put into words; a photo still preparing says nothing. */
const EVIDENCE_BLOCKED_REASON_IDS: Partial<Record<NonNullable<ProofBlockedReason>, string>> = {
  nothing: "app.proof.blocked.nothing",
  credit: "app.proof.blocked.credit",
  "invalid-link": "app.compose.details.linkInvalid",
};

/** Adding evidence: no saved step, one promise, and Add This Proof in Submit Work's sequence. */
function evidenceKind(
  input: Extract<SubmissionKindInput, { kind: "evidence" }>
): SubmissionKindModule {
  const { controller } = input;
  return {
    stage: null,
    goToStage: null,
    skipsStart: false,
    leave: input.leave,
    submit: controller.submit,
    forward: (stage) => {
      const ready = controller.readiness(stage);
      // Both the latest attachments and the words have to be durable before moving on.
      const canAdvance = ready.canAdvance && controller.draftPersistence === "saved";
      // Only Review sends, so only its act spins while the proof is added.
      const isPending = stage === "review" && controller.isPending;
      return {
        labelId:
          stage === "review" && controller.sendToo
            ? "app.proof.submitAndSend"
            : EVIDENCE_FORWARD_LABEL_IDS[stage],
        disabled: !canAdvance && !isPending,
        loading: isPending,
        blockedReasonId: canAdvance
          ? null
          : controller.draftPersistence !== "saved"
            ? controller.draftPersistence === "failed"
              ? "app.proof.draft.saveRequired"
              : "app.proof.draft.saving"
            : ((ready.reason && EVIDENCE_BLOCKED_REASON_IDS[ready.reason]) ?? null),
      };
    },
    mediaTools: {
      openGallery: () => clickInput("proof-media-upload"),
      openCamera: () => clickInput("proof-media-camera"),
      toggleRecording: controller.toggleRecording,
      isRecording: controller.isRecording,
      disabled: controller.isProcessing,
    },
    completed: false,
    promise: controller.commitment
      ? { title: input.promiseTitle, direction: controller.commitment.direction ?? null }
      : null,
    identity: `${input.commitmentId === null ? "" : input.commitmentId.toString()}:${controller.viewer ?? ""}`,
  };
}

export function useSubmissionFlowController(input: SubmissionKindInput): SubmissionFlowController {
  const module = input.kind === "work" ? workKind(input.controller) : evidenceKind(input);
  const stages = SUBMISSION_STAGES[input.kind];
  const first = stages[0];
  const [ownStage, setOwnStage] = useState<SubmissionStage>(first);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const { identity } = module;
  // Another promise, or another account: the flow's own stage and sheet start over. After paint,
  // as the composer's reset ran, and nothing on the first render.
  useEffect(() => {
    setOwnStage(first);
    setPromiseOpen(false);
  }, [identity, first]);

  const stage = module.stage ?? ownStage;
  const goToStage = module.goToStage ?? setOwnStage;
  // The markers keep every stage; the path is the stages the member passes through.
  const path = module.skipsStart ? stages.filter((each) => each !== "start") : stages;
  const step = path.indexOf(stage);

  return {
    kind: input.kind,
    stages,
    stage,
    progress: module.completed ? stages.length + 1 : stages.indexOf(stage) + 1,
    stageLabelIds: stages.map((each) => STAGE_LABEL_IDS[each]),
    goToStage,
    back: () => {
      if (step > 0) void goToStage(path[step - 1]);
      else module.leave();
    },
    forward:
      stage === "start"
        ? null
        : {
            ...module.forward(stage),
            run: () => {
              if (stage === "review") void module.submit();
              else void goToStage(path[step + 1]);
            },
          },
    mediaTools: stage === "media" ? module.mediaTools : null,
    promise: {
      pinned: module.promise,
      open: promiseOpen,
      show: () => setPromiseOpen(true),
      hide: () => setPromiseOpen(false),
    },
  };
}
