import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerActor,
  type ServiceIssuerAsset,
  type ServiceIssuerPool,
  useServiceIssuerDesk,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { RiCoupon3Line } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { ServiceIssuerOnboarding } from "./ServiceIssuerOnboarding";
import { ServiceIssuerPanel } from "@/components/Features/Vouchers/ServiceIssuerPanel";

/**
 * Command Surface: the member's own service drafts and service assets. A draft is approved by
 * the member's signature; every act on an asset is its own reviewed transaction.
 */
export function ServiceAssets() {
  const { primaryAddress, authMode, passkeyAccountProfile } = useUser();
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const desk = useServiceIssuerDesk();
  const { canSign } = desk;
  const [selection, setSelection] = useState("");
  const [continuing, setContinuing] = useState(false);
  const id = useId();
  // Only the signed-in member's own drafts: a draft is theirs to approve or decline.
  const records = primaryAddress
    ? desk.records.filter(
        ({ draft }) => draft.member.toLowerCase() === primaryAddress.toLowerCase()
      )
    : [];
  const choices = SERVICE_ISSUER_ROUTES.flatMap((route, r) =>
    route.assets.map((asset, a) => ({ key: `${r}:${a}`, route, asset }))
  );
  const record = records.find(({ draft }) => `draft:${draft.id}` === selection);
  const selected = choices.find((choice) => choice.key === selection);
  const unconfigured = !primaryAddress || (choices.length === 0 && records.length === 0);
  return (
    <section className="flex flex-col gap-2" data-component="ServiceAssets">
      <h5 className="text-label-md text-text-strong-950">{text("title")}</h5>
      <Card>
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar>
              <RiCoupon3Line className="h-4 w-4 text-primary-on-surface" aria-hidden="true" />
            </Avatar>
            <p id={id} className="min-w-0 flex-1 basis-0 text-sm text-text-strong-950">
              {text("body")}
            </p>
            {unconfigured ? null : (
              <NativeSelect
                aria-labelledby={id}
                controlSize="sm"
                density="condensed"
                value={selection}
                onChange={(e) => {
                  setSelection(e.target.value);
                  setContinuing(false);
                }}
                // Under the sentence on a phone under 390px.
                className="w-[120px] shrink-0 sm:w-[140px] @max-[358px]:w-full @max-[358px]:basis-full"
              >
                <option value="">{text("chooseShort")}</option>
                {records.map(({ draft }) => (
                  <option key={draft.id} value={`draft:${draft.id}`}>
                    {formatMessage(
                      { id: "app.voucher.ob.asset" },
                      { name: draft.terms.token.name }
                    )}
                  </option>
                ))}
                {choices.map(({ key, asset }) => (
                  <option key={key} value={key}>
                    {asset.name} ({asset.symbol})
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
          {primaryAddress ? (
            <div className="space-y-2">
              <Button
                type="button"
                emphasis="secondary"
                loading={desk.load.isPending}
                onClick={() => desk.load.mutate()}
              >
                {formatMessage({ id: "app.voucher.exchange.loadServices" })}
              </Button>
              {desk.load.isError || desk.decline.isError ? (
                <p role="alert" className="text-sm">
                  {formatMessage({ id: "app.voucher.exchange.servicesFailed" })}
                </p>
              ) : null}
            </div>
          ) : null}
          {unconfigured ? (
            <p className="text-xs text-text-sub-600">{text("unconfigured")}</p>
          ) : null}
          {record ? (
            <ServiceIssuerOnboarding
              key={`${primaryAddress}:${record.draft.id}:${record.revision}`}
              record={record}
              canSign={canSign}
              approving={desk.approve.isPending || desk.decline.isPending}
              onApprove={async () => {
                await desk.approve.mutateAsync(record);
              }}
              onDecline={() => desk.decline.mutate(record)}
            />
          ) : null}
          {selected && primaryAddress ? (
            <SelectedServiceAsset
              key={`${authMode}:${passkeyAccountProfile}:${primaryAddress}:${selection}`}
              actor={{
                address: primaryAddress,
                routeId: selected.route.service.id,
                assetId: selected.asset.id,
              }}
              assets={selected.route.assets}
              pools={selected.route.pools}
              continuing={continuing}
              onContinue={(assetId) => {
                const next = choices.find(
                  (choice) =>
                    choice.route.service.id === selected.route.service.id &&
                    choice.asset.id === assetId
                );
                if (next) {
                  setSelection(next.key);
                  setContinuing(true);
                }
              }}
            />
          ) : null}
        </div>
      </Card>
    </section>
  );
}

function SelectedServiceAsset({
  actor,
  assets,
  pools,
  continuing,
  onContinue,
}: {
  actor: ServiceIssuerActor;
  assets: readonly ServiceIssuerAsset[];
  pools: readonly ServiceIssuerPool[];
  continuing: boolean;
  onContinue: (assetId: string) => void;
}) {
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
        onExecute={operations.execute.mutateAsync}
        onReconcile={() => operations.reconcile.mutateAsync()}
        onQuote={
          continuation ? operations.quoteContinuation.mutateAsync : operations.quote.mutateAsync
        }
      />
    </div>
  );
}
