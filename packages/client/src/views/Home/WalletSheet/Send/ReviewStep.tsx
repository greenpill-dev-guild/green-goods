import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { Alert } from "@green-goods/shared/components/Alert";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { SendableTokenBalance } from "@green-goods/shared/hooks/blockchain/useSendableTokens";
import { RiPencilLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import type { SelectedRecipient } from "./types";

interface ReviewStepProps {
  recipient: SelectedRecipient;
  /** Resolved recipient display name (ENS → address), computed by the parent. */
  recipientLabel: string;
  token: SendableTokenBalance;
  parsedAmount: bigint;
  note: string;
  onNoteChange: (value: string) => void;
  onEditRecipient: () => void;
  onEditAmount: () => void;
}

export function ReviewStep({
  recipient,
  recipientLabel,
  token,
  parsedAmount,
  note,
  onNoteChange,
  onEditRecipient,
  onEditAmount,
}: ReviewStepProps) {
  const { formatMessage, locale } = useIntl();
  const editLabel = formatMessage({ id: "app.send.edit" });
  // Each fact keeps its Change in the row's right slot, so the reader edits what they read.
  const editButton = (onEdit: () => void) => (
    <IconButton
      size="compact"
      emphasis="tertiary"
      aria-label={editLabel}
      icon={<RiPencilLine />}
      onClick={onEdit}
    />
  );

  return (
    <div className="space-y-4 p-4">
      <FactList>
        <FactRow
          label={formatMessage({ id: "app.send.review.to" })}
          value={recipientLabel}
          valueTitle={recipient.address}
          action={editButton(onEditRecipient)}
        />
        <FactRow
          label={formatMessage({ id: "app.send.review.token" })}
          value={
            token.chainId === 42220 ? formatMessage({ id: "app.celoWallet.asset" }) : token.symbol
          }
          action={editButton(onEditAmount)}
        />
        <FactRow
          label={formatMessage({ id: "app.send.review.amount" })}
          value={`${formatTokenAmount(parsedAmount, token.decimals, token.decimals, locale)} ${token.symbol}`}
          action={editButton(onEditAmount)}
        />
      </FactList>

      <div className="space-y-1.5">
        <SheetHeading as="label" htmlFor="send-note" className="block">
          {formatMessage({ id: "app.send.note.label" })}
        </SheetHeading>
        <Textarea
          id="send-note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={formatMessage({ id: "app.send.note.placeholder" })}
          rows={2}
          className="resize-none"
        />
      </div>

      {token.confersGovernance ? (
        <Alert variant="info" title={formatMessage({ id: "app.send.governance.reviewTitle" })}>
          {formatMessage({ id: "app.send.governance.reviewBody" })}
        </Alert>
      ) : null}

      {/* Offline is announced once, by the flow-level banner in SendTab (it is
          visible on every step, including this one), so no duplicate here. */}
    </div>
  );
}
