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
import { RiCoupon3Line } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
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
                onChange={(e) => setSelection(e.target.value)}
                // Under the sentence on a phone under 390px, as Username's act is.
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
          {unconfigured ? (
            <p className="text-xs text-text-sub-600">{text("unconfigured")}</p>
          ) : null}
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
      </Card>
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
