import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  useCommitment,
  useCommitmentCycleLabel,
  type WorkLinkIntent,
} from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useIntl } from "react-intl";

import { presentState } from "@/components/Features/Commitments";
import { AppSheet } from "@/components/Sheets/AppSheet";

export interface WorkForSheetProps {
  open: boolean;
  onClose: () => void;
  intent: WorkLinkIntent;
  /** Takes the promise off this work; the step stays as it was. */
  onUnlink: () => void;
}

/**
 * The promise this work is for, from Submit Work's pinned card (D16): where
 * the promise stands and what the work counts toward, without leaving the
 * step. Not for This Promise replaces the Fulfills box Review used to carry.
 */
export function WorkForSheet({ open, onClose, intent, onUnlink }: WorkForSheetProps) {
  const { formatMessage } = useIntl();
  const chainId = DEFAULT_CHAIN_ID;
  const { commitment } = useCommitment({ chainId, commitmentId: intent.commitmentId });
  const cycle = useCommitmentCycleLabel({ chainId, cycleId: commitment?.cycleId });
  const state = commitment ? presentState(commitment.derivedState) : null;
  // A garden's request is the promise garden work keeps; the sheet says so beside its season.
  const description = [
    cycle?.name,
    commitment?.direction === "REQUEST"
      ? formatMessage({ id: "app.garden.workFor.asked" })
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppSheet
      isOpen={open}
      onClose={onClose}
      size="half"
      header={{ title: intent.commitmentTitle, description: description || undefined }}
      bodyLabel={formatMessage({ id: "app.garden.workFor.bodyLabel" })}
      actions={{
        secondary: {
          label: formatMessage({ id: "app.garden.workFor.unlink" }),
          onClick: onUnlink,
          testId: "work-for-unlink",
        },
      }}
    >
      <div className="space-y-4" data-component="WorkForSheet">
        {/* The work in hand is what keeps it, so it reads as the promise page's in-progress band. */}
        <section className="rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter p-4">
          {state ? (
            <StatusBadge size="sm" variant={state.tone} showIcon={false}>
              {formatMessage({ id: state.labelId })}
            </StatusBadge>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-text-strong-950">
            {formatMessage({ id: "app.garden.workFor.body" })}
          </p>
        </section>
        <dl className="divide-y divide-stroke-soft-200 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 text-sm">
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-text-sub-600">
              {formatMessage({ id: "app.garden.workFor.needs" })}
            </dt>
            <dd className="text-right text-text-strong-950">{intent.requirementLabel}</dd>
          </div>
        </dl>
      </div>
    </AppSheet>
  );
}
