import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type CommitmentReadModel,
  type CommitmentRequirementRecord,
  isTerminalCommitmentState,
} from "@green-goods/shared/commitment-pooling";
import { useMemo } from "react";
import { useIntl } from "react-intl";

export interface CommitmentProgressProps {
  chainId: number;
  commitment: CommitmentReadModel;
  requirements: CommitmentRequirementRecord[];
}

/**
 * What has actually been done toward this commitment.
 *
 * Each requirement keeps its own row and its own units. Rows are never summed
 * into one figure: two rows counting different things have no common total, and
 * inventing one would report progress the garden never agreed to.
 *
 * Display is capped at what was required while the audited count stays intact,
 * so an over-delivered row reads as complete rather than as more than complete.
 */
export function CommitmentProgress({ chainId, commitment, requirements }: CommitmentProgressProps) {
  const { formatMessage } = useIntl();
  // Each row is a garden action, so it is named by the action registry rather
  // than by its position. Position stays as the fallback for an action the
  // registry cannot name, which is still a row somebody has to fulfil.
  const { data: actions = [] } = useActions(chainId);
  const titleByActionId = useMemo(
    () => new Map(actions.map((action) => [action.id, action.title])),
    [actions]
  );
  const rowLabel = (requirement: CommitmentRequirementRecord) =>
    titleByActionId.get(`${chainId}-${requirement.actionUID.toString()}`) ??
    formatMessage(
      { id: "app.commitment.progress.row" },
      { index: requirement.requirementIndex + 1 }
    );

  if (requirements.length === 0) {
    // A service commitment names no garden actions, so proof is what moves it —
    // but a settled record has stopped moving, so its copy just counts.
    const settled = isTerminalCommitmentState(commitment.derivedState);
    return (
      <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
        <h3 className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.commitment.progress.title" })}
        </h3>
        <p className="mt-1 text-sm text-text-sub-600">
          {formatMessage(
            {
              id: settled
                ? "app.commitment.progress.proofOnlySettled"
                : "app.commitment.progress.proofOnly",
            },
            { count: commitment.evidenceCount }
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
      <h3 className="text-sm font-medium text-text-strong-950">
        {formatMessage({ id: "app.commitment.progress.title" })}
      </h3>
      <ul className="mt-3 space-y-3">
        {requirements.map((requirement) => {
          const done = Math.min(requirement.approvedCount, requirement.requiredCount);
          const pct =
            requirement.requiredCount > 0
              ? Math.round((done / requirement.requiredCount) * 100)
              : 0;
          const label = rowLabel(requirement);
          return (
            <li key={requirement.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-text-sub-600" title={label}>
                  {label}
                </span>
                <span className="shrink-0 text-text-strong-950">
                  {formatMessage(
                    { id: "app.commitment.progress.count" },
                    { done, of: requirement.requiredCount }
                  )}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-weak-50"
                role="progressbar"
                aria-label={label}
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={requirement.requiredCount}
              >
                <div
                  className="h-full rounded-full bg-primary-action"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-text-soft-400">
        {formatMessage({ id: "app.commitment.progress.note" })}
      </p>
    </section>
  );
}
