import { Alert } from "@green-goods/shared/components/Alert";
import { useIntl } from "react-intl";

/** The pool a dialog's writes land on, as the steward should read it. */
export interface PoolWriteTarget {
  /** The garden whose pool this is. */
  gardenName: string;
  /** The Green Goods protocol pool, not a garden's own. */
  isProtocol: boolean;
}

/**
 * Names the pool a write changes, first thing in every pool dialog, so a
 * steward never infers an irreversible write's target from the header or from
 * the tab they came through. This is the disambiguation exception to "don't
 * redeclare the chrome's context": a garden's own pool and the protocol pool
 * are different targets, so the line says which. The protocol pool is set
 * apart as a warning, so a change there never reads as a change to one garden.
 */
export function PoolTarget({ target }: { target: PoolWriteTarget }) {
  const { formatMessage } = useIntl();
  if (target.isProtocol) {
    return (
      <div data-component="PoolTarget" data-kind="protocol">
        <Alert
          variant="warning"
          title={formatMessage({
            id: "cockpit.garden.pool.target.protocol",
            defaultMessage: "Writing to the Green Goods protocol pool",
          })}
        >
          {formatMessage({
            id: "cockpit.garden.pool.target.protocolNote",
            defaultMessage: "Not a garden’s own pool. Only protocol stewards can change it.",
          })}
        </Alert>
      </div>
    );
  }
  const name = formatMessage(
    { id: "cockpit.garden.pool.target.garden", defaultMessage: "{garden}’s pool" },
    { garden: target.gardenName }
  );
  return (
    <dl data-component="PoolTarget" data-kind="garden" className="min-w-0">
      <dt className="label-xs text-text-soft">
        {formatMessage({ id: "cockpit.garden.pool.target.label", defaultMessage: "Writing to" })}
      </dt>
      <dd className="truncate text-body-md font-semibold text-text-strong" title={name}>
        {name}
      </dd>
    </dl>
  );
}
