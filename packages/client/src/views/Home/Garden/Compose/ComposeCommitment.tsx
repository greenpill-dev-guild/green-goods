import {
  COMPOSER_BEATS,
  type ComposerBeat,
  type ComposerBlockedReason,
  selectBeatValidity,
} from "@green-goods/shared/hooks/client-ui/commitment/composerBeats";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { DialogShell } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { useCommitmentComposerController } from "@green-goods/shared/hooks/client-ui/commitment/useCommitmentComposerController";
import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ComposeDetails } from "./ComposeDetails";
import { actionUIDOf, ComposeHowMuch } from "./ComposeHowMuch";
import { ComposeReview } from "./ComposeReview";
import { ComposeShell } from "./ComposeShell";
import { ComposeWhat } from "./ComposeWhat";

type Direction = "OFFER" | "REQUEST";

const BLOCKED_REASON_IDS: Record<Exclude<ComposerBlockedReason, null>, string> = {
  title: "app.compose.blocked.title",
  unit: "app.compose.blocked.unit",
  count: "app.compose.blocked.count",
  action: "app.compose.blocked.action",
  rowCount: "app.compose.blocked.rowCount",
};

function directionFromRoute(value: string | null): Direction | null {
  if (value === "offer") return "OFFER";
  if (value === "request") return "REQUEST";
  return null;
}

/** Resolve the route door before mounting the form-backed controller. */
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
  const controller = useCommitmentComposerController({
    chainId: DEFAULT_CHAIN_ID,
    garden: gardenAddress,
    direction,
    defaultUnitLabel:
      direction === "OFFER" ? formatMessage({ id: "app.compose.unit.hours" }) : undefined,
  });
  const [beat, setBeat] = useState<ComposerBeat>("what");
  const [readToEnd, setReadToEnd] = useState(false);
  const reviewEndRef = useRef<HTMLDivElement>(null);
  const back = () => navigate("..");

  const beatIndex = COMPOSER_BEATS.indexOf(beat);
  const isReview = beat === "review";
  const validity = selectBeatValidity(beat, controller.values);
  const blockingReasonId = validity.reason ? BLOCKED_REASON_IDS[validity.reason] : null;
  const actTitle = formatMessage({
    id: direction === "REQUEST" ? "app.compose.title.request" : "app.compose.title.offer",
  });
  const placeLabelId =
    direction === "REQUEST"
      ? controller.values.kind === "GARDEN_WORK"
        ? "app.compose.place.requestWork"
        : "app.compose.place.request"
      : "app.compose.place.offer";
  const actionTitle = useCallback(
    (uid: string) =>
      controller.actions.find((action) => actionUIDOf(action.id, DEFAULT_CHAIN_ID) === uid)
        ?.title ?? `#${uid}`,
    [controller.actions]
  );
  const onReadToEnd = useCallback(() => setReadToEnd(true), []);

  if (controller.access === "barred") return <Navigate to=".." replace />;

  if (controller.placed) {
    return (
      <ComposeShell onBack={back} title={actTitle}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {/* The ending echoes the thing made and names who acts next —
              never a generic "it is on its way". */}
          <h1 className="text-lg font-medium text-text-strong-950">
            {formatMessage(
              {
                id: controller.isOnline
                  ? "app.compose.done.title"
                  : "app.compose.done.offlineTitle",
              },
              { title: controller.values.title }
            )}
          </h1>
          <p className="max-w-sm text-sm text-text-sub-600">
            {formatMessage(
              {
                id: controller.isOnline ? "app.compose.done.body" : "app.compose.done.offlineBody",
              },
              { direction }
            )}
          </p>
          <button
            type="button"
            onClick={back}
            className="mt-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.compose.done.back" })}
          </button>
        </div>
      </ComposeShell>
    );
  }

  const primaryBlocked =
    !validity.canAdvance ||
    controller.isPending ||
    (isReview && (!controller.hasPool || !controller.poolOpen || !readToEnd));

  return (
    <>
      <ComposeShell
        onBack={() =>
          beatIndex === 0 ? back() : setBeat(COMPOSER_BEATS[beatIndex - 1] as ComposerBeat)
        }
        title={actTitle}
        progress={beatIndex + 1}
        bar={
          <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {!validity.canAdvance && blockingReasonId ? (
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
              aria-describedby={
                !validity.canAdvance && blockingReasonId ? "compose-blocked" : undefined
              }
              type="button"
              disabled={primaryBlocked}
              aria-busy={controller.isPending}
              onClick={() =>
                isReview
                  ? void controller.place()
                  : setBeat(COMPOSER_BEATS[beatIndex + 1] as ComposerBeat)
              }
              className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
            >
              {formatMessage({ id: isReview ? placeLabelId : "app.compose.next" })}
            </button>
          </div>
        }
      >
        {beat === "what" ? (
          <ComposeWhat
            form={controller.form}
            openCycles={controller.openCycles}
            cycleNames={controller.cycleNames}
          />
        ) : null}
        {beat === "howMuch" ? (
          <ComposeHowMuch
            form={controller.form}
            chainId={DEFAULT_CHAIN_ID}
            actions={controller.actions}
          />
        ) : null}
        {beat === "details" ? <ComposeDetails form={controller.form} /> : null}
        {isReview ? (
          <ComposeReview
            values={controller.values}
            isOnline={controller.isOnline}
            hasPool={controller.hasPool}
            gardenName={controller.gardenName}
            openCycles={controller.openCycles}
            cycleNames={controller.cycleNames}
            actionTitle={actionTitle}
            onReadToEnd={onReadToEnd}
            endRef={reviewEndRef}
          />
        ) : null}
      </ComposeShell>

      <DialogShell
        open={controller.draftDecision === "pending"}
        onOpenChange={(open) => {
          if (!open) controller.resumeDraft();
        }}
        title={formatMessage({ id: "app.compose.draft.title" })}
        description={
          controller.savedDraft
            ? formatMessage(
                { id: "app.compose.draft.body" },
                {
                  when: formatRelativeTime(
                    Math.round((controller.savedDraft.updatedAt - Date.now()) / 60_000),
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
          {typeof controller.savedDraft?.values.title === "string" &&
          controller.savedDraft.values.title ? (
            <p className="truncate text-sm font-medium text-text-strong-950">
              {controller.savedDraft.values.title}
            </p>
          ) : null}
          <button
            type="button"
            onClick={controller.resumeDraft}
            className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.compose.draft.resume" })}
          </button>
          <button
            type="button"
            onClick={controller.startFresh}
            className="w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium text-text-sub-600 tap-target-lg"
          >
            {formatMessage({ id: "app.compose.draft.fresh" })}
          </button>
        </div>
      </DialogShell>
    </>
  );
}

export default ComposeCommitment;
