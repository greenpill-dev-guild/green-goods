import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
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
 * It is a half sheet, the tier for a single preview; a cycle record says little
 * more than this (its metadata is a name), so it never needs the tall tier. A
 * campaign that runs as a project brief adds its brief note (PRD-1299, SBrief):
 * how its separate promises fit together, in its stewards' words.
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
  const metadata = byCycleId.get(cycle.cycleId.toString());
  const name = metadata?.name ?? kindLabel;
  const brief = isCampaign && metadata?.status === "resolved" ? metadata.brief : undefined;
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
        <FactList>
          {facts.map(([term, value]) => (
            <FactRow key={term} label={term} value={value} />
          ))}
        </FactList>
        {brief ? (
          <section className="space-y-1" data-component="CampaignBrief">
            <h3 className="type-title-sm text-text-strong-950">
              {formatMessage({ id: "app.pool.cycle.brief.title" })}
            </h3>
            <p className="whitespace-pre-line type-body text-text-sub-600">{brief}</p>
          </section>
        ) : null}
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.pool.cycle.separate" })}
        </p>
      </div>
    </AppSheet>
  );
}
