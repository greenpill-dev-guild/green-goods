import {
  type Address,
  buildCommitmentCreationPayload,
  type CommitmentComposerValues,
  commitmentComposerSchema,
  DEFAULT_CHAIN_ID,
  DialogShell,
  useActions,
  useCommitmentComposerForm,
  useCommitmentCycleNames,
  useCommitmentCycles,
  useCommitmentJobs,
  useCommitmentPools,
  useGardens,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared";
// The narrowest declared subpath: the draft store is device state, not a hook.
import {
  commitmentComposerDraftKey,
  useCommitmentComposerDraftStore,
} from "@green-goods/shared/stores";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { useIntl } from "react-intl";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";
import { ComposeDetails } from "./ComposeDetails";
import { actionUIDOf, ComposeHowMuch } from "./ComposeHowMuch";
import { ComposeReview } from "./ComposeReview";
import { ComposeWhat } from "./ComposeWhat";

const BEATS = ["what", "howMuch", "details", "review"] as const;
type Beat = (typeof BEATS)[number];
type Direction = "OFFER" | "REQUEST";

/** The door that opened the form. Anything else is not a direction. */
function directionFromRoute(value: string | null): Direction | null {
  if (value === "offer") return "OFFER";
  if (value === "request") return "REQUEST";
  return null;
}

/**
 * Making a commitment, in the four beats the shipped Submit Work flow uses:
 * what, how much, details, review. One question per screen, a progress row
 * in the header, and a single primary in a fixed bar, so a gardener who has
 * submitted work already knows how this behaves.
 *
 * Direction is fixed by the door that opened the form and never asked again
 * inside it: a member who meant the other one leaves and comes back through
 * the other door. A form reached with no door goes back to the garden rather
 * than guessing.
 *
 * The whole thing is offline-first. Placing a commitment queues a job rather
 * than sending a call, so a member standing in a garden with no signal can
 * still make one, and the queue is what refuses to make the same one twice.
 * What they typed is kept on the device until it is placed or discarded.
 */
export function ComposeCommitment() {
  const [searchParams] = useSearchParams();
  const direction = directionFromRoute(searchParams.get("direction"));
  if (!direction) return <Navigate to=".." replace />;
  return <ComposeCommitmentForm direction={direction} />;
}

function ComposeCommitmentForm({ direction }: { direction: Direction }) {
  const { formatMessage, formatRelativeTime } = useIntl();
  const navigate = useNavigate();
  const { id: gardenAddress } = useParams<{ id: string }>();
  const { isOnline } = useOffline();
  const viewer = usePrimaryAddress();
  const chainId = DEFAULT_CHAIN_ID;

  const { pools } = useCommitmentPools({
    chainId,
    garden: gardenAddress as Address | undefined,
  });
  const pool = pools[0];
  const { cycles } = useCommitmentCycles({ chainId, poolId: pool?.poolId ?? 0n, state: "OPEN" });
  const openCycles = useMemo(
    () =>
      pool
        ? [...cycles].sort((left, right) =>
            // The season leads; campaigns follow in the order they were opened.
            left.cycleType === right.cycleType ? 0 : left.cycleType === "SEASON" ? -1 : 1
          )
        : [],
    [cycles, pool]
  );
  const { byCycleId: cycleNames } = useCommitmentCycleNames(openCycles);
  const { data: actions = [] } = useActions(chainId);
  const { data: gardens = [] } = useGardens();
  const gardenName =
    gardens.find((garden) => garden.id.toLowerCase() === gardenAddress?.toLowerCase())?.name ??
    null;
  const jobs = useCommitmentJobs({ chainId });

  // The draft is keyed by who, where and through which door, and carries its
  // own client id: the queue derives the creation key from that id, so a
  // draft resumed after a restart keeps the key it started with.
  const draftKey =
    viewer && gardenAddress
      ? commitmentComposerDraftKey({ chainId, viewer, garden: gardenAddress, direction })
      : null;
  const drafts = useCommitmentComposerDraftStore((state) => state.drafts);
  const saveDraft = useCommitmentComposerDraftStore((state) => state.saveDraft);
  const clearDraft = useCommitmentComposerDraftStore((state) => state.clearDraft);
  const [savedDraft] = useState(() => (draftKey ? drafts[draftKey] : undefined));
  const [draftDecision, setDraftDecision] = useState<"pending" | "decided">(
    savedDraft ? "pending" : "decided"
  );
  const [clientCommitmentId, setClientCommitmentId] = useState(
    () => savedDraft?.clientCommitmentId ?? crypto.randomUUID()
  );

  const [beat, setBeat] = useState<Beat>("what");
  const [placed, setPlaced] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const reviewEndRef = useRef<HTMLDivElement>(null);

  const form = useCommitmentComposerForm({
    direction,
    // An offer leads with garden work, an ask with help: the same two cards,
    // in the order each door's first visitor most often wants.
    kind: direction === "REQUEST" ? "SERVICE" : "GARDEN_WORK",
    ...(direction === "OFFER" ? { unitLabel: "hours" } : {}),
  });
  // useWatch rather than form.watch: the React Compiler memoises this
  // component, and a read of the form's mutable values is invisible to it.
  // Typed as the full shape: every field has a default, so the partial
  // useWatch declares is never actually partial here.
  const values = useWatch({ control: form.control }) as CommitmentComposerValues;
  // Read in render so the form state proxy subscribes this component to it.
  const isDirty = form.formState.isDirty;

  // Bind the one legal target without asking; a chooser appears in the what
  // beat only when more than one cycle is open.
  useEffect(() => {
    if (draftDecision !== "decided") return;
    if (openCycles.length === 0) return;
    const current = values.cycleId;
    if (openCycles.some((cycle) => cycle.cycleId.toString() === current)) return;
    form.setValue("cycleId", openCycles[0]!.cycleId.toString(), { shouldValidate: true });
  }, [openCycles, values.cycleId, form, draftDecision]);

  // Keep the device's copy current. Saving the defaults would leave a draft
  // behind a form nobody touched, so nothing is written until the form is dirty.
  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (!draftKey || placed || draftDecision !== "decided" || !isDirty) return;
    saveDraft(draftKey, { values: JSON.parse(serialized), clientCommitmentId });
  }, [serialized, draftKey, placed, draftDecision, isDirty, saveDraft, clientCommitmentId]);

  const resumeDraft = () => {
    if (savedDraft) {
      form.reset({
        ...form.getValues(),
        ...(savedDraft.values as Partial<CommitmentComposerValues>),
        direction,
      });
    }
    setDraftDecision("decided");
  };
  const startFresh = () => {
    if (draftKey) clearDraft(draftKey);
    setClientCommitmentId(crypto.randomUUID());
    setDraftDecision("decided");
  };

  const beatIndex = BEATS.indexOf(beat);
  const canAdvance = beatCanAdvance(beat, values);
  const blockingReasonId = beatBlockingReason(beat, values);
  const actionTitle = useCallback(
    (uid: string) =>
      actions.find((action) => actionUIDOf(action.id, chainId) === uid)?.title ?? `#${uid}`,
    [actions, chainId]
  );
  const onReadToEnd = useCallback(() => setReadToEnd(true), []);

  const place = async () => {
    if (!pool || !viewer || !gardenAddress) return;
    try {
      await jobs.enqueue({
        act: "create",
        payload: buildCommitmentCreationPayload({
          values,
          clientCommitmentId,
          poolId: pool.poolId,
          creator: viewer as Address,
          gardenAddress: gardenAddress as Address,
          nowSeconds: Math.floor(Date.now() / 1000),
        }),
      });
      if (draftKey) clearDraft(draftKey);
      setPlaced(true);
    } catch {
      // useCommitmentJobs already surfaced this; nothing further to say here.
    }
  };

  const actTitle = formatMessage({
    id: direction === "REQUEST" ? "app.compose.title.request" : "app.compose.title.offer",
  });
  const placeLabelId =
    direction === "REQUEST"
      ? values.kind === "GARDEN_WORK"
        ? "app.compose.place.requestWork"
        : "app.compose.place.request"
      : "app.compose.place.offer";

  if (placed) {
    return (
      <Shell onBack={() => navigate("..")} title={actTitle}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-lg font-medium text-text-strong-950">
            {formatMessage({
              id: isOnline ? "app.compose.done.title" : "app.compose.done.offlineTitle",
            })}
          </h1>
          <p className="max-w-sm text-sm text-text-sub-600">
            {formatMessage({
              id: isOnline ? "app.compose.done.body" : "app.compose.done.offlineBody",
            })}
          </p>
          <button
            type="button"
            onClick={() => navigate("..")}
            className="mt-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.compose.done.back" })}
          </button>
        </div>
      </Shell>
    );
  }

  const isReview = beat === "review";
  const primaryBlocked = !canAdvance || jobs.isPending || (isReview && (!pool || !readToEnd));

  return (
    <>
      <Shell
        onBack={() => (beatIndex === 0 ? navigate("..") : setBeat(BEATS[beatIndex - 1] as Beat))}
        title={actTitle}
        progress={beatIndex + 1}
        bar={
          <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {!canAdvance && blockingReasonId ? (
              <p className="mb-2 text-xs text-text-sub-600" id="compose-blocked" role="status">
                {formatMessage({ id: blockingReasonId })}
              </p>
            ) : null}
            {isReview && !readToEnd ? (
              <button
                type="button"
                onClick={() => {
                  reviewEndRef.current?.scrollIntoView({ block: "end" });
                  setReadToEnd(true);
                }}
                className="mb-2 flex w-full items-center justify-center rounded-[var(--radius-lg)] px-4 py-2 text-sm font-medium text-text-sub-600 tap-target-lg"
              >
                {formatMessage({ id: "app.compose.review.readToEnd" })}
              </button>
            ) : null}
            <button
              aria-describedby={!canAdvance && blockingReasonId ? "compose-blocked" : undefined}
              type="button"
              disabled={primaryBlocked}
              aria-busy={jobs.isPending}
              onClick={() => (isReview ? void place() : setBeat(BEATS[beatIndex + 1] as Beat))}
              className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
            >
              {formatMessage({ id: isReview ? placeLabelId : "app.compose.next" })}
            </button>
          </div>
        }
      >
        {beat === "what" ? (
          <ComposeWhat form={form} openCycles={openCycles} cycleNames={cycleNames} />
        ) : null}
        {beat === "howMuch" ? (
          <ComposeHowMuch form={form} chainId={chainId} actions={actions} />
        ) : null}
        {beat === "details" ? <ComposeDetails form={form} /> : null}
        {isReview ? (
          <ComposeReview
            values={values}
            isOnline={isOnline}
            hasPool={Boolean(pool)}
            gardenName={gardenName}
            openCycles={openCycles}
            cycleNames={cycleNames}
            actionTitle={actionTitle}
            onReadToEnd={onReadToEnd}
            endRef={reviewEndRef}
          />
        ) : null}
      </Shell>

      <DialogShell
        open={draftDecision === "pending"}
        onOpenChange={(open) => {
          if (!open) resumeDraft();
        }}
        title={formatMessage({ id: "app.compose.draft.title" })}
        description={
          savedDraft
            ? formatMessage(
                { id: "app.compose.draft.body" },
                {
                  when: formatRelativeTime(
                    Math.round((savedDraft.updatedAt - Date.now()) / 60_000),
                    "minute",
                    { numeric: "auto" }
                  ),
                }
              )
            : undefined
        }
        size="md"
      >
        <div className="space-y-3">
          {savedDraft?.values &&
          typeof savedDraft.values.title === "string" &&
          savedDraft.values.title ? (
            <p className="truncate text-sm font-medium text-text-strong-950">
              {savedDraft.values.title}
            </p>
          ) : null}
          <button
            type="button"
            onClick={resumeDraft}
            className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.compose.draft.resume" })}
          </button>
          <button
            type="button"
            onClick={startFresh}
            className="w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium text-text-sub-600 tap-target-lg"
          >
            {formatMessage({ id: "app.compose.draft.fresh" })}
          </button>
        </div>
      </DialogShell>
    </>
  );
}

/**
 * Why this beat will not let the member continue.
 *
 * Disabling a control without saying why leaves someone tapping a dead button
 * and guessing. The schema's own messages are written for developers, so the
 * beat says the missing thing in the member's terms instead.
 */
function beatBlockingReason(beat: Beat, values: CommitmentComposerValues): string | null {
  if (beat === "what") {
    if (values.title.trim().length === 0) return "app.compose.blocked.title";
    return null;
  }
  if (beat === "howMuch") {
    if (values.unitLabel.trim().length === 0) return "app.compose.blocked.unit";
    if (!Number.isFinite(values.targetUnits) || values.targetUnits <= 0) {
      return "app.compose.blocked.count";
    }
    if (values.kind === "GARDEN_WORK") {
      if (values.requirements.length === 0) return "app.compose.blocked.action";
      if (
        values.requirements.some(
          (row) => !Number.isInteger(row.requiredCount) || row.requiredCount < 1
        )
      ) {
        return "app.compose.blocked.rowCount";
      }
    }
    return null;
  }
  return null;
}

/** Which answers each beat is responsible for. */
const BEAT_FIELDS = {
  what: ["title", "kind", "cycleId"],
  howMuch: ["unitLabel", "targetUnits", "dueInDays", "requirements", "claimMode"],
  details: ["note", "links", "openTeam", "protocolFallbackEnabled"],
  review: [],
} as const satisfies Record<Beat, readonly (keyof CommitmentComposerValues)[]>;

/**
 * Each beat gates on its own answers only, so a member is never blocked at beat
 * two by something they have not been asked yet.
 *
 * The rules come from the schema rather than being restated here. Two copies of
 * "a commitment needs a name" is how one of them ends up saying otherwise.
 */
function beatCanAdvance(beat: Beat, values: CommitmentComposerValues): boolean {
  const fields = BEAT_FIELDS[beat];
  if (fields.length === 0) return true;
  const result = commitmentComposerSchema.safeParse(values);
  if (result.success) return true;
  const owned: readonly string[] = fields;
  return !result.error.issues.some((issue) => owned.includes(String(issue.path[0])));
}

function Shell({
  children,
  onBack,
  title,
  progress,
  bar,
}: {
  children: React.ReactNode;
  onBack: () => void;
  /** The act the door named: the wizard is titled, the door was one word. */
  title: string;
  progress?: number;
  bar?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();
  const steps = [
    formatMessage({ id: "app.compose.beat.what" }),
    formatMessage({ id: "app.compose.beat.howMuch" }),
    formatMessage({ id: "app.compose.beat.details" }),
    formatMessage({ id: "app.compose.beat.review" }),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack}>
        {progress ? <FormProgress currentStep={progress} steps={steps} /> : null}
      </TopNav>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">{title}</p>
          {children}
        </div>
      </div>
      {bar}
    </div>
  );
}

export default ComposeCommitment;
