import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerActor,
  type ServiceIssuerAsset,
  type ServiceIssuerDraftRecord,
  useServiceIssuerApproval,
  useServiceIssuerDrafts,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { RiCoupon3Line } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { ServiceIssuerOnboarding } from "./ServiceIssuerOnboarding";
import { ServiceIssuerPanel } from "./ServiceIssuerPanel";
import { SETTING_CONTROL_WIDTH } from "./settingControls";

/**
 * Command Surface: the member's own service drafts and service assets, as one titled row with
 * its choice in the right slot and the chosen one's panel under it, in the same frame (DL-152).
 * A draft is approved by the member's signature; every act on an asset is its own reviewed
 * transaction.
 */
export function ServiceAssets() {
  const { primaryAddress, authMode, passkeyAccountProfile } = useUser();
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const drafts = useServiceIssuerDrafts(primaryAddress);
  const [selection, setSelection] = useState("");
  const labelId = useId();
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
  const unconfigured = !primaryAddress || (choices.length === 0 && records.length === 0);
  return (
    <>
      <h5 className="text-label-md text-text-strong-950">{text("title")}</h5>
      <section className="gg-card" data-component="ServiceAssets">
        <FactList frame="inset" className="px-3.5">
          <FactRow
            icon={<RiCoupon3Line className="w-4" />}
            label={text("body")}
            labelId={labelId}
            description={unconfigured ? text("unconfigured") : undefined}
            // The row's act is the choice; with nothing to choose, the row keeps its setting's
            // shape, its words across the row.
            action={
              unconfigured ? (
                <></>
              ) : (
                <NativeSelect
                  aria-labelledby={labelId}
                  controlSize="sm"
                  density="condensed"
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                  className={SETTING_CONTROL_WIDTH}
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
              )
            }
          />
        </FactList>
        {record || selected ? (
          <div className="space-y-4 border-t border-stroke-soft-200 p-4">
            {record ? (
              <SelectedServiceDraft key={`${primaryAddress}:${record.draft.id}`} record={record} />
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
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </>
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
