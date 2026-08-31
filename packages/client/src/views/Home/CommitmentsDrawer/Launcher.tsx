import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useCommitmentsInbox } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsInbox";
import { useCommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { CommitmentsDrawerIcon } from "./Icon";

export function CommitmentsDrawerLauncher({ onClick }: { onClick: () => void }) {
  const primaryAddress = usePrimaryAddress();
  const { totalActCount: inboxActCount } = useCommitmentsInbox({
    chainId: DEFAULT_CHAIN_ID,
    viewer: primaryAddress ?? undefined,
  });
  const { count: toConfirmCount } = useCommitmentsToConfirm({
    chainId: DEFAULT_CHAIN_ID,
    viewer: primaryAddress ?? undefined,
  });

  return <CommitmentsDrawerIcon onClick={onClick} actCount={inboxActCount + toConfirmCount} />;
}
