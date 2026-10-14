import { Alert } from "@green-goods/shared/components/Alert";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useProtocolPool } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import type { Address } from "@green-goods/shared/types/domain";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { shortAddress } from "./poolPresentation";

/** The pool a dialog's writes land on, as the steward should read it. */
export interface PoolWriteTarget {
  /** The garden whose pool this is. */
  gardenName: string;
  /** The Green Goods protocol pool: the Green Goods Community Garden's own. */
  isProtocol: boolean;
}

interface PoolTargetProps {
  target: PoolWriteTarget;
  /** The one record inside the pool the act changes, such as a commitment's title. */
  record?: string;
  /** Who the act concerns, when that is not the steward (a claimant, say). */
  party?: { label: string; value: ReactNode };
  /**
   * Where it sits: first in a dialog's body (`block`, today's place), at the foot
   * of a flow's step rail (`rail`), or as one line under the stepper on narrow
   * screens (`line`), PRD-1022 D11. A protocol-pool flow keeps its warning in
   * the body as well.
   */
  placement?: "block" | "rail" | "line";
}

/**
 * Names what a write changes, first thing in every pool dialog, so a steward
 * never infers an irreversible write's target from the header or from the
 * page they came through. This is the disambiguation exception to "don't
 * redeclare the chrome's context": a dialog cannot prove which pool or record
 * it is about to change, so it says. The protocol pool is set apart as a
 * warning, because a change there reaches beyond one garden.
 */
export function PoolTarget({ target, record, party, placement = "block" }: PoolTargetProps) {
  const { formatMessage } = useIntl();
  if (placement !== "block") {
    const name = target.isProtocol
      ? formatMessage({
          id: "cockpit.garden.pool.target.protocolName",
          defaultMessage: "the Green Goods protocol pool",
        })
      : formatMessage(
          { id: "cockpit.garden.pool.target.garden", defaultMessage: "{garden}’s pool" },
          { garden: target.gardenName }
        );
    const kind = target.isProtocol ? "protocol" : "garden";
    if (placement === "line") {
      return (
        <p
          data-component="PoolTarget"
          data-kind={kind}
          data-placement="line"
          className="truncate body-xs text-text-soft"
          title={name}
        >
          {formatMessage(
            { id: "cockpit.garden.pool.target.line", defaultMessage: "Writing to {target}" },
            { target: <span className="font-semibold text-text-strong">{name}</span> }
          )}
        </p>
      );
    }
    return (
      <dl data-component="PoolTarget" data-kind={kind} data-placement="rail" className="min-w-0">
        <dt className="label-xs text-text-soft">
          {formatMessage({ id: "cockpit.garden.pool.target.label", defaultMessage: "Writing to" })}
        </dt>
        <dd className="break-words body-sm font-semibold text-text-strong">{name}</dd>
      </dl>
    );
  }
  const partyRow = party ? (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <dt className="label-xs text-text-soft">{party.label}</dt>
      <dd className="min-w-0 text-body-md text-text-strong">{party.value}</dd>
    </div>
  ) : null;

  if (target.isProtocol) {
    return (
      <div data-component="PoolTarget" data-kind="protocol" className="space-y-2">
        <Alert
          variant="warning"
          title={formatMessage({
            id: "cockpit.garden.pool.target.protocol",
            defaultMessage: "Writing to the Green Goods protocol pool",
          })}
        >
          {record
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.target.protocolRecord",
                  defaultMessage:
                    "“{record}”, in the Green Goods Community Garden’s own pool, where the protocol’s commitments live. Changes here can affect commitments across gardens.",
                },
                { record }
              )
            : formatMessage({
                id: "cockpit.garden.pool.target.protocolNote",
                defaultMessage:
                  "The Green Goods Community Garden’s own pool, where the protocol’s commitments live. Changes here can affect commitments across gardens.",
              })}
        </Alert>
        {partyRow ? <dl>{partyRow}</dl> : null}
      </div>
    );
  }

  const name = record
    ? formatMessage(
        {
          id: "cockpit.garden.pool.target.record",
          defaultMessage: "“{record}” in {garden}’s pool",
        },
        { record, garden: target.gardenName }
      )
    : formatMessage(
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
      {partyRow}
    </dl>
  );
}

interface GardenPoolTargetProps extends Omit<PoolTargetProps, "target"> {
  chainId: number;
  /** The garden whose pool the act writes to, as the surface was handed it. */
  garden: Address;
  /** Known already where the pool itself was read; otherwise the protocol's root garden decides. */
  isProtocol?: boolean;
}

/**
 * The target line for a surface that was handed only a garden's address (the
 * seeding wizard, the commitment inspector in any of its mounts). It names the
 * garden from the gardens list and tells the protocol pool by the protocol's
 * root garden, so the words come from the pool written to, never from where
 * the surface happens to be mounted.
 */
export function GardenPoolTarget({ chainId, garden, isProtocol, ...rest }: GardenPoolTargetProps) {
  const { data: gardens } = useGardens(chainId);
  const protocol = useProtocolPool({ chainId });
  const key = garden.toLowerCase();
  const gardenName =
    gardens?.find((entry) => entry.id.toLowerCase() === key)?.name ?? shortAddress(garden);
  const protocolPool = isProtocol ?? protocol.rootGarden?.toLowerCase() === key;
  return <PoolTarget target={{ gardenName, isProtocol: protocolPool }} {...rest} />;
}
