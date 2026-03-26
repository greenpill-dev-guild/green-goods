import { type FunderAssetTotal, type FunderLeaderboardEntry } from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiTrophyLine } from "@remixicon/react";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content className="fixed z-50 w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:max-w-4xl sm:-translate-y-1/2 sm:rounded-2xl lg:max-w-5xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-success-lighter text-success-base sm:h-10 sm:w-10">
                <RiTrophyLine className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title
                  className="truncate text-lg font-semibold text-text-strong sm:text-xl"
                  title={formatMessage({ id: "app.funders.impactFundersTitle" })}
                >
                  {formatMessage({ id: "app.funders.impactFundersTitle" })}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-text-soft sm:text-sm">
                  {protocolYieldLabel !== "0"
                    ? formatMessage(
                        { id: "app.funders.yieldGenerated" },
                        { amount: protocolYieldLabel }
                      )
                    : formatMessage({ id: "app.funders.impactFundersSubtitle" })}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
                aria-label={formatMessage({ id: "app.common.close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 sm:p-6">
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
          </div>

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden" aria-hidden="true">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
