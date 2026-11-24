import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useCommitmentsInbox } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsInbox";
import { useCommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { listedToConfirmCount } from "./grouping";
import { CommitmentsSheetIcon } from "./Icon";

/** The badge sums the sheet's tab counts, read in the same active garden (DL-129). */
export function CommitmentsSheetLauncher({ onClick }: { onClick: () => void }) {
  const primaryAddress = usePrimaryAddress();
  const { inScope } = useActiveGarden();
  const { totalActCount: inboxActCount } = useCommitmentsInbox({
    chainId: DEFAULT_CHAIN_ID,
    viewer: primaryAddress ?? undefined,
    inScope,
  });
  const toConfirm = useCommitmentsToConfirm({
    chainId: DEFAULT_CHAIN_ID,
    viewer: primaryAddress ?? undefined,
    inScope,
  });

  return (
    <CommitmentsSheetIcon
      onClick={onClick}
      actCount={inboxActCount + listedToConfirmCount(toConfirm)}
    />
  );
}
