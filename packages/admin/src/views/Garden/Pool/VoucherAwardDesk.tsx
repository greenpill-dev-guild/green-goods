import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { SERVICE_ISSUER_ROUTES, useVoucherAwards } from "@green-goods/shared/commitment-pooling";
import type { VoucherIssuerReserve } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { VoucherAwardDialog } from "./VoucherAwardDialog";

/** Mount only after the steward chooses awards; loading still needs its own explicit action. */
export function VoucherAwardDesk({
  reserve,
  disabled,
  onClose,
}: {
  reserve: VoucherIssuerReserve;
  disabled: boolean;
  onClose: () => void;
}) {
  const { primaryAddress, authMode, passkeyAccountProfile } = useUser();
  const awards = useVoucherAwards(reserve.issuer.safe);
  const asset = SERVICE_ISSUER_ROUTES.flatMap((route) => route.assets).find(
    (candidate) => candidate.ownerReserve.toLowerCase() === reserve.issuer.safe.toLowerCase()
  );
  if (!asset || reserve.issuer.chainId !== 100) return null;
  return (
    <VoucherAwardDialog
      key={`${reserve.issuer.safe}:${primaryAddress}:${authMode}:${passkeyAccountProfile}`}
      issuer={{
        name: reserve.issuer.name,
        decimals: asset.decimals,
        reserve: reserve.issuer.safe,
        token: asset.token.address,
      }}
      records={awards.records}
      disabled={disabled}
      busy={[awards.load, awards.prepare, awards.send, awards.recover, awards.reconcile].some(
        (action) => action.isPending
      )}
      isLimited={awards.isLimited}
      directSigningAvailable={awards.directSigningAvailable}
      onClose={onClose}
      onLoad={() => awards.load.mutateAsync()}
      onPrepare={(award) => awards.prepare.mutateAsync(award)}
      onSend={(record) => awards.send.mutateAsync(record)}
      onRecover={(record) => awards.recover.mutateAsync(record)}
      onReconcile={(record, transactionHash) =>
        awards.reconcile.mutateAsync({ awardId: record.award.awardId, transactionHash })
      }
    />
  );
}
