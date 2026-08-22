import {
  type Address,
  type PublicGardenPoolData,
  selectPublicPromiseKeptRate,
  usePublicGardenPool,
} from "@green-goods/shared";
import { type IntlShape, useIntl } from "react-intl";
import { EditorialKicker } from "@/components/Public/atoms";
import { ListSkeleton, SectionEmpty, SectionNotice, StatCell } from "./GardenDetailAtoms";
import { FinishedCycles, OpenCycle, UnitRows } from "./GardenDetailCommitmentCycles";
import { Section } from "./GardenDetailSections";

/**
 * `§ 02 Commitments` on the public Garden page (uiux-spec §7.1).
 *
 * The section is the Garden's record across seasons and campaigns, not one
 * live cycle: lifetime commitments made and kept, the one sanctioned
 * percentage when `selectPublicPromiseKeptRate` publishes it, the open Season
 * and every open Campaign as their own rows, exact-label unit rows, and the
 * finished cycles newest first. It always renders — a Garden with no pool
 * gets readiness copy, which keeps the ordinals stable between Gardens.
 *
 * What it never shows: pause reasons, metadata CIDs, provider rows, wallet
 * addresses, cancelled or disputed counts, cancelled cycles, rankings, or any
 * person-level reliability language. The reader it consumes selects none of
 * those, and a failed read renders em dashes, never zeros.
 */
export function CommitmentsSection({
  gardenAddress,
  chainId,
  gardenLoading,
}: {
  gardenAddress: Address | undefined;
  chainId: number;
  /** The page is still resolving the Garden; the section waits with it. */
  gardenLoading: boolean;
}) {
  const { formatMessage } = useIntl();
  const pool = usePublicGardenPool(gardenAddress, { chainId });
  const data = pool.data;
  const loading = gardenLoading || (gardenAddress !== undefined && pool.isPending === true);
  const unavailable = data?.unavailableSources.commitmentPool === true || (!loading && !data);
  const preparing =
    !loading && !unavailable && data !== undefined && !isRecordState(data.pool?.state ?? null);

  return (
    <Section
      id="public-garden-detail-commitments"
      kicker={formatMessage({
        id: "public.pool.garden.kicker",
        defaultMessage: "§ 02: Commitments",
      })}
      heading={
        preparing
          ? formatMessage({
              id: "public.pool.garden.heading.preparing",
              defaultMessage: "This Garden is preparing its pool",
            })
          : formatMessage({
              id: "public.pool.garden.heading",
              defaultMessage: "Commitments between neighbours",
            })
      }
      helper={loading || unavailable ? undefined : stateSentence(formatMessage, data)}
    >
      {loading ? (
        <ListSkeleton />
      ) : unavailable || !data ? (
        <UnavailableRecord onRetry={() => void pool.refetch()} />
      ) : preparing ? null : (
        <PoolRecord data={data} />
      )}
    </Section>
  );
}

type RecordState = "OPEN" | "PAUSED" | "CLOSED" | "COMPOSTED";

function isRecordState(state: string | null): state is RecordState {
  return state === "OPEN" || state === "PAUSED" || state === "CLOSED" || state === "COMPOSTED";
}

/** One sentence per §4.1 Editorial column, never the indexed pause reason. */
function stateSentence(
  formatMessage: IntlShape["formatMessage"],
  data: PublicGardenPoolData | undefined
): string {
  const state = data?.pool?.state ?? null;
  if (!data?.pool || state === null || state === "UNKNOWN" || state === "NOT_READY") {
    return formatMessage({
      id: "public.pool.garden.state.notReady",
      defaultMessage:
        "Offers and requests between neighbours open once this Garden's pool is ready.",
    });
  }
  switch (state) {
    case "READY":
      return formatMessage({
        id: "public.pool.garden.state.ready",
        defaultMessage:
          "The charter and baseline are in place. Offers and requests open when the first season is seeded.",
      });
    case "PAUSED":
      return formatMessage({
        id: "public.pool.garden.state.paused",
        defaultMessage:
          "This Garden has paused new commitments for now. Its record stays readable.",
      });
    case "CLOSED":
      return formatMessage({
        id: "public.pool.garden.state.closed",
        defaultMessage: "This Garden's pool has closed. What it kept stays on the record.",
      });
    case "COMPOSTED":
      return formatMessage({
        id: "public.pool.garden.state.composted",
        defaultMessage:
          "This Garden's pool has been composted, ready for the next season. Its record stays here.",
      });
    default:
      // OPEN. Between seasons, the record framing carries the sentence.
      return data.openSeason === null &&
        data.openCampaigns.length === 0 &&
        data.finishedCycles.length > 0
        ? formatMessage({
            id: "public.pool.garden.state.betweenSeasons",
            defaultMessage:
              "The next season has not opened yet. What the Garden has kept so far stays here.",
          })
        : formatMessage({
            id: "public.pool.garden.state.open",
            defaultMessage:
              "Neighbours can offer and take up commitments in this Garden right now.",
          });
  }
}

function UnavailableRecord({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <>
      <RecordStrip made={undefined} kept={undefined} unavailable />
      <SectionNotice
        message={formatMessage({
          id: "public.pool.garden.unavailable",
          defaultMessage: "This Garden's commitments could not be loaded just now.",
        })}
        onRetry={onRetry}
      />
    </>
  );
}

/**
 * Lifetime made and kept, plus the kept rate only when the public selector
 * publishes it. "Made" is accepted commitments; the rate is fulfilled over
 * due, never fulfilled over made.
 */
function RecordStrip({
  made,
  kept,
  rate,
  unavailable = false,
}: {
  made: number | undefined;
  kept: number | undefined;
  rate?: string;
  unavailable?: boolean;
}) {
  const { formatMessage } = useIntl();
  return (
    <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
      <StatCell
        label={formatMessage({
          id: "public.pool.garden.record.made",
          defaultMessage: "Commitments made",
        })}
        value={made}
        loading={false}
        unavailable={unavailable}
      />
      <StatCell
        label={formatMessage({ id: "public.pool.garden.record.kept", defaultMessage: "Kept" })}
        value={kept}
        loading={false}
        unavailable={unavailable}
      />
      {rate !== undefined ? (
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({
              id: "public.pool.garden.record.keptRate",
              defaultMessage: "Kept rate",
            })}
          </dt>
          <dd className="mt-1 font-serif text-2xl text-text-strong-950">{rate}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function PoolRecord({ data }: { data: PublicGardenPoolData }) {
  const { formatMessage, formatNumber } = useIntl();
  const { pool, openSeason, openCampaigns, poolUnitSummaries, cycleUnitSummaries } = data;
  if (!pool) return null;
  // The reader already excludes cancelled cycles; the render guards it too,
  // because §4.2 says a cancelled cycle never appears on a public page.
  const finishedCycles = data.finishedCycles.filter((cycle) => cycle.state !== "CANCELLED");
  // Nothing has been made yet: the record strip gives way to a scope-named
  // empty sentence, while an open cycle still names itself below it.
  const nothingYet = pool.commitmentsAccepted === 0n && finishedCycles.length === 0;

  const selection = selectPublicPromiseKeptRate({
    commitmentsFulfilled: pool.commitmentsFulfilled,
    commitmentsDue: pool.commitmentsDue,
    distinctProviderCount: pool.distinctProviderCount,
  });
  const rate =
    selection.kind === "rate"
      ? formatNumber(Number(selection.rate.fulfilled) / Number(selection.rate.due), {
          style: "percent",
          maximumFractionDigits: 0,
        })
      : undefined;
  const openCycles = [...(openSeason ? [openSeason] : []), ...openCampaigns];

  return (
    <>
      {nothingYet ? (
        <SectionEmpty
          message={formatMessage({
            id: "public.pool.garden.empty",
            defaultMessage:
              "No commitments have been made yet. They appear here as neighbours offer and take them up.",
          })}
        />
      ) : (
        <>
          <RecordStrip
            made={Number(pool.commitmentsAccepted)}
            kept={Number(pool.commitmentsFulfilled)}
            rate={rate}
          />
          <p className="mt-3 max-w-2xl text-sm text-text-sub-600">
            {selection.kind === "rate"
              ? formatMessage({
                  id: "public.pool.garden.record.keptRateNote",
                  defaultMessage:
                    "The kept rate counts commitments that came due, not those still in progress.",
                })
              : formatMessage({
                  id: "public.pool.garden.record.countsOnlyNote",
                  defaultMessage:
                    "Counts only for now. A kept rate is published once the record is large enough to describe fairly.",
                })}
          </p>
        </>
      )}

      {openCycles.length > 0 ? (
        <ul className="mt-10 flex flex-col gap-8">
          {openCycles.map((cycle) => (
            <OpenCycle
              key={cycle.id}
              cycle={cycle}
              units={cycleUnitSummaries.filter((unit) => unit.cycleId === cycle.cycleId)}
            />
          ))}
        </ul>
      ) : null}

      {poolUnitSummaries.length > 0 ? (
        <div className="mt-10">
          <EditorialKicker>
            {formatMessage({
              id: "public.pool.garden.units.pool",
              defaultMessage: "Across the whole pool",
            })}
          </EditorialKicker>
          <UnitRows units={poolUnitSummaries} />
        </div>
      ) : null}

      {finishedCycles.length > 0 ? <FinishedCycles cycles={finishedCycles} /> : null}

      {pool.commitmentsFulfilled > 0n ? (
        <p className="mt-10 max-w-2xl font-serif text-base italic text-text-sub-600 md:text-lg">
          <a
            href="#public-garden-detail-certificates"
            className="border-b border-primary-action/35 pb-0.5 transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
          >
            {formatMessage({
              id: "public.pool.garden.certificatesTieIn",
              defaultMessage:
                "Fulfilled commitments from these seasons are anchored in the certificates below.",
            })}
          </a>
        </p>
      ) : null}

      {data.unavailableSources.cycleMetadata ? (
        <p role="status" className="mt-6 text-sm text-text-sub-600">
          {formatMessage({
            id: "public.pool.garden.partial",
            defaultMessage: "Some season names could not be loaded right now.",
          })}
        </p>
      ) : null}
    </>
  );
}
