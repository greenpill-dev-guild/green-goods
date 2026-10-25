import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerActor,
  type ServiceIssuerAsset,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { ServiceIssuerPanel } from "./ServiceIssuerPanel";

/** Command Surface: account holdings and separately authorized issuer controls. */
export function ServiceAssets() {
  const { primaryAddress, authMode, passkeyAccountProfile } = useUser();
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const [selection, setSelection] = useState("");
  const id = useId();
  const choices = SERVICE_ISSUER_ROUTES.flatMap((route, r) =>
    route.assets.map((asset, a) => ({ key: `${r}:${a}`, route, asset }))
  );
  const selected = choices.find((choice) => choice.key === selection);
  return (
    <section className="space-y-4 border-t border-stroke-soft-200 pt-4">
      <h2 className="text-sm font-semibold leading-5 text-text-strong-950">{text("title")}</h2>
      <p className="text-sm text-text-sub-600">{text("body")}</p>
      {!primaryAddress || choices.length === 0 ? (
        <p className="text-sm text-text-sub-600">{text("unconfigured")}</p>
      ) : (
        <>
          <label htmlFor={id} className="block space-y-1 text-sm">
            <span>{text("asset")}</span>
            <NativeSelect id={id} value={selection} onChange={(e) => setSelection(e.target.value)}>
              <option value="">{text("chooseAsset")}</option>
              {choices.map(({ key, asset }) => (
                <option key={key} value={key}>
                  {asset.name} ({asset.symbol})
                </option>
              ))}
            </NativeSelect>
          </label>
          {selected ? (
            <SelectedServiceAsset
              key={`${authMode}:${passkeyAccountProfile}:${primaryAddress}:${selection}`}
              actor={{
                address: primaryAddress,
                routeId: selected.route.service.id,
                assetId: selected.asset.id,
              }}
              assets={selected.route.assets}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function SelectedServiceAsset({
  actor,
  assets,
}: {
  actor: ServiceIssuerActor;
  assets: readonly ServiceIssuerAsset[];
}) {
  const operations = useServiceIssuerOperations(actor);
  return (
    <ServiceIssuerPanel
      snapshot={operations.snapshot.data}
      assets={assets}
      isLoading={operations.snapshot.isLoading}
      isError={operations.snapshot.isError}
      onRefresh={() => operations.snapshot.refetch()}
      onReview={operations.review.mutateAsync}
      onExecute={operations.execute.mutateAsync}
      onReconcile={() => operations.reconcile.mutateAsync()}
      onQuote={operations.quote.mutateAsync}
    />
  );
}
