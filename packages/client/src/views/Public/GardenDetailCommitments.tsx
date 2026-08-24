import type { Address } from "@green-goods/shared/types/domain";
import {
  PUBLIC_HISTORY_PAGE_SIZE,
  type PublicGardenPoolData,
  selectPublicPromiseKeptRate,
  usePublicGardenPool,
} from "@green-goods/shared/commitment-pooling";
import { useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { EditorialPanel } from "@/components/Public/atoms";
import { formatKeptRate } from "@/components/Public/keptRate";
import {
  ListSkeleton,
  PanelLead,
  PanelNote,
  RecordStats,
  SectionNotice,
} from "./GardenDetailAtoms";
import {
  CertificatesTieIn,
  FinishedCycles,
  OpenCycles,
  PoolUnits,
} from "./GardenDetailCommitmentCycles";
import { Section } from "./GardenDetailSections";

/**
 * `§ 02 Commitments` on the public Garden page (uiux-spec §7.1).
 *
 * The section is the Garden's record across seasons and campaigns, not one
 * live cycle. Its header sits on the canvas with the page's other sections;
 * its body is one `EditorialPanel` — the `/fund` card grammar — so the record
 * reads as a composed object at any width rather than loose text hugging the
 * left edge. Inside the panel: the pool-state sentence beside the lifetime
 * record (commitments made, kept, and the one sanctioned percentage when
 * `selectPublicPromiseKeptRate` publishes it); then the open Season and
 * Campaigns beside the pool-wide exact-label units; then the finished cycles
 * newest first; then the line that ties fulfilled commitments to § 03. A
 * Garden with no pool keeps the same panel with readiness copy, which keeps
 * the ordinals stable.
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
  // The finished-cycle window is paged at the data boundary: widening it
  // re-reads with a larger limit while the current rows stay on screen.
  const [historyLimit, setHistoryLimit] = useState(PUBLIC_HISTORY_PAGE_SIZE);
  const pool = usePublicGardenPool(gardenAddress, { chainId, historyLimit });
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
    >
      <EditorialPanel className="mt-8">
        {loading ? (
          <PanelLead lede={<ListSkeleton rows={2} className="flex flex-col gap-4" />}>
            <RecordStats loading />
          </PanelLead>
        ) : unavailable || !data ? (
          <UnavailableRecord onRetry={() => void pool.refetch()} />
        ) : preparing ? (
          <Readiness sentence={stateSentence(formatMessage, data)} />
        ) : (
          <PoolRecord
            data={data}
            loadingMore={pool.isPlaceholderData && pool.isFetching}
            onShowMore={() => setHistoryLimit((limit) => limit + PUBLIC_HISTORY_PAGE_SIZE)}
          />
        )}
      </EditorialPanel>
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
        data.finishedCycleTotal > 0
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

/** No pool, NOT_READY, or READY: readiness language, no statistics. */
function Readiness({ sentence }: { sentence: string }) {
  const { formatMessage } = useIntl();
  return (
    <PanelLead lede={sentence}>
      <PanelNote
        kicker={formatMessage({
          id: "public.pool.garden.readinessKicker",
          defaultMessage: "What this section will hold",
        })}
      >
        {formatMessage({
          id: "public.pool.garden.readinessBody",
          defaultMessage:
            "Commitments made and kept, the open season and its campaigns, and every finished season since the pool opened.",
        })}
      </PanelNote>
    </PanelLead>
  );
}

/** Unknown is not zero: em dashes under the labels, a neutral retry beside. */
function UnavailableRecord({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <PanelLead
      lede={formatMessage({
        id: "public.pool.garden.unavailable",
        defaultMessage: "This Garden's commitments could not be loaded just now.",
      })}
      aside={
        <SectionNotice
          className="text-sm text-text-sub-600"
          message={formatMessage({
            id: "public.pool.garden.unavailableHint",
            defaultMessage: "Nothing else on this page is affected.",
          })}
          onRetry={onRetry}
        />
      }
    >
      <RecordStats unavailable />
    </PanelLead>
  );
}

function PoolRecord({
  data,
  loadingMore,
  onShowMore,
}: {
  data: PublicGardenPoolData;
  loadingMore: boolean;
  onShowMore: () => void;
}) {
  const { formatMessage, formatNumber } = useIntl();
  const { pool, openSeason, openCampaigns, poolUnitSummaries, cycleUnitSummaries } = data;
  if (!pool) return null;
  // The reader already excludes cancelled cycles; the render guards it too,
  // because §4.2 says a cancelled cycle never appears on a public page.
  const finishedCycles = data.finishedCycles.filter((cycle) => cycle.state !== "CANCELLED");
  // Nothing has been made yet: a scope-named empty note stands where the
  // numerals would, while an open cycle still names itself below.
  const nothingYet = pool.commitmentsAccepted === 0n && data.finishedCycleTotal === 0;

  const selection = selectPublicPromiseKeptRate({
    commitmentsFulfilled: pool.commitmentsFulfilled,
    commitmentsDue: pool.commitmentsDue,
    distinctProviderCount: pool.distinctProviderCount,
  });
  const rate =
    selection.kind === "rate"
      ? formatKeptRate(formatNumber, selection.rate.fulfilled, selection.rate.due)
      : undefined;
  const openCycles = [...(openSeason ? [openSeason] : []), ...openCampaigns];
  const hasOpen = openCycles.length > 0;
  const hasUnits = poolUnitSummaries.length > 0;

  return (
    <>
      <PanelLead lede={stateSentence(formatMessage, data)}>
        {nothingYet ? (
          <PanelNote
            kicker={formatMessage({
              id: "public.pool.garden.emptyKicker",
              defaultMessage: "Reading the record",
            })}
          >
            {formatMessage({
              id: "public.pool.garden.empty",
              defaultMessage:
                "No commitments have been made yet. They appear here as neighbours offer and take them up.",
            })}
          </PanelNote>
        ) : (
          <>
            <RecordStats
              made={pool.commitmentsAccepted}
              kept={pool.commitmentsFulfilled}
              rate={rate}
            />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-sub-600">
              {selection.kind === "rate"
                ? formatMessage({
                    id: "public.pool.garden.record.keptRateNote",
                    defaultMessage:
                      "Kept commitments over every commitment taken up and not mutually released. Commitments still in progress count until they are kept.",
                  })
                : formatMessage({
                    id: "public.pool.garden.record.countsOnlyNote",
                    defaultMessage:
                      "Counts only for now. A kept rate is published once the record is large enough to describe fairly.",
                  })}
            </p>
          </>
        )}
      </PanelLead>

      {hasOpen || hasUnits ? (
        <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-stroke-soft-200 pt-8 lg:grid-cols-2">
          {hasOpen ? (
            <OpenCycles
              cycles={openCycles}
              units={cycleUnitSummaries}
              className={hasUnits ? undefined : "lg:col-span-2"}
            />
          ) : null}
          {hasUnits ? (
            <PoolUnits
              units={poolUnitSummaries}
              className={hasOpen ? undefined : "lg:col-span-2"}
            />
          ) : null}
        </div>
      ) : null}

      {finishedCycles.length > 0 ? (
        <FinishedCycles
          cycles={finishedCycles}
          total={data.finishedCycleTotal}
          loadingMore={loadingMore}
          onShowMore={onShowMore}
        />
      ) : null}

      {/* The tie-in claims an anchor, so it needs a certificate that actually
          bundles commitments — not merely any certificate in § 03. The reader
          answers "no" when it could not prove one. */}
      {pool.commitmentsFulfilled > 0n && data.hasCommitmentCertificates ? (
        <CertificatesTieIn />
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
