import {
  SERVICE_ISSUER_ROUTES,
  serviceIssuerGovernanceDrafts,
  type ServiceIssuerAsset,
  type ServiceIssuerRoute,
} from "@green-goods/shared/commitment-pooling";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useState } from "react";
import { useIntl } from "react-intl";
import { encodeFunctionData, formatUnits } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";

interface Props {
  canPrepare: boolean;
  routes?: readonly ServiceIssuerRoute[];
  rehearsal?: boolean;
}

/** Command: stewards review prepared issuer terms; owner Safe calls stay separate from member acts. */
export function VoucherIssuerOnboarding({
  canPrepare,
  routes = SERVICE_ISSUER_ROUTES,
  rehearsal = false,
}: Props) {
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `cockpit.community.voucherIssuers.${key}` });
  const [selected, setSelected] = useState<{
    route: ServiceIssuerRoute;
    asset: ServiceIssuerAsset;
  } | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const rows = routes.flatMap((route) => route.assets.map((asset) => ({ route, asset })));
  // A changed catalog invalidates an open review instead of exporting an obsolete configuration.
  const current =
    selected &&
    rows.find(({ route, asset }) => route === selected.route && asset === selected.asset);
  const amount = (value: bigint | null, asset: ServiceIssuerAsset) =>
    value === null ? text("unconfirmed") : `${formatUnits(value, asset.decimals)} ${asset.symbol}`;
  let drafts: ReturnType<typeof serviceIssuerGovernanceDrafts> | null = null;
  if (current) {
    try {
      drafts = serviceIssuerGovernanceDrafts(current.route, current.asset.id);
    } catch {
      /* Incomplete reviewed metadata must remain unavailable. */
    }
  }
  const copy = async () => {
    if (!canPrepare || rehearsal || !current || !drafts) return;
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            kind: "owner-safe-drafts",
            routeId: current.route.service.id,
            assetId: current.asset.id,
            calls: drafts.map(({ purpose, owner, call }) => ({
              purpose,
              owner,
              chainId: call.chainId,
              to: call.address,
              value: "0",
              data: encodeFunctionData({
                abi: call.abi,
                functionName: call.functionName,
                args: call.args,
              }),
            })),
          },
          null,
          2
        )
      );
      toastService.success({ title: text("copied") });
    } catch {
      setCopyFailed(true);
    }
  };
  return (
    <section
      className="surface-section space-y-3"
      aria-label={text("title")}
      data-component="VoucherIssuerOnboarding"
    >
      <h3 className="text-title-sm text-text-strong">{text("title")}</h3>
      <p className="text-body-sm text-text-soft">{text("help")}</p>
      {rehearsal ? (
        <p role="status" className="text-body-sm text-text-soft">
          {text("fictional")}
        </p>
      ) : null}
      {!rows.length ? (
        <p role="status" className="text-body-sm text-text-soft">
          {text("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-stroke-soft">
          {rows.map(({ route, asset }) => (
            <li
              key={`${route.service.id}:${asset.id}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="min-w-0">
                <p className="text-body-md font-medium text-text-strong">{asset.name}</p>
                <p className="text-body-sm text-text-soft">
                  {text(asset.kind)} · {asset.service.unit ?? text("unconfirmed")}
                </p>
              </div>
              <AdminButton
                type="button"
                variant="outlined"
                disabled={!canPrepare}
                onClick={() => {
                  setSelected({ route, asset });
                  setCopyFailed(false);
                }}
              >
                {text("review")}
              </AdminButton>
            </li>
          ))}
        </ul>
      )}
      {!canPrepare ? <p className="text-body-sm text-text-soft">{text("stewardOnly")}</p> : null}
      <AdminDialog
        open={Boolean(current)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={text("reviewTitle")}
        target={current?.asset.name}
        description={text("draftOnly")}
        size="lg"
        tone="community"
        actions={
          <AdminButton
            type="button"
            variant="outlined"
            disabled={!canPrepare || rehearsal || !drafts}
            onClick={() => void copy()}
          >
            {text("copy")}
          </AdminButton>
        }
      >
        {current ? (
          <div className="space-y-4">
            <dl className="space-y-2 text-body-sm">
              {[
                ["owner", current.asset.ownerReserve],
                ["sourceAuthority", current.asset.sourceAuthority],
                ["unit", current.asset.service.unit ?? text("unconfirmed")],
                ["terms", current.asset.service.terms.reference ?? text("unconfirmed")],
                ["termsDigest", current.asset.service.terms.digest ?? text("unconfirmed")],
                ["approval", current.asset.service.approval.reference ?? text("unconfirmed")],
                ["approvalDigest", current.asset.service.approval.digest ?? text("unconfirmed")],
                [
                  "capacity",
                  text(current.asset.service.capacityConfirmed ? "confirmed" : "unconfirmed"),
                ],
                ["supply", amount(current.asset.initialSupply, current.asset)],
                ["allowance", amount(current.asset.adapterAllowance, current.asset)],
                ["cap", amount(current.asset.poolHoldingCap, current.asset)],
                ["price", current.asset.priceIndex?.toString() ?? text("unconfirmed")],
                ["control", current.asset.upgradeControl?.admin ?? text("unconfirmed")],
              ].map(([key, value]) => (
                <div key={key} className="space-y-1 break-all">
                  <dt className="text-text-soft">{text(key!)}</dt>
                  <dd className="text-text-strong">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-body-sm text-text-soft">{text("capacityHelp")}</p>
            {drafts ? (
              <ol className="space-y-3">
                {drafts.map((draft) => (
                  <li key={draft.purpose} className="space-y-1 text-body-sm break-all">
                    <p className="font-medium">{text(draft.purpose)}</p>
                    <p>
                      {text("chain")}: {draft.call.chainId} · {text("safe")}: {draft.owner}
                    </p>
                    <p>
                      {text("target")}: {draft.call.address}
                    </p>
                    <p>{text("nativeValue")}: 0</p>
                    <code className="block whitespace-normal text-label-md">
                      {draft.call.functionName}({draft.call.args?.map(String).join(", ")})
                    </code>
                  </li>
                ))}
              </ol>
            ) : (
              <p role="status" className="text-body-sm">
                {text("incomplete")}
              </p>
            )}
            <p className="text-body-sm text-text-soft">{text("pause")}</p>
            {copyFailed ? (
              <p role="alert" className="text-body-sm text-error-dark">
                {text("copyFailed")}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminDialog>
    </section>
  );
}
