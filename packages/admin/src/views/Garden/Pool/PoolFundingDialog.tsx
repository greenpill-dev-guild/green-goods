import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { RiFundsLine } from "@remixicon/react";
import type { RefObject } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { PoolFundingDialogFinancialSections } from "./PoolFundingDialogFinancialSections";
import { PoolFundingDialogReadinessSections } from "./PoolFundingDialogReadinessSections";

export interface PoolFundingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funding: PoolFundingControllerView;
  protocolContext?: boolean;
  tone: "garden" | "community";
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

export function PoolFundingDialog({
  open,
  onOpenChange,
  funding,
  protocolContext = false,
  tone,
  returnFocusRef,
}: PoolFundingDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage({
        id: "cockpit.garden.pool.funding.dialog.title",
        defaultMessage: "Pool funding details",
      })}
      description={formatMessage({
        id: "cockpit.garden.pool.funding.dialog.description",
        defaultMessage: "How live G$ liquidity, obligations, fees, and settlement limits combine.",
      })}
      icon={RiFundsLine}
      size="lg"
      tone={tone}
      bodyClassName="space-y-6"
      finalFocusRef={returnFocusRef}
    >
      {protocolContext ? (
        <p className="rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] p-3 text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.garden.pool.funding.protocolNote",
            defaultMessage:
              "Upstream treasury inflow is not recorded here; the Celo Safe balance is authoritative.",
          })}
        </p>
      ) : null}
      <PoolFundingDialogFinancialSections snapshot={funding.snapshot} />
      <PoolFundingDialogReadinessSections funding={funding} />
    </AdminDialog>
  );
}
