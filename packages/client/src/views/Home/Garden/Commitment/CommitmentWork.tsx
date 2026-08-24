import { type Action, StatusBadge, type Work } from "@green-goods/shared";
import {
  type CommitmentReadModel,
  type CommitmentRequirementRecord,
  type CommitmentWorkAttributionRecord,
} from "@green-goods/shared/commitment-pooling";
import { RiLinkM } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface CommitmentWorkProps {
  commitment: CommitmentReadModel;
  requirements: CommitmentRequirementRecord[];
  attributions: CommitmentWorkAttributionRecord[];
  /** Every work in this garden the app can see, online and queued. */
  works: Work[];
  /** The garden's registered actions, to name a work by what it did. */
  actions: Action[];
  chainId: number;
  /** The signed-in member, whose unlinked approved work is worth pointing at. */
  viewer: string | null;
  /** Whether this reader may link work here at all. */
  canLink: boolean;
  onOpenWork: (workUID: string) => void;
  onLink: (workUID: string, requirementIndex: number) => void;
}

const STATUS_TONE: Record<Work["status"], "success" | "warning" | "error" | "info" | "neutral"> = {
  approved: "success",
  pending: "warning",
  rejected: "error",
  syncing: "info",
  uploading: "info",
  sync_failed: "error",
  offline: "neutral",
};

/**
 * The work that fulfils a garden-work commitment.
 *
 * Two kinds of row. A linked row is the indexer's attribution: this work, at
 * this requirement row, live or since unlinked. A standing not-yet-linked row
 * is the recovery: the member has approved work in this garden matching a
 * requirement row that nothing has attributed yet, so the row names it and
 * offers the exact-row link, and missed attribution is recoverable rather than
 * silently lost. Work never requires a commitment; this section only ever
 * reads the work and offers to attach it.
 */
export function CommitmentWork({
  commitment,
  requirements,
  attributions,
  works,
  actions,
  chainId,
  viewer,
  canLink,
  onOpenWork,
  onLink,
}: CommitmentWorkProps) {
  const { formatMessage, formatDate } = useIntl();
  if (commitment.commitmentType !== "DOMAIN_IMPACT") return null;

  const workById = new Map(works.map((work) => [work.id.toLowerCase(), work]));
  const actionTitle = (actionUID: number | bigint) =>
    actions.find((action) => action.id === `${chainId}-${actionUID.toString()}`)?.title ??
    formatMessage({ id: "app.commitment.work.unknownAction" });
  const statusLabel = (status: Work["status"]) =>
    formatMessage({
      id:
        status === "approved" || status === "pending" || status === "rejected"
          ? `app.work.status.${status}`
          : "app.commitment.work.statusOther",
    });

  const linked = attributions.filter((entry) => entry.linked);
  const linkedUIDs = new Set(linked.map((entry) => entry.workUID.toLowerCase()));
  const rowByAction = new Map(
    requirements.map((requirement) => [requirement.actionUID.toString(), requirement])
  );
  // Approved work of the reader's own, in this garden, matching a row, not
  // attributed: the thing most likely to stall a kept commitment.
  const notYetLinked = viewer
    ? works.filter(
        (work) =>
          work.status === "approved" &&
          work.gardenerAddress.toLowerCase() === viewer.toLowerCase() &&
          !linkedUIDs.has(work.id.toLowerCase()) &&
          rowByAction.has(String(work.actionUID))
      )
    : [];

  return (
    <section
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-component="CommitmentWork"
    >
      <h3 className="text-sm font-medium text-text-strong-950">
        {formatMessage({ id: "app.commitment.work.title" })}
      </h3>

      {linked.length === 0 && notYetLinked.length === 0 ? (
        <p className="mt-1 text-sm text-text-sub-600">
          {formatMessage({ id: "app.commitment.work.none" })}
        </p>
      ) : null}

      {linked.length > 0 ? (
        <ul
          className="mt-3 space-y-2"
          aria-label={formatMessage({ id: "app.commitment.work.linkedList" })}
        >
          {linked.map((entry) => {
            const work = workById.get(entry.workUID.toLowerCase());
            const requirement = requirements.find(
              (candidate) => candidate.requirementIndex === entry.requirementIndex
            );
            const title = requirement
              ? actionTitle(requirement.actionUID)
              : formatMessage(
                  { id: "app.commitment.progress.row" },
                  { index: entry.requirementIndex + 1 }
                );
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onOpenWork(entry.workUID)}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-left tap-feedback"
                  aria-label={formatMessage({ id: "app.commitment.work.open" }, { title })}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text-strong-950">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-sub-600">
                      {work
                        ? formatDate(new Date(work.createdAt), { month: "short", day: "numeric" })
                        : formatMessage({ id: "app.commitment.work.linked" })}
                    </span>
                  </span>
                  {work ? (
                    <StatusBadge size="sm" variant={STATUS_TONE[work.status]}>
                      {statusLabel(work.status)}
                    </StatusBadge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {notYetLinked.length > 0 ? (
        <ul
          className="mt-3 space-y-2"
          aria-label={formatMessage({ id: "app.commitment.work.notLinkedList" })}
        >
          {notYetLinked.map((work) => {
            const requirement = rowByAction.get(String(work.actionUID))!;
            return (
              <li
                key={work.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter p-3"
                data-component="CommitmentWorkNotLinked"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text-strong-950">
                    {actionTitle(work.actionUID)}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-sub-600">
                    {formatMessage(
                      { id: "app.commitment.work.notLinked" },
                      {
                        date: formatDate(new Date(work.createdAt), {
                          month: "short",
                          day: "numeric",
                        }),
                      }
                    )}
                  </span>
                </span>
                {canLink ? (
                  <button
                    type="button"
                    onClick={() => onLink(work.id, requirement.requirementIndex)}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-stroke-soft-200 bg-bg-white-0 px-3 py-1.5 text-xs font-medium text-text-strong-950 tap-target-lg"
                  >
                    <RiLinkM className="h-4 w-4" aria-hidden="true" />
                    {formatMessage({ id: "app.commitment.work.linkIt" })}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
