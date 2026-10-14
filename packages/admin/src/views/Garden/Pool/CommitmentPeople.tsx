import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { FormattedMessage } from "react-intl";

/**
 * Who a commitment is between, read as people: the provider does the thing for
 * the receiver, whichever side created the record, each named through the
 * shared address display. The direction chip beside it tells the rest.
 *
 * The provider is the lead provider once one is set: on a request taken up as
 * a garden claim, the counterparty is the garden's account, not the person.
 */
export function CommitmentPeople({
  commitment,
  className = "body-xs",
}: {
  commitment: Pick<CommitmentReadModel, "direction" | "creator" | "counterparty" | "leadProvider">;
  className?: string;
}) {
  const provider =
    commitment.leadProvider ??
    (commitment.direction === "REQUEST" ? commitment.counterparty : commitment.creator);
  const receiver =
    commitment.direction === "REQUEST" ? commitment.creator : commitment.counterparty;

  if (provider && receiver && provider !== receiver) {
    return (
      <FormattedMessage
        id="cockpit.garden.pool.row.people"
        defaultMessage="{provider} for {receiver}"
        values={{
          provider: <AddressDisplay address={provider} interactive={false} className={className} />,
          receiver: <AddressDisplay address={receiver} interactive={false} className={className} />,
        }}
      />
    );
  }
  const alone = provider ?? receiver;
  return alone ? (
    <AddressDisplay address={alone} interactive={false} className={className} />
  ) : null;
}
