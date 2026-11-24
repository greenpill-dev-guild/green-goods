import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type {
  VoucherStartProgress,
  VoucherStartStepStatus,
} from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import { SEND_STAGE_WORDS } from "@green-goods/shared/modules/transactions/send-stage";
import { type IntlShape, useIntl } from "react-intl";
import { formatEther } from "viem";
import {
  type TxProgressRow,
  type TxProgressTone,
  TxProgressList,
} from "@/components/TxProgressList";
import type { TxStepMarkerState } from "@/components/TxStepMarker";

/** One send's place in the list, whichever line it rides: the acceptance's or the start's. */
type SendStatus = VoucherStartStepStatus | "waitingOnSafe";

function acceptStatus(phase: TxActPhase): SendStatus {
  switch (phase.status) {
    case "signing":
      return "signing";
    case "confirming":
    case "still-confirming":
      return "confirming";
    case "confirmed":
      return "done";
    case "safe-signers":
      return "waitingOnSafe";
    case "failed":
    case "stopped":
      return "failed";
    case "idle":
    case "queued":
      return "waiting";
  }
}

const MARKER: Record<SendStatus, TxStepMarkerState> = {
  waiting: "pending",
  signing: "active",
  confirming: "active",
  done: "complete",
  failed: "failed",
  waitingOnSafe: "warning",
};

const TONE: Record<SendStatus, TxProgressTone> = {
  waiting: "soft",
  signing: "active",
  confirming: "active",
  done: "success",
  failed: "error",
  waitingOnSafe: "warning",
};

function statusWords(status: SendStatus, intl: IntlShape): string | null {
  switch (status) {
    case "signing":
      return intl.formatMessage(SEND_STAGE_WORDS.wallet.label);
    case "confirming":
      return intl.formatMessage(SEND_STAGE_WORDS.confirming.label);
    case "waitingOnSafe":
      return intl.formatMessage(SEND_STAGE_WORDS["safe-signers"].label);
    case "done":
      return intl.formatMessage({
        id: "hub.garden.pool.setup.status.landed",
        defaultMessage: "Done",
      });
    case "failed":
      return intl.formatMessage({
        id: "hub.garden.pool.setup.status.failed",
        defaultMessage: "Didn’t go through",
      });
    case "waiting":
      return null;
  }
}

/** A native fee in ether, to three significant figures: what the steward's wallet pays. */
function formatStartFee(fee: bigint, intl: IntlShape): string {
  return intl.formatMessage(
    { id: "hub.garden.pool.voucher.start.feeAmount", defaultMessage: "about {amount} ETH" },
    {
      amount: intl.formatNumber(Number(formatEther(fee)), { maximumSignificantDigits: 3 }),
    }
  );
}

export interface VoucherStartListProps {
  /** Where the acceptance stands, on the ask's own line. */
  accept: TxActPhase;
  start: VoucherStartProgress;
  /** The fee quoted before the run; the send's own fresh quote replaces it once asked. */
  estimatedFee: bigint | null;
  name: string;
  chainId: number;
}

/**
 * Accept and Start's three sends (DL-193), each its own approval: the acceptance, then the start's
 * record on the source and its send to the voucher network, which pays the network fee. The steward
 * reads the list before confirming and watches it fill in.
 */
export function VoucherStartList({
  accept,
  start,
  estimatedFee,
  name,
  chainId,
}: VoucherStartListProps) {
  const intl = useIntl();
  const fee = start.fee ?? estimatedFee;
  const sends: {
    id: string;
    title: string;
    why: string;
    status: SendStatus;
    hash: `0x${string}` | null;
  }[] = [
    {
      id: "accept",
      title: intl.formatMessage(
        { id: "hub.garden.pool.voucher.start.accept", defaultMessage: "Accept {name}" },
        { name }
      ),
      why: intl.formatMessage({
        id: "hub.garden.pool.voucher.start.acceptWhy",
        defaultMessage: "Confirms the booking for the pool.",
      }),
      status: acceptStatus(accept),
      hash: accept.status === "confirmed" ? accept.hash : null,
    },
    {
      id: "record",
      title: intl.formatMessage({
        id: "hub.garden.pool.voucher.start.record",
        defaultMessage: "Record the Start",
      }),
      why: intl.formatMessage({
        id: "hub.garden.pool.voucher.start.recordWhy",
        defaultMessage: "Fixes the booking’s terms.",
      }),
      status: start.record,
      hash: start.hashes.record,
    },
    {
      id: "send",
      title: intl.formatMessage({
        id: "hub.garden.pool.voucher.start.send",
        defaultMessage: "Send the Start",
      }),
      why:
        fee !== null
          ? intl.formatMessage(
              {
                id: "hub.garden.pool.voucher.start.sendWhy",
                defaultMessage: "Tells the voucher network. Network fee: {fee}.",
              },
              { fee: formatStartFee(fee, intl) }
            )
          : intl.formatMessage({
              id: "hub.garden.pool.voucher.start.sendWhyUnquoted",
              defaultMessage: "Tells the voucher network. Your wallet shows the network fee.",
            }),
      status: start.send,
      hash: start.hashes.send,
    },
  ];
  const current = sends.findIndex(
    (send) => send.status === "signing" || send.status === "confirming"
  );
  const rows: TxProgressRow[] = sends.map((send, index) => ({
    id: send.id,
    title: send.title,
    why: send.why,
    status: send.status,
    marker: MARKER[send.status],
    label: statusWords(send.status, intl),
    tone: TONE[send.status],
    current: index === current,
    prompt: index + 1,
    hash: send.hash,
  }));
  return (
    <TxProgressList
      testId="voucher-accept-start"
      chainId={chainId}
      rows={rows}
      label={intl.formatMessage({
        id: "hub.garden.pool.voucher.start.listLabel",
        defaultMessage: "Accept and Start, three approvals",
      })}
    />
  );
}
