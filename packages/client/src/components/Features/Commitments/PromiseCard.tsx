import type { CommitmentRowDirection } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import type {
  ItemRowDetail,
  ItemRowTone,
} from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiArrowRightSLine, RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

/** How many needs a card names before it folds the rest into +N (decision 29). */
const NEEDS_SHOWN = 2;

export interface PromiseCardProps {
  title: string;
  /** Offer or request; a record not read yet leads as an offer, unnamed. */
  direction: CommitmentRowDirection | null | undefined;
  /** Where the promise stands, in the app's words. */
  status: { label: string; tone: ItemRowTone };
  /** Approvals so far of all its requirements ask for; null for a promise that counts none. */
  progress: { approved: number; required: number } | null;
  /** What it promises, for a promise that counts no approvals ("6 hours"). */
  units?: string | null;
  due: ItemRowDetail | null;
  /** What it needs: its actions, then Evidence. Two show and the rest fold into +N. */
  needs: readonly string[];
  onOpen: () => void;
}

/**
 * One promise on the Start step (DL-131, decisions 27 and 29): a compact card of one height,
 * 132px, led by the offer's seedling or the request's helping hand, with the title and its one
 * status pill, the progress bar with the approvals and the due date, and what it needs, two
 * needs and a +N mark for the rest. The whole card opens the promise; its own screen lists
 * every action and the evidence row.
 */
export function PromiseCard({
  title,
  direction,
  status,
  progress,
  units,
  due,
  needs,
  onOpen,
}: PromiseCardProps) {
  const { formatMessage } = useIntl();
  const isRequest = direction === "REQUEST";
  const known = direction === "OFFER" || direction === "REQUEST";
  const shown = needs.slice(0, NEEDS_SHOWN);
  const more = needs.length - shown.length;
  const when = typeof due === "string" ? { text: due } : due;
  const percent =
    progress && progress.required > 0
      ? Math.min(100, Math.round((progress.approved / progress.required) * 100))
      : 0;

  return (
    <button
      type="button"
      data-pressable="card"
      data-component="PromiseCard"
      onClick={onOpen}
      // The shared card that opens its object: its focus ring and its ink-layer hover.
      className="gg-card gg-media-card flex h-33 w-full min-w-0 shrink-0 flex-col justify-between px-4 py-3 text-left"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          {...(known
            ? {
                role: "img",
                "aria-label": formatMessage({
                  id: isRequest ? "app.commitments.row.request" : "app.commitments.row.offer",
                }),
              }
            : { "aria-hidden": true as const })}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-alpha-10 text-primary-on-surface"
        >
          {isRequest ? (
            <RiHandHeartLine className="h-5 w-5" aria-hidden="true" />
          ) : (
            <RiSeedlingLine className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate type-card-title text-text-strong-950" title={title}>
            {title}
          </span>
          <StatusBadge
            size="xs"
            variant={status.tone}
            showIcon={false}
            className="max-w-full self-start"
            title={status.label}
          >
            <span className="min-w-0 truncate">{status.label}</span>
          </StatusBadge>
        </span>
        <RiArrowRightSLine className="h-5 w-5 shrink-0 text-text-soft-400" aria-hidden="true" />
      </span>

      <span className="flex h-4 min-w-0 items-center gap-2.5 type-meta text-text-sub-600">
        {progress ? (
          <>
            <span
              aria-hidden="true"
              className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-bg-soft-200"
            >
              <span
                className="block h-full rounded-full bg-primary-action"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="shrink-0">
              {formatMessage(
                { id: "app.garden.commitment.progress" },
                {
                  done: Math.min(progress.approved, progress.required),
                  total: progress.required,
                }
              )}
            </span>
          </>
        ) : units ? (
          <span className="min-w-0 truncate" title={units}>
            {units}
          </span>
        ) : null}
        {when ? (
          <time className="ms-auto shrink-0" dateTime={when.dateTime} title={when.title}>
            {when.text}
          </time>
        ) : null}
      </span>

      <span className="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden">
        {shown.map((need) => (
          <span
            key={need}
            className="min-w-0 truncate rounded-full bg-bg-weak-50 px-2.5 py-0.5 type-meta font-medium text-text-sub-600"
            title={need}
          >
            {need}
          </span>
        ))}
        {more > 0 ? (
          <span className="shrink-0 rounded-full bg-bg-weak-50 px-2.5 py-0.5 type-meta font-medium text-text-sub-600">
            <span aria-hidden="true">+{more}</span>
            <span className="sr-only">
              {formatMessage({ id: "app.garden.start.need.more" }, { count: more })}
            </span>
          </span>
        ) : null}
      </span>
    </button>
  );
}
