import {
  type Address,
  buildCommitmentCreationPayload,
  type CommitmentComposerValues,
  commitmentComposerSchema,
  DEFAULT_CHAIN_ID,
  useCommitmentComposerForm,
  useCommitmentJobs,
  useCommitmentPools,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";
import { ComposeKind } from "./ComposeKind";
import { ComposeReview } from "./ComposeReview";
import { ComposeTerms } from "./ComposeTerms";
import { ComposeWhat } from "./ComposeWhat";

const BEATS = ["kind", "what", "terms", "review"] as const;
type Beat = (typeof BEATS)[number];

/**
 * Making a commitment, in four beats.
 *
 * It follows the shipped Submit Work rhythm on purpose: one question per
 * screen, a progress row in the header, and a single primary in a fixed bar.
 * A gardener who has submitted work already knows how this behaves.
 *
 * The whole thing is offline-first. Placing a commitment queues a job rather
 * than sending a call, so a member standing in a garden with no signal can
 * still make one, and the queue is what refuses to make the same one twice.
 */
export function ComposeCommitment() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { id: gardenAddress } = useParams<{ id: string }>();
  const { isOnline } = useOffline();
  const viewer = usePrimaryAddress();
  const chainId = DEFAULT_CHAIN_ID;

  const [beat, setBeat] = useState<Beat>("kind");
  const [placed, setPlaced] = useState(false);

  const form = useCommitmentComposerForm();
  const values = form.watch();

  const { pools } = useCommitmentPools({
    chainId,
    garden: gardenAddress as Address | undefined,
  });
  const pool = pools[0];
  const jobs = useCommitmentJobs({ chainId });

  // One id per draft, generated once. It is what the queue derives the
  // creation key from, so it must not change between a failed send and a retry.
  const clientCommitmentId = useMemo(() => crypto.randomUUID(), []);

  const beatIndex = BEATS.indexOf(beat);
  const canAdvance = beatCanAdvance(beat, values);
  const blockingReasonId = beatBlockingReason(beat, values);

  const place = async () => {
    if (!pool || !viewer || !gardenAddress) return;
    try {
      await enqueueCommitment();
      setPlaced(true);
    } catch {
      // useCommitmentJobs already surfaced this; nothing further to say here.
    }
  };

  const enqueueCommitment = () =>
    jobs.enqueue({
      act: "create",
      payload: buildCommitmentCreationPayload({
        values,
        clientCommitmentId,
        poolId: pool.poolId,
        cycleId: pool.openSeasonCycleId ?? 0n,
        creator: viewer as Address,
        gardenAddress: gardenAddress as Address,
        nowSeconds: Math.floor(Date.now() / 1000),
      }),
    });

  if (placed) {
    return (
      <Shell onBack={() => navigate("..", { relative: "path" })}>
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
            onClick={() => navigate("..", { relative: "path" })}
            className="mt-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.compose.done.back" })}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      onBack={() =>
        beatIndex === 0
          ? navigate("..", { relative: "path" })
          : setBeat(BEATS[beatIndex - 1] as Beat)
      }
      progress={beatIndex + 1}
      bar={
        <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!canAdvance && blockingReasonId ? (
            <p className="mb-2 text-xs text-text-sub-600" id="compose-blocked" role="status">
              {formatMessage({ id: blockingReasonId })}
            </p>
          ) : null}
          <button
            aria-describedby={!canAdvance && blockingReasonId ? "compose-blocked" : undefined}
            type="button"
            disabled={!canAdvance || jobs.isPending || (beat === "review" && !pool)}
            aria-busy={jobs.isPending}
            onClick={() =>
              beat === "review" ? void place() : setBeat(BEATS[beatIndex + 1] as Beat)
            }
            className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
          >
            {formatMessage({
              id: beat === "review" ? "app.compose.place" : "app.compose.next",
            })}
          </button>
        </div>
      }
    >
      {beat === "kind" ? (
        <ComposeKind
          value={values.direction}
          onChange={(direction) => form.setValue("direction", direction, { shouldValidate: true })}
        />
      ) : null}
      {beat === "what" ? <ComposeWhat form={form} /> : null}
      {beat === "terms" ? <ComposeTerms form={form} /> : null}
      {beat === "review" ? (
        <ComposeReview values={values} isOnline={isOnline} hasPool={Boolean(pool)} />
      ) : null}
    </Shell>
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
  if (beat !== "what") return null;
  if (values.title.trim().length === 0) return "app.compose.blocked.title";
  if (values.unitLabel.trim().length === 0) return "app.compose.blocked.unit";
  if (!Number.isFinite(values.targetUnits) || values.targetUnits <= 0) {
    return "app.compose.blocked.count";
  }
  return null;
}

/** Which answers each beat is responsible for. */
const BEAT_FIELDS = {
  kind: ["direction"],
  what: ["title", "unitLabel", "targetUnits"],
  terms: ["dueInDays"],
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
  return !result.error.issues.some((issue) =>
    fields.includes(issue.path[0] as (typeof fields)[number])
  );
}

function Shell({
  children,
  onBack,
  progress,
  bar,
}: {
  children: React.ReactNode;
  onBack: () => void;
  progress?: number;
  bar?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();
  const steps = [
    formatMessage({ id: "app.compose.beat.kind" }),
    formatMessage({ id: "app.compose.beat.what" }),
    formatMessage({ id: "app.compose.beat.terms" }),
    formatMessage({ id: "app.compose.beat.review" }),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack}>
        {progress ? <FormProgress currentStep={progress} steps={steps} /> : null}
      </TopNav>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 pb-24">{children}</div>
      </div>
      {bar}
    </div>
  );
}

export default ComposeCommitment;
