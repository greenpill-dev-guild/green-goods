/**
 * The words for a seeding pass: what each row is called while it runs and how
 * it ended, the one line saying where the pass stands, and the counts the done
 * screen opens with. One module, so the list, the line and the summary never
 * describe the same row two ways.
 */
import { getChainName } from "@green-goods/shared/config/chains";
import type {
  SeedRowProgress,
  SeedRowStatus,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { TxProgressRow, TxProgressTone } from "@/components/TxProgressList";
import type { TxStepMarkerState } from "@/components/TxStepMarker";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

const MARKER: Record<SeedRowStatus, TxStepMarkerState> = {
  waiting: "pending",
  preparing: "active",
  wallet: "active",
  confirming: "active",
  created: "complete",
  // Not done, and not a failure: a cross here would read as one.
  later: "queued",
  "not-sent": "failed",
};

const TONE: Record<SeedRowStatus, TxProgressTone> = {
  waiting: "soft",
  preparing: "active",
  wallet: "active",
  confirming: "active",
  created: "success",
  later: "warning",
  "not-sent": "error",
};

const LIVE = new Set<SeedRowStatus>(["preparing", "wallet", "confirming"]);

function statusLabel(status: SeedRowStatus, formatMessage: FormatMessage): string | null {
  switch (status) {
    case "waiting":
      return null;
    case "preparing":
      return formatMessage({
        id: "cockpit.garden.pool.seed.row.preparing",
        defaultMessage: "Preparing…",
      });
    case "wallet":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.signing",
        defaultMessage: "Confirm in your wallet",
      });
    case "confirming":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.confirming",
        defaultMessage: "Confirming…",
      });
    case "created":
      return formatMessage({
        id: "cockpit.garden.pool.seed.row.created",
        defaultMessage: "Created",
      });
    case "later":
      return formatMessage({
        id: "cockpit.garden.pool.seed.row.later",
        defaultMessage: "Sends later",
      });
    case "not-sent":
      // The same mark the row carries back in the list of the ones added so far.
      return formatMessage({
        id: "cockpit.garden.pool.seed.tray.notSent",
        defaultMessage: "Not sent",
      });
  }
}

/** Every row of the pass, laid out for the progress list. Each row is one prompt. */
export function seedPassRows(
  pass: readonly SeedRowProgress[],
  formatMessage: FormatMessage
): TxProgressRow[] {
  return pass.map((row, index) => ({
    id: row.clientCommitmentId,
    title: row.title,
    status: row.status,
    marker: MARKER[row.status],
    label: statusLabel(row.status, formatMessage),
    tone: TONE[row.status],
    current: LIVE.has(row.status),
    prompt: index + 1,
    // The list links a hash only once its row is done, so only a created row links.
    hash: row.txHash as `0x${string}` | null,
  }));
}

/** Where a running pass stands, in one line: which prompt, of how many. */
export function seedPassLine(
  pass: readonly SeedRowProgress[],
  chainId: number,
  formatMessage: FormatMessage
): string {
  const index = pass.findIndex((row) => LIVE.has(row.status));
  const row = index >= 0 ? pass[index] : undefined;
  const values = { current: index + 1, total: pass.length };
  if (row?.status === "wallet") {
    return formatMessage(
      {
        id: "cockpit.garden.pool.setup.live.signing",
        defaultMessage: "Confirm in your wallet ({current} of {total})",
      },
      values
    );
  }
  if (row?.status === "confirming") {
    return formatMessage(
      {
        id: "cockpit.garden.pool.setup.live.confirming",
        defaultMessage: "Confirming on {network} ({current} of {total})",
      },
      { ...values, network: getChainName(chainId) }
    );
  }
  return formatMessage(
    {
      id: "cockpit.garden.pool.seed.live.preparing",
      defaultMessage: "Preparing commitment {current} of {total}…",
    },
    { current: Math.max(index + 1, 1), total: pass.length }
  );
}

/** How the pass ended, by outcome. */
export function seedPassCounts(pass: readonly SeedRowProgress[]) {
  return {
    created: pass.filter((row) => row.status === "created").length,
    later: pass.filter((row) => row.status === "later").length,
    notSent: pass.filter((row) => row.status === "not-sent").length,
  };
}
