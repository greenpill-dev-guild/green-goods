import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import type { Address } from "@green-goods/shared/types/domain";
import type { FunderLeaderboardEntry } from "@green-goods/shared/types/vaults";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { useIntl } from "react-intl";

interface FunderRowProps {
  funder: FunderLeaderboardEntry;
}

/**
 * One funder in a supporters list: a person row (DL-112) with the Funder chip and, as its
 * one count, the yield their deposits have generated, which is what the list ranks by.
 */
export function FunderRow({ funder }: FunderRowProps) {
  const { formatMessage } = useIntl();
  return (
    <PersonRow
      address={funder.address as Address}
      roles={["funder"]}
      details={[
        formatMessage(
          { id: "app.funders.yieldGenerated" },
          { amount: formatTokenAmount(funder.totalYieldGenerated) }
        ),
      ]}
    />
  );
}
