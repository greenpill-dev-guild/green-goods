import {
  hasVoucherWalletRoute,
  useServiceIssuerDesk,
  useVoucherWallet,
} from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import type { Address } from "@green-goods/shared/types/domain";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { ServiceAssetsView } from "./ServiceAssetsView";
import { catalogAssets, heldVoucherRows, ownDrafts, ownServiceAssets } from "./serviceAssetRows";

/**
 * Your Services on the Profile's Account tab (DL-159): the services the member offers, as drafts
 * a steward sent and assets the live routes list under their reserve, and the vouchers they
 * hold, read from their wallet, each a row that opens its panel in place. A draft is approved by
 * the member's signature, every act on an asset is its own reviewed transaction, and the desk is
 * read only when the member asks, because reading it signs.
 */
export function ServiceAssets() {
  const { formatMessage } = useIntl();
  const { primaryAddress, authMode, passkeyAccountProfile } = useUser();
  const member = primaryAddress as Address | undefined;
  const desk = useServiceIssuerDesk();
  const assets = useMemo(() => catalogAssets(), []);
  const coreModule = getNetworkContracts(DEFAULT_CHAIN_ID).commitmentPoolingModule as Address;
  const walletRoute = hasVoucherWalletRoute({ sourceChainId: DEFAULT_CHAIN_ID, coreModule });
  const scope = useMemo(
    () =>
      member && walletRoute
        ? { sourceChainId: DEFAULT_CHAIN_ID, coreModule, account: member }
        : null,
    [member, walletRoute, coreModule]
  );
  const wallet = useVoucherWallet(scope);
  const walletState = !scope
    ? "none"
    : wallet.isError || wallet.data?.evidence === "unavailable"
      ? "failed"
      : wallet.data
        ? "ready"
        : "reading";
  return (
    <section className="flex flex-col gap-2" data-component="ServiceAssets">
      <h5 className="text-label-md text-text-strong-950">
        {formatMessage({ id: "app.profile.issuer.title" })}
      </h5>
      <ServiceAssetsView
        member={member}
        identity={`${authMode}:${passkeyAccountProfile}:${member}`}
        drafts={{
          records: ownDrafts(desk.records, member),
          loaded: desk.loaded,
          loading: desk.load.isPending,
          failed: desk.load.isError || desk.decline.isError,
          canSign: desk.canSign,
          approving: desk.approve.isPending || desk.decline.isPending,
          onCheck: () => desk.load.mutate(),
          onApprove: (record) => desk.approve.mutateAsync(record),
          onDecline: (record) => desk.decline.mutate(record),
        }}
        services={ownServiceAssets(assets, member)}
        holdings={heldVoucherRows(wallet.data, assets)}
        wallet={walletState}
        onRefreshWallet={() => wallet.refetch()}
        unconfigured={!member || (assets.length === 0 && desk.records.length === 0 && !walletRoute)}
      />
    </section>
  );
}
