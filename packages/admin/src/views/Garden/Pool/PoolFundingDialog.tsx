import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { getBlockExplorer } from "@green-goods/shared/utils/blockchain/chain-registry";
import { RiExternalLinkLine, RiFundsLine } from "@remixicon/react";
import type { RefObject } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { PoolFundingDialogFinancialSections } from "./PoolFundingDialogFinancialSections";
import { PoolFundingDialogReadinessSections } from "./PoolFundingDialogReadinessSections";
import { fundingStateMessage, shortAddress } from "./poolFundingPresentation";

export interface PoolFundingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funding: PoolFundingControllerView;
  protocolContext?: boolean;
  tone: "garden" | "community";
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Everything behind the Pool Funding card: the Safe the pool pays from, with
 * its explorer link, then how liquidity, obligations, fees and settlement
 * limits combine.
 */
export function PoolFundingDialog({
  open,
  onOpenChange,
  funding,
  protocolContext = false,
  tone,
  returnFocusRef,
}: PoolFundingDialogProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const safe = funding.snapshot?.safe ?? null;

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage({
        id: "cockpit.garden.pool.funding.dialog.title",
        defaultMessage: "Pool Funding Details",
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
      <dl>
        <dt className="body-xs text-text-soft">
          {formatMessage({ id: "cockpit.garden.pool.funding.safe", defaultMessage: "Celo Safe" })}
        </dt>
        <dd className="mt-0.5 body-sm font-medium text-text-strong">
          {safe ? (
            <a
              className="inline-flex min-h-11 items-center gap-1 underline decoration-stroke-soft underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))]"
              href={`${getBlockExplorer(42220)}/address/${safe}`}
              target="_blank"
              rel="noreferrer"
              title={safe}
            >
              {shortAddress(safe)}
              <RiExternalLinkLine className="h-4 w-4" aria-hidden />
              <span className="sr-only">
                {formatMessage({
                  id: "cockpit.garden.pool.funding.opensExplorer",
                  defaultMessage: "Opens in Celo Explorer",
                })}
              </span>
            </a>
          ) : funding.isError && !funding.snapshot ? (
            fundingStateMessage("unavailable", intl)
          ) : (
            formatMessage({
              id: "cockpit.garden.pool.funding.noSafe",
              defaultMessage: "No settlement Safe configured",
            })
          )}
        </dd>
      </dl>
      {protocolContext ? (
        <p className="rounded-[var(--m3-shape-sm)] bg-bg-soft p-3 body-sm text-text-sub">
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
