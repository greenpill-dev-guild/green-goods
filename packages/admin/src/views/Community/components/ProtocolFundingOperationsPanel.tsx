import { SETTLEMENT_ENABLED } from "@green-goods/shared/config/app";
import { useProtocolFundingOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/useProtocolFundingOperationsController";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCommitmentPools } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import type { Address } from "@green-goods/shared/types/domain";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { shortAddress } from "@/views/Garden/Pool/poolFundingPresentation";
import { ProtocolFundingOperationsCard } from "./ProtocolFundingOperationsCard";

export function ProtocolFundingOperationsPanel(props: {
  chainId: number;
  protocolGarden: Address;
  renderLayout?: ComponentProps<typeof ProtocolFundingOperationsCard>["renderLayout"];
}) {
  return SETTLEMENT_ENABLED ? <EnabledProtocolFundingOperationsPanel {...props} /> : null;
}

function EnabledProtocolFundingOperationsPanel({
  chainId,
  protocolGarden,
  renderLayout,
}: {
  chainId: number;
  protocolGarden: Address;
  renderLayout?: ComponentProps<typeof ProtocolFundingOperationsCard>["renderLayout"];
}) {
  const { data: gardensData, refetch: refetchGardens } = useGardens(chainId);
  const pools = useCommitmentPools({ chainId });
  const gardenNames = useMemo(
    () =>
      new Map((gardensData ?? []).map((garden) => [garden.id.toLowerCase(), garden.name] as const)),
    [gardensData]
  );
  const options = useMemo(() => {
    const seen = new Set<string>();
    return pools.pools
      .flatMap((pool) => {
        if (!pool.garden || pool.garden.toLowerCase() === protocolGarden.toLowerCase()) return [];
        const key = pool.garden.toLowerCase();
        if (seen.has(key)) return [];
        seen.add(key);
        return [
          {
            id: pool.garden,
            name: gardenNames.get(key) ?? shortAddress(pool.garden),
          },
        ];
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [gardenNames, pools.pools, protocolGarden]);
  const hasMissingNames = options.some((option) => !gardenNames.has(option.id.toLowerCase()));

  // The registered pool list is the authority for settlement recipients. A
  // persisted garden catalog can predate an indexer cutover, so refresh that
  // descriptive catalog when it cannot name every registered recipient. The
  // address fallback keeps the operational selector usable while it catches up.
  useEffect(() => {
    if (hasMissingNames) void refetchGardens();
  }, [hasMissingNames, refetchGardens]);

  const [targetGarden, setTargetGarden] = useState<Address | null>(null);
  const operations = useProtocolFundingOperationsController({
    chainId,
    protocolGarden,
    targetGarden,
  });
  return (
    <ProtocolFundingOperationsCard
      renderLayout={renderLayout}
      operations={operations}
      gardens={options}
      targetGarden={targetGarden}
      onTargetGardenChange={setTargetGarden}
    />
  );
}
