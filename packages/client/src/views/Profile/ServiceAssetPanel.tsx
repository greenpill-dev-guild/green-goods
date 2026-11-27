import {
  type ServiceIssuerActor,
  type ServiceIssuerAsset,
  type ServiceIssuerPool,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useState } from "react";
import { useIntl } from "react-intl";
import { ServiceIssuerPanel } from "@/components/Features/Vouchers/ServiceIssuerPanel";

interface Props {
  actor: ServiceIssuerActor;
  assets: readonly ServiceIssuerAsset[];
  pools: readonly ServiceIssuerPool[];
  /** A second exchange of what the first delivered, bound to its receipt. */
  continuing: boolean;
  onContinue: (assetId: string) => void;
  /** Reads the account's vouchers again once an exchange is confirmed, so the rows above agree. */
  onRefresh: () => Promise<unknown>;
}

/**
 * One asset's panel under its row in Your Services: the exchange pool to act in, then the
 * issuer panel, which reads the asset's standing and prepares each act's exact review. The
 * actor is explicit and the member's own; a buyer's key is never repurposed as issuer authority.
 */
export function ServiceAssetPanel({
  actor,
  assets,
  pools,
  continuing,
  onContinue,
  onRefresh,
}: Props) {
  const intl = useIntl();
  const [poolId, setPoolId] = useState("");
  const selected = pools.find((pool) => pool.id === poolId);
  const selectedActor = selected ? { ...actor, poolId: selected.id } : actor;
  const operations = useServiceIssuerOperations(selectedActor);
  const receipt = operations.lastExchange.data;
  const first = receipt?.review;
  const continuation =
    continuing &&
    first?.action.kind === "exchange" &&
    !first.continuation &&
    first.actor.routeId === actor.routeId &&
    first.action.outputAssetId === actor.assetId;
  const choices = pools.filter(
    (pool) =>
      pool.listings.some((listing) => listing.assetId === actor.assetId) &&
      (!continuation || pool.id !== first.actor.poolId)
  );
  const canContinue =
    !continuing &&
    first?.action.kind === "exchange" &&
    !first.continuation &&
    first.actor.routeId === actor.routeId &&
    pools.some(
      (pool) =>
        pool.id !== first.actor.poolId &&
        pool.listings.some(
          (listing) =>
            first.action.kind === "exchange" && listing.assetId === first.action.outputAssetId
        )
    );
  return (
    <div className="space-y-3">
      {continuation ? (
        <p role="status" className="text-sm">
          {intl.formatMessage({ id: "app.voucher.exchange.continueNote" })}
        </p>
      ) : null}
      {canContinue ? (
        <Button
          type="button"
          emphasis="secondary"
          onClick={() => {
            if (first.action.kind === "exchange") onContinue(first.action.outputAssetId);
          }}
        >
          {intl.formatMessage({ id: "app.voucher.exchange.continue" })}
        </Button>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span>{intl.formatMessage({ id: "app.voucher.exchange.pool" })}</span>
        <NativeSelect value={poolId} onChange={(event) => setPoolId(event.target.value)}>
          <option value="">{intl.formatMessage({ id: "app.voucher.exchange.choosePool" })}</option>
          {choices.map((pool) => (
            <option key={pool.id} value={pool.id}>
              {pool.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <ServiceIssuerPanel
        key={poolId}
        poolName={selected?.name}
        snapshot={operations.snapshot.data}
        assets={
          selected
            ? assets.filter((asset) =>
                selected.listings.some((policy) => policy.assetId === asset.id)
              )
            : assets
        }
        isLoading={operations.snapshot.isLoading}
        isError={operations.snapshot.isError}
        onRefresh={() => operations.snapshot.refetch()}
        onReview={(action) =>
          continuation && action.kind === "exchange"
            ? operations.reviewContinuation.mutateAsync(action)
            : operations.review.mutateAsync(action)
        }
        onExecute={async (review) => {
          const outcome = await operations.execute.mutateAsync(review);
          if (outcome.status === "confirmed") await onRefresh();
          return outcome;
        }}
        onReconcile={async () => {
          const outcome = await operations.reconcile.mutateAsync();
          if (outcome?.status === "confirmed") await onRefresh();
          return outcome;
        }}
        onQuote={
          continuation ? operations.quoteContinuation.mutateAsync : operations.quote.mutateAsync
        }
      />
    </div>
  );
}
