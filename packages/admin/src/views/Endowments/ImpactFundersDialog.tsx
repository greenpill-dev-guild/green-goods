import { DialogShell, type FunderAssetTotal, type FunderLeaderboardEntry } from "@green-goods/shared";
import { RiTrophyLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { FunderRow } from "@/components/Vault/FunderRow";
import { formatFunderAssetTotals } from "@/components/Vault/funderTotals";

interface ImpactFundersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funders: FunderLeaderboardEntry[];
  protocolAssetTotals: FunderAssetTotal[];
}

export function ImpactFundersDialog({
  open,
  onOpenChange,
  funders,
  protocolAssetTotals,
}: ImpactFundersDialogProps) {
  const { formatMessage } = useIntl();
  const maxYield = funders[0]?.totalYieldGenerated ?? 0n;
  const protocolYieldLabel = formatFunderAssetTotals(protocolAssetTotals);
  const showYieldBar = protocolAssetTotals.length === 1;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      title={formatMessage({ id: "app.funders.impactFundersTitle" })}
      description={
        protocolYieldLabel !== "0"
          ? formatMessage({ id: "app.funders.yieldGenerated" }, { amount: protocolYieldLabel })
          : formatMessage({ id: "app.funders.impactFundersSubtitle" })
      }
      icon={<RiTrophyLine className="h-5 w-5 text-success-base" />}
      iconContainerClassName="bg-success-lighter text-success-base"
      bodyClassName="max-h-[calc(90vh-80px)] overflow-y-auto p-4 sm:p-6"
    >
      <div className="space-y-2 sm:space-y-3">
        {funders.map((funder) => (
          <FunderRow
            key={funder.address}
            funder={funder}
            maxYield={maxYield}
            showYieldBar={showYieldBar}
          />
        ))}
      </div>
    </DialogShell>
  );
}
