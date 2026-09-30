import {
  type CommitmentCycleRecord,
  useCommitmentCycleNames,
} from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";

import { AppSheet } from "@/components/Sheets/AppSheet";
import { CycleIdentity, cycleDates } from "./CycleRail";

interface CycleDetailsSheetProps {
  /** The season or campaign to describe; the last one stays drawn while the sheet closes. */
  cycle: CommitmentCycleRecord | null;
  isOpen: boolean;
  onClose: () => void;
  /** Selects the cycle's card, so the list shows only its promises. */
  onShowPromises: (cycleId: bigint) => void;
}

/**
 * A season's or campaign's details, opened from the ⓘ on its card (D5): its
 * identity, what it runs, how many of its promises are live and kept. Show Its
 * Promises selects the card and closes, so filtering stays one tap away.
 *
 * Seasons and campaigns share this one sheet; only the words and colour differ.
 * It is a half sheet, the tier for a single preview; a cycle record says no more
 * than this today (its metadata is a name), so it never needs the tall tier.
 */
export function CycleDetailsSheet({
  cycle,
  isOpen,
  onClose,
  onShowPromises,
}: CycleDetailsSheetProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { byCycleId } = useCommitmentCycleNames(cycle ? [cycle] : []);
  if (!cycle) return null;

  const isCampaign = cycle.cycleType === "CAMPAIGN";
  const kindLabel = formatMessage({
    id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season",
  });
  const name = byCycleId.get(cycle.cycleId.toString())?.name ?? kindLabel;
  const facts: [string, string][] = [
    [
      formatMessage({ id: "app.pool.cycle.liveNow" }),
      formatMessage(
        { id: "app.pool.cycle.liveCount" },
        { count: Number(cycle.liveCommitmentCount) }
      ),
    ],
    [
      formatMessage({ id: "app.pool.cycle.keptSoFar" }),
      formatMessage(
        { id: "app.pool.rail.counts" },
        { kept: Number(cycle.commitmentsFulfilled), made: Number(cycle.commitmentsDue) }
      ),
    ],
  ];

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      size="half"
      header={{
        title: name,
        description: cycleDates(intl, cycle, { withYear: true }) ?? undefined,
      }}
      actions={{
        primary: {
          label: formatMessage({ id: "app.pool.cycle.showPromises" }),
          onClick: () => onShowPromises(cycle.cycleId),
        },
      }}
    >
      <div className="space-y-4">
        <CycleIdentity cycle={cycle} />
        <p className="text-sm leading-relaxed text-text-strong-950">
          {formatMessage({
            id: isCampaign ? "app.pool.cycle.intro.campaign" : "app.pool.cycle.intro.season",
          })}
        </p>
        <dl className="divide-y divide-stroke-soft-200 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="flex justify-between gap-3 py-3">
              <dt className="text-text-sub-600">{term}</dt>
              <dd className="text-right text-text-strong-950">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.pool.cycle.separate" })}
        </p>
      </div>
    </AppSheet>
  );
}
