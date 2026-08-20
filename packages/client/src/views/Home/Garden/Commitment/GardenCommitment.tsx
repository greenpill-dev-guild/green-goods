import {
  type Address,
  DEFAULT_CHAIN_ID,
  selectCommitmentSeat,
  StatusBadge,
  useCommitment,
  useCommitmentJobs,
  useCommitmentMetadataFor,
  useCommitmentMutation,
  useCommitmentQueueState,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared";
import { RiGroupLine, RiRefreshLine, RiSearchLine, RiWifiOffLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { presentState } from "@/components/Features/Commitments";
import { EmptyState } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";
import { CommitmentActionBar } from "./CommitmentActionBar";
import { canJoinTeam, selectCommitmentAct } from "./commitmentActions";
import { CommitmentPeople } from "./CommitmentPeople";
import { CommitmentProgress } from "./CommitmentProgress";
import { selectStatusBand } from "./statusBand";
import { WithdrawDialog } from "./WithdrawDialog";

/** ICommitmentPoolingModule.ClaimType.Individual — a person claiming as themselves. */
const CLAIM_TYPE_INDIVIDUAL = 1;

const BAND_TONE_CLASS = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50",
  waiting: "border-stroke-soft-200 bg-bg-weak-50",
  attention: "border-warning-light bg-warning-lighter",
  kept: "border-success-light bg-success-lighter",
} as const;

/**
 * One commitment, read by one person.
 *
 * Order is deliberate. Status sits above the identity, because a status message
 * read after the people and the progress bars is a status message nobody reads.
 * The act, when the reader has one, lives in a fixed bar rather than inside the
 * content, so the screen keeps the story and the bar owns the doing.
 */
export function GardenCommitment() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { commitmentId: commitmentIdParam, id: gardenAddress } = useParams<{
    commitmentId: string;
    id: string;
  }>();
  const { isOnline } = useOffline();
  const viewer = usePrimaryAddress();
  const chainId = DEFAULT_CHAIN_ID;

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const commitmentId = useMemo(() => {
    if (!commitmentIdParam) return null;
    try {
      return BigInt(commitmentIdParam);
    } catch {
      return null;
    }
  }, [commitmentIdParam]);

  const { detail, isLoading, isError, refetch, availability } = useCommitment({
    chainId,
    commitmentId: commitmentId ?? 0n,
  });
  const jobs = useCommitmentJobs({ chainId });
  // Asked of the queue rather than remembered locally: a flag set when an act
  // is queued never hears that it landed, so the bar stayed suppressed for the
  // component's lifetime and survived navigation between commitments.
  const { pendingCommitmentIds } = useCommitmentQueueState(viewer as Address | null);
  const metadata = useCommitmentMetadataFor(detail?.commitment);
  const onlineMutation = useCommitmentMutation({ chainId });

  const seat = useMemo(() => {
    if (!detail) return null;
    return selectCommitmentSeat({
      commitment: detail.commitment,
      contributors: detail.contributors.filter((c) => c.active).map((c) => c.contributor),
      viewer: (viewer ?? undefined) as Address | undefined,
    });
  }, [detail, viewer]);

  const back = () => navigate(-1);

  if (!commitmentId || (!isLoading && !detail && !isError)) {
    return (
      <DetailShell onBack={back}>
        <EmptyState
          icon={<RiSearchLine />}
          title={formatMessage({ id: "app.commitment.notFound.title" })}
          description={formatMessage({ id: "app.commitment.notFound.body" })}
        />
      </DetailShell>
    );
  }

  if (availability.status !== "available") {
    return (
      <DetailShell onBack={back}>
        <EmptyState
          icon={<RiWifiOffLine />}
          title={formatMessage({ id: "app.commitments.notReady.title" })}
          description={formatMessage({ id: "app.commitments.notReady.description" })}
        />
      </DetailShell>
    );
  }

  if (isLoading) {
    return (
      <DetailShell onBack={back}>
        <div className="space-y-3" role="status">
          <p className="text-xs text-text-soft-400">
            {formatMessage({ id: "app.commitment.loading" })}
          </p>
          <div className="space-y-3 animate-pulse" aria-hidden="true">
            <div className="h-20 rounded-[var(--radius-lg)] bg-bg-weak-50" />
            <div className="h-32 rounded-[var(--radius-lg)] bg-bg-weak-50" />
          </div>
        </div>
      </DetailShell>
    );
  }

  if (isError || !detail) {
    return (
      <DetailShell onBack={back}>
        <EmptyState
          icon={<RiWifiOffLine />}
          title={formatMessage({ id: "app.commitment.error.title" })}
          description={formatMessage({ id: "app.commitment.error.body" })}
          action={
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 py-2 text-sm font-medium text-text-strong-950 tap-target-lg"
            >
              <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.commitments.retry" })}
            </button>
          }
        />
      </DetailShell>
    );
  }

  const { commitment, contributors, requirements } = detail;
  const state = presentState(commitment.derivedState);
  const band = selectStatusBand({ commitment, seat });
  const act = selectCommitmentAct({
    commitment,
    seat,
    hasPendingJob: pendingCommitmentIds.has(commitment.commitmentId.toString()),
  });
  const joinable = canJoinTeam({ commitment, seat });

  const units = commitment.unitLabel
    ? formatMessage(
        { id: "app.commitments.row.units" },
        { count: commitment.targetUnits.toString(), unit: commitment.unitLabel }
      )
    : null;
  // The member's own name for it leads; the units stay, because they are what
  // the commitment is measured and settled against.
  const heading = metadata?.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });

  return (
    <>
      <DetailShell
        onBack={back}
        title={heading}
        bar={
          act ? (
            <CommitmentActionBar
              act={act}
              isPending={jobs.isPending || onlineMutation.isPending}
              isOnline={isOnline}
              onRun={() => {
                switch (act.kind) {
                  case "withdraw":
                    setWithdrawOpen(true);
                    return;
                  case "takeUp":
                  case "askToTakeUp":
                    // A member claims as themselves (ClaimType.Individual = 1);
                    // ClaimType.Garden is a GardenAccount claiming on a protocol
                    // pool, which is a steward path and not this button. The
                    // context is the garden the claim is scoped to, never a person.
                    void jobs.enqueue({
                      act: "claim",
                      payload: {
                        commitmentId: commitment.commitmentId,
                        kind: CLAIM_TYPE_INDIVIDUAL,
                        gardenContext: gardenAddress as Address,
                      },
                    });
                    return;
                  case "sendForConfirmation":
                    void jobs.enqueue({
                      act: "sendForConfirmation",
                      commitmentId: commitment.commitmentId,
                    });
                    return;
                  case "confirm":
                    void jobs.enqueue({
                      act: "confirm",
                      commitmentId: commitment.commitmentId,
                    });
                    return;
                  case "addProof":
                  case "offerAgain":
                    navigate("../..", { relative: "path" });
                }
              }}
            />
          ) : null
        }
      >
        {band ? (
          <section
            className={`rounded-[var(--radius-lg)] border p-4 ${BAND_TONE_CLASS[band.tone]}`}
            data-component="CommitmentStatusBand"
            data-tone={band.tone}
          >
            <h2 className="text-sm font-medium text-text-strong-950">
              {formatMessage({ id: band.titleId })}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-text-sub-600">
              {formatMessage({ id: band.bodyId })}
            </p>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-text-strong-950" title={heading}>
                {heading}
              </p>
              {metadata?.title && units ? (
                <p className="mt-0.5 text-sm text-text-sub-600">{units}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-text-soft-400">
                {formatMessage({
                  id:
                    commitment.direction === "REQUEST"
                      ? "app.commitments.direction.request"
                      : "app.commitments.direction.offer",
                })}
              </p>
            </div>
            <StatusBadge size="sm" variant={state.tone}>
              {formatMessage({ id: state.labelId })}
            </StatusBadge>
          </div>

          {metadata?.description ? (
            <p className="mt-3 text-sm leading-relaxed text-text-sub-600">{metadata.description}</p>
          ) : null}

          <CommitmentPeople commitment={commitment} contributors={contributors} seat={seat} />

          {joinable ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-text-sub-600">
              <RiGroupLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              {formatMessage({ id: "app.commitment.team.openInvite" })}
            </p>
          ) : null}
        </section>

        <CommitmentProgress commitment={commitment} requirements={requirements} />
      </DetailShell>

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        direction={commitment.direction === "REQUEST" ? "REQUEST" : "OFFER"}
        isPending={onlineMutation.isPending}
        onConfirm={(reasonCID) => {
          onlineMutation.mutate(
            {
              action: "cancelCommitment",
              commitmentId: commitment.commitmentId,
              reasonCID,
            },
            { onSuccess: () => setWithdrawOpen(false) }
          );
        }}
      />
    </>
  );
}

function DetailShell({
  children,
  onBack,
  title,
  bar,
}: {
  children: React.ReactNode;
  onBack: () => void;
  title?: string;
  bar?: React.ReactNode;
}) {
  // TopNav owns the back affordance only; it takes no title of its own, so the
  // commitment names itself in its own heading rather than in a tooltip.
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 pb-24">
          {title ? (
            <h1 className="truncate text-lg font-medium text-text-strong-950" title={title}>
              {title}
            </h1>
          ) : null}
          {children}
        </div>
      </div>
      {bar}
    </div>
  );
}

export default GardenCommitment;
