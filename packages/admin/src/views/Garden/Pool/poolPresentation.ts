import type { ConfirmQueueEligibility } from "@green-goods/shared";
import type {
  CommitmentCycleRecord,
  CommitmentReadModel,
  CycleMetadataNameResolution,
  PoolConsoleStatus,
} from "@green-goods/shared/commitment-pooling";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

export type ChipVariant = "success" | "warning" | "error" | "info" | "neutral";

/**
 * Steward-facing pool status: what is true for members, never the on-chain
 * word (hifi/screens/admin.ts W7 pool chip). "Taking commitments" is the only
 * state that needs no explanation, so every other one names its own fact.
 */
export function poolStatusChip(
  status: PoolConsoleStatus,
  hasSeason: boolean,
  formatMessage: FormatMessage
): { label: string; variant: ChipVariant } {
  switch (status) {
    case "not-ready":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.status.notReady",
          defaultMessage: "Not taking commitments yet",
        }),
        variant: "neutral",
      };
    case "ready":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.status.ready",
          defaultMessage: "Set up, no season yet",
        }),
        variant: "warning",
      };
    case "open":
      return hasSeason
        ? {
            label: formatMessage({
              id: "cockpit.garden.pool.status.open",
              defaultMessage: "Taking commitments",
            }),
            variant: "success",
          }
        : {
            label: formatMessage({
              id: "cockpit.garden.pool.status.openNoCycle",
              defaultMessage: "Open, no season running",
            }),
            variant: "warning",
          };
    case "paused":
      return {
        label: formatMessage({ id: "cockpit.garden.pool.status.paused", defaultMessage: "Paused" }),
        variant: "warning",
      };
    case "closed":
      return {
        label: formatMessage({ id: "cockpit.garden.pool.status.closed", defaultMessage: "Closed" }),
        variant: "neutral",
      };
    case "composted":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.status.composted",
          defaultMessage: "Archived",
        }),
        variant: "neutral",
      };
    default:
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.status.unknown",
          defaultMessage: "Not readable yet",
        }),
        variant: "neutral",
      };
  }
}

/** A cycle's name, or the honest fallback while the CID resolves or fails. */
export function cycleName(
  cycle: CommitmentCycleRecord,
  names: ReadonlyMap<string, CycleMetadataNameResolution>,
  formatMessage: FormatMessage
): string {
  const resolution = names.get(cycle.cycleId.toString());
  if (resolution?.status === "resolved") return resolution.name;
  const kind =
    cycle.cycleType === "CAMPAIGN"
      ? formatMessage({ id: "cockpit.garden.pool.cycle.campaign", defaultMessage: "Campaign" })
      : formatMessage({ id: "cockpit.garden.pool.cycle.season", defaultMessage: "Season" });
  return formatMessage(
    { id: "cockpit.garden.pool.cycle.unnamed", defaultMessage: "{kind} {id}" },
    { kind, id: cycle.cycleId.toString() }
  );
}

/** The cycle's standing in member words, with the chip tone that carries it. */
export function cycleStateChip(
  cycle: CommitmentCycleRecord,
  poolPaused: boolean,
  formatMessage: FormatMessage
): { label: string; variant: ChipVariant } {
  switch (cycle.state) {
    case "SEEDED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.cycle.state.seeded",
          defaultMessage: "Prepared, not open yet",
        }),
        variant: "warning",
      };
    case "OPEN":
      return poolPaused
        ? {
            label: formatMessage({
              id: "cockpit.garden.pool.cycle.state.openPaused",
              defaultMessage: "Open · participation paused",
            }),
            variant: "warning",
          }
        : {
            label: formatMessage({
              id: "cockpit.garden.pool.cycle.state.open",
              defaultMessage: "Open",
            }),
            variant: "success",
          };
    case "RECONCILED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.cycle.state.reconciled",
          defaultMessage: "Reconciled",
        }),
        variant: "info",
      };
    case "COMPOSTED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.cycle.state.composted",
          defaultMessage: "Finished",
        }),
        variant: "neutral",
      };
    case "CANCELLED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.cycle.state.cancelled",
          defaultMessage: "Cancelled",
        }),
        variant: "neutral",
      };
    default:
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.cycle.state.unknown",
          defaultMessage: "Not readable yet",
        }),
        variant: "neutral",
      };
  }
}

/** A commitment's lifecycle, in the words members see on their own screen. */
export function commitmentStateChip(
  commitment: Pick<CommitmentReadModel, "onchainState" | "derivedState">,
  formatMessage: FormatMessage
): { label: string; variant: ChipVariant } {
  switch (commitment.onchainState) {
    case "OFFERED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.offered",
          defaultMessage: "Offered",
        }),
        variant: "info",
      };
    case "REQUESTED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.requested",
          defaultMessage: "Requested",
        }),
        variant: "info",
      };
    case "ACCEPTED":
      return commitment.derivedState === "EVIDENCE_SUBMITTED" ||
        commitment.derivedState === "PARTIALLY_APPROVED"
        ? {
            label: formatMessage({
              id: "cockpit.garden.pool.row.state.proofIn",
              defaultMessage: "Proof in",
            }),
            variant: "warning",
          }
        : {
            label: formatMessage({
              id: "cockpit.garden.pool.row.state.accepted",
              defaultMessage: "Accepted",
            }),
            variant: "info",
          };
    case "READY_FOR_CONFIRMATION":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.ready",
          defaultMessage: "Waiting to be confirmed",
        }),
        variant: "warning",
      };
    case "FULFILLED":
      return {
        label: formatMessage({ id: "cockpit.garden.pool.row.state.kept", defaultMessage: "Kept" }),
        variant: "success",
      };
    case "CANCELLED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.cancelled",
          defaultMessage: "Cancelled",
        }),
        variant: "neutral",
      };
    case "EXPIRED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.expired",
          defaultMessage: "Expired",
        }),
        variant: "neutral",
      };
    case "DISPUTED":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.disputed",
          defaultMessage: "In dispute",
        }),
        variant: "error",
      };
    default:
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.row.state.unknown",
          defaultMessage: "Not readable yet",
        }),
        variant: "neutral",
      };
  }
}

/** Offer or Request, the row's first chip. */
export function directionLabel(
  direction: CommitmentReadModel["direction"],
  formatMessage: FormatMessage
): string {
  return direction === "REQUEST"
    ? formatMessage({ id: "cockpit.garden.pool.row.request", defaultMessage: "Request" })
    : formatMessage({ id: "cockpit.garden.pool.row.offer", defaultMessage: "Offer" });
}

export function shortAddress(address: string | null | undefined): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Unix seconds → the locale's short date, or the fallback when absent. */
export function formatUnixDate(
  value: bigint | number | null | undefined,
  locale: string,
  fallback = ""
): string {
  if (value === null || value === undefined) return fallback;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
    new Date(seconds * 1000)
  );
}

/**
 * The Confirm queue's eligibility chip: ordinary, this garden's fallback, or
 * the Green Goods team's. Kept beside the other pool chips so the queue and
 * the commitment dialog read the same words.
 */
export function confirmEligibilityChip(
  eligibility: ConfirmQueueEligibility,
  formatMessage: FormatMessage
): { variant: "success" | "warning"; label: string } {
  if (eligibility === "ORDINARY") {
    return {
      variant: "success",
      label: formatMessage({
        id: "cockpit.hub.confirm.eligibility.ordinary",
        defaultMessage: "ordinary",
      }),
    };
  }
  if (eligibility === "POOL_FALLBACK") {
    return {
      variant: "warning",
      label: formatMessage({
        id: "cockpit.hub.confirm.eligibility.garden",
        defaultMessage: "garden fallback",
      }),
    };
  }
  return {
    variant: "warning",
    label: formatMessage({
      id: "cockpit.hub.confirm.eligibility.protocol",
      defaultMessage: "Green Goods team fallback",
    }),
  };
}
