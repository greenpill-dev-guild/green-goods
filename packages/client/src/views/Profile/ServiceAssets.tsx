import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerActor,
  type ServiceIssuerAsset,
  type ServiceIssuerDraftRecord,
  useServiceIssuerApproval,
  useServiceIssuerDrafts,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { ServiceIssuerOnboarding } from "./ServiceIssuerOnboarding";
import { ServiceIssuerPanel } from "./ServiceIssuerPanel";

/**
 * Command Surface: the member's own service drafts and service assets. A draft is approved by
 * the member's signature; every act on an asset is its own reviewed transaction.
 */
export function ServiceAssets() {
  const { primaryAddress, authMode, passkeyAccountProfile } = useUser();
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const drafts = useServiceIssuerDrafts(primaryAddress);
  const [selection, setSelection] = useState("");
  const id = useId();
  // Only the signed-in member's own drafts: a draft is theirs to approve or decline.
  const records =
    drafts.data?.status === "observed" && primaryAddress
      ? drafts.data.records.filter(
          ({ draft }) => draft.member.toLowerCase() === primaryAddress.toLowerCase()
        )
      : [];
  const choices = SERVICE_ISSUER_ROUTES.flatMap((route, r) =>
    route.assets.map((asset, a) => ({ key: `${r}:${a}`, route, asset }))
  );
  const record = records.find(({ draft }) => `draft:${draft.id}` === selection);
  const selected = choices.find((choice) => choice.key === selection);
  return (
    <section className="gg-card space-y-4 p-4" data-component="ServiceAssets">
      <h2 className="text-sm font-semibold leading-5 text-text-strong-950">{text("title")}</h2>
      <p className="text-sm text-text-sub-600">{text("body")}</p>
      {!primaryAddress || (choices.length === 0 && records.length === 0) ? (
        <p className="text-sm text-text-sub-600">{text("unconfigured")}</p>
      ) : (
        <>
          <label htmlFor={id} className="block space-y-1 text-sm">
            <span>{text("asset")}</span>
            <NativeSelect id={id} value={selection} onChange={(e) => setSelection(e.target.value)}>
              <option value="">{text("chooseAsset")}</option>
              {records.map(({ draft }) => (
                <option key={draft.id} value={`draft:${draft.id}`}>
                  {formatMessage({ id: "app.voucher.ob.asset" }, { name: draft.terms.token.name })}
                </option>
              ))}
              {choices.map(({ key, asset }) => (
                <option key={key} value={key}>
                  {asset.name} ({asset.symbol})
                </option>
              ))}
            </NativeSelect>
          </label>
          {record ? (
            <SelectedServiceDraft key={`${primaryAddress}:${record.draft.id}`} record={record} />
          ) : null}
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

/** The member's own draft: only their signature, from this account, approves it. */
function SelectedServiceDraft({ record }: { record: ServiceIssuerDraftRecord }) {
  const { approve, canSign } = useServiceIssuerApproval();
  return (
    <ServiceIssuerOnboarding
      record={record}
      canSign={canSign}
      approving={approve.isPending}
      onApprove={(draft) => approve.mutateAsync(draft)}
    />
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
