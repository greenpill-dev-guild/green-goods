import type { Address } from "@green-goods/shared/types/domain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  type CommitmentUnitSummaryRecord,
  PUBLIC_HISTORY_PAGE_SIZE,
  type PublicCommitmentCycleRecord,
  type PublicCommitmentPoolRecord,
  type PublicGardenPoolData,
} from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { CommitmentsSection } from "./GardenDetailCommitments";

const CHAIN_ID = 42161;
const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const DAY = 86_400n;
/** A fixed "now" so the calm dates read the same in every capture. */
const T0 = 1_787_000_000n;

// ---------------------------------------------------------------------------
// Fixtures. Every total a story prints is derived from the rows beneath it,
// so no capture can show a record that disagrees with its own cycles.
// ---------------------------------------------------------------------------

function pool(overrides: Partial<PublicCommitmentPoolRecord> = {}): PublicCommitmentPoolRecord {
  return {
    id: `${CHAIN_ID}-1`,
    chainId: CHAIN_ID,
    poolId: 1n,
    state: "OPEN",
    commitmentsOffered: 52n,
    commitmentsAccepted: 38n,
    commitmentsFulfilled: 31n,
    commitmentsCancelled: 2n,
    commitmentsExpired: 2n,
    commitmentsDisputed: 0n,
    commitmentsDue: 36n,
    openCommitmentCount: 4n,
    distinctProviderCount: 11n,
    ...overrides,
  };
}

function cycle(
  overrides: Partial<PublicCommitmentCycleRecord> & { cycleId: bigint }
): PublicCommitmentCycleRecord {
  const n = overrides.cycleId;
  return {
    id: `${CHAIN_ID}-1-${n}`,
    chainId: CHAIN_ID,
    poolId: 1n,
    cycleType: "SEASON",
    state: "RECONCILED",
    startTime: T0 - (5n - n) * 180n * DAY,
    endTime: T0 - (5n - n) * 180n * DAY + 150n * DAY,
    name: `Season ${n}`,
    nameUnavailable: false,
    commitmentsAccepted: 10n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 8n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 9n,
    openCommitmentCount: 0n,
    ...overrides,
  };
}

function unit(
  overrides: Pick<
    CommitmentUnitSummaryRecord,
    "id" | "scope" | "cycleId" | "unitLabel" | "expectedUnits" | "fulfilledUnits"
  >
): CommitmentUnitSummaryRecord {
  return {
    chainId: CHAIN_ID,
    scopeId: overrides.cycleId ?? 1n,
    poolId: 1n,
    unitLabelHash: `0x${overrides.unitLabel.length.toString(16).padStart(64, "0")}`,
    approvedUnits: overrides.fulfilledUnits,
    openUnits: overrides.expectedUnits - overrides.fulfilledUnits,
    updatedAt: Number(T0),
    ...overrides,
  };
}

const FINISHED: PublicCommitmentCycleRecord[] = [
  cycle({
    cycleId: 3n,
    name: "Summer Mutirão",
    cycleType: "CAMPAIGN",
    commitmentsAccepted: 6n,
    commitmentsFulfilled: 5n,
    commitmentsDue: 6n,
    startTime: T0 - 120n * DAY,
    endTime: T0 - 60n * DAY,
  }),
  cycle({
    cycleId: 2n,
    name: "Season of Repair",
    commitmentsAccepted: 12n,
    commitmentsFulfilled: 10n,
    commitmentsDue: 11n,
    state: "COMPOSTED",
  }),
  cycle({
    cycleId: 1n,
    name: "Season of Planting",
    commitmentsAccepted: 11n,
    commitmentsFulfilled: 9n,
    commitmentsDue: 10n,
    state: "COMPOSTED",
  }),
];

const OPEN_SEASON = cycle({
  cycleId: 4n,
  name: "Season of First Rains",
  state: "OPEN",
  commitmentsAccepted: 9n,
  commitmentsFulfilled: 7n,
  commitmentsDue: 8n,
  startTime: T0 - 40n * DAY,
  endTime: T0 + 110n * DAY,
});

const OPEN_CAMPAIGN = cycle({
  cycleId: 5n,
  name: "Mutirão de Agosto",
  cycleType: "CAMPAIGN",
  state: "OPEN",
  commitmentsAccepted: 4n,
  commitmentsFulfilled: 1n,
  commitmentsDue: 2n,
  startTime: T0 - 5n * DAY,
  endTime: T0 + 25n * DAY,
});

const CYCLE_UNITS = [
  unit({
    id: "c4-hours",
    scope: "CYCLE",
    cycleId: 4n,
    unitLabel: "hours",
    expectedUnits: 52n,
    fulfilledUnits: 25n,
  }),
  unit({
    id: "c4-rides",
    scope: "CYCLE",
    cycleId: 4n,
    unitLabel: "rides",
    expectedUnits: 16n,
    fulfilledUnits: 9n,
  }),
  unit({
    id: "c5-seedling-trays",
    scope: "CYCLE",
    cycleId: 5n,
    unitLabel: "seedling trays",
    expectedUnits: 18n,
    fulfilledUnits: 4n,
  }),
];

const POOL_UNITS = [
  unit({
    id: "p-hours",
    scope: "POOL",
    cycleId: null,
    unitLabel: "hours",
    expectedUnits: 210n,
    fulfilledUnits: 168n,
  }),
  unit({
    id: "p-rides",
    scope: "POOL",
    cycleId: null,
    unitLabel: "rides",
    expectedUnits: 64n,
    fulfilledUnits: 52n,
  }),
  unit({
    id: "p-seedling-trays",
    scope: "POOL",
    cycleId: null,
    unitLabel: "seedling trays",
    expectedUnits: 18n,
    fulfilledUnits: 4n,
  }),
  unit({
    id: "p-tool-loans",
    scope: "POOL",
    cycleId: null,
    unitLabel: "tool loans",
    expectedUnits: 12n,
    fulfilledUnits: 12n,
  }),
];

function data(overrides: Partial<PublicGardenPoolData> = {}): PublicGardenPoolData {
  const finishedCycles = overrides.finishedCycles ?? [];
  return {
    pool: pool(),
    openSeason: null,
    openCampaigns: [],
    finishedCycles,
    poolUnitSummaries: [],
    cycleUnitSummaries: [],
    finishedCycleTotal: finishedCycles.length,
    hasCommitmentCertificates: true,
    partialData: false,
    unavailableSources: { commitmentPool: false, cycleMetadata: false },
    ...overrides,
  };
}

/** The key carries the history window the section asks for on first render. */
function seeded(record: PublicGardenPoolData) {
  return withSeededQueryClient([
    [
      queryKeys.public.gardenDetail(
        `commitment-pool:${GARDEN.toLowerCase()}:${PUBLIC_HISTORY_PAGE_SIZE}`,
        CHAIN_ID
      ),
      record,
    ],
  ]);
}

const meta: Meta<typeof CommitmentsSection> = {
  title: "Client/Public/GardenDetail/CommitmentsSection",
  component: CommitmentsSection,
  args: { gardenAddress: GARDEN, chainId: CHAIN_ID, gardenLoading: false },
  decorators: [
    (Story) => (
      <div className="bg-bg-weak-50 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "`/gardens/:id` § 02 — the Garden's commitment record across seasons and campaigns, " +
          "as one editorial panel under a canvas header. The pool-state sentence sits beside " +
          "lifetime made and kept (the kept rate only above the public threshold); the open " +
          "Season and every open Campaign sit beside the pool-wide exact-label unit rows; " +
          "finished cycles follow newest first, then the line that ties fulfilled commitments " +
          "to the certificates. Readiness copy before launch keeps the same panel. A failed " +
          "read renders em dashes with a section-scoped retry; cancelled cycles, pause reasons, " +
          "provider rows, and addresses never appear.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentsSection>;

/** The full record: open Season and Campaign, unit rows, history, kept rate. */
export const Record: Story = {
  decorators: [
    seeded(
      data({
        openSeason: OPEN_SEASON,
        openCampaigns: [OPEN_CAMPAIGN],
        finishedCycles: FINISHED,
        cycleUnitSummaries: CYCLE_UNITS,
        poolUnitSummaries: POOL_UNITS,
      })
    ),
  ],
};

/** A young pool: plenty of commitments between too few people for a percentage. */
export const CountsOnly: Story = {
  decorators: [
    seeded(
      data({
        pool: pool({
          commitmentsAccepted: 9n,
          commitmentsFulfilled: 7n,
          commitmentsDue: 8n,
          distinctProviderCount: 2n,
        }),
        openSeason: OPEN_SEASON,
        cycleUnitSummaries: CYCLE_UNITS.slice(0, 2),
      })
    ),
  ],
};

/** No live cycle, and the section still has something true to say. */
export const BetweenSeasons: Story = {
  decorators: [
    seeded(
      data({
        pool: pool({ commitmentsAccepted: 43n, commitmentsFulfilled: 35n, commitmentsDue: 40n }),
        finishedCycles: [
          cycle({
            cycleId: 4n,
            name: "Season of First Rains",
            commitmentsAccepted: 14n,
            commitmentsFulfilled: 11n,
            commitmentsDue: 13n,
            startTime: T0 - 190n * DAY,
            endTime: T0 - 20n * DAY,
          }),
          ...FINISHED,
        ],
        poolUnitSummaries: POOL_UNITS,
      })
    ),
  ],
};

/** Quiet period: neutral line, aggregates stay, no pause reason. */
export const Paused: Story = {
  decorators: [seeded(data({ pool: pool({ state: "PAUSED" }), finishedCycles: FINISHED }))],
};

/** A closed pool keeps its history on the record. */
export const Closed: Story = {
  decorators: [seeded(data({ pool: pool({ state: "CLOSED" }), finishedCycles: FINISHED }))],
};

/** Composted: ready for the next season, record intact. */
export const Composted: Story = {
  decorators: [seeded(data({ pool: pool({ state: "COMPOSTED" }), finishedCycles: FINISHED }))],
};

/** No pool registered yet (also the NOT_READY treatment). */
export const PreLaunch: Story = {
  decorators: [seeded(data({ pool: null }))],
};

/** Charter and baseline in place, first season not seeded. */
export const Ready: Story = {
  decorators: [
    seeded(
      data({
        pool: pool({
          state: "READY",
          commitmentsOffered: 0n,
          commitmentsAccepted: 0n,
          commitmentsFulfilled: 0n,
          commitmentsDue: 0n,
          distinctProviderCount: 0n,
        }),
      })
    ),
  ],
};

/** An open pool with no cycle and nothing made: the empty note stands where the numbers would. */
export const EmptyPool: Story = {
  decorators: [
    seeded(
      data({
        pool: pool({
          commitmentsOffered: 0n,
          commitmentsAccepted: 0n,
          commitmentsFulfilled: 0n,
          commitmentsCancelled: 0n,
          commitmentsExpired: 0n,
          commitmentsDue: 0n,
          openCommitmentCount: 0n,
          distinctProviderCount: 0n,
        }),
      })
    ),
  ],
};

/** An open Season with nothing in it yet says so, and still names itself. */
export const EmptyOpenSeason: Story = {
  decorators: [
    seeded(
      data({
        pool: pool({
          commitmentsOffered: 0n,
          commitmentsAccepted: 0n,
          commitmentsFulfilled: 0n,
          commitmentsDue: 0n,
          distinctProviderCount: 0n,
        }),
        openSeason: cycle({
          cycleId: 4n,
          name: "Season of First Rains",
          state: "OPEN",
          commitmentsAccepted: 0n,
          commitmentsFulfilled: 0n,
          commitmentsDue: 0n,
          startTime: T0 - 2n * DAY,
          endTime: T0 + 148n * DAY,
        }),
      })
    ),
  ],
};

/** Unknown is not zero: em dashes and a retry that re-reads only this section. */
export const ReadError: Story = {
  decorators: [
    seeded(
      data({
        pool: null,
        partialData: true,
        unavailableSources: { commitmentPool: true, cycleMetadata: false },
      })
    ),
  ],
};

/** A cycle whose metadata could not be resolved keeps its row. */
export const MissingCycleName: Story = {
  decorators: [
    seeded(
      data({
        finishedCycles: [
          cycle({ cycleId: 2n, name: null, nameUnavailable: true }),
          FINISHED[2] as PublicCommitmentCycleRecord,
        ],
        partialData: true,
        unavailableSources: { commitmentPool: false, cycleMetadata: true },
      })
    ),
  ],
};

/** The page is still resolving the Garden; the section waits with it. */
export const Loading: Story = {
  args: { gardenAddress: undefined, gardenLoading: true },
  decorators: [seeded(data())],
};
