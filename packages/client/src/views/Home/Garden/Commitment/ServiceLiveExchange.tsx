import {
  type ServiceIssuerExchangeChoice,
  useServiceIssuerOperations,
} from "@green-goods/shared/commitment-pooling";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount } from "@/components/Features/Vouchers/serviceIssuerPresentation";
import { ServiceIssuerPanel } from "@/components/Features/Vouchers/ServiceIssuerPanel";

/** Desired-service checkout: explicitly select the held voucher and exchange before any review. */
export function ServiceLiveExchange({
  choices,
  account,
  onClose,
  onRefresh,
}: {
  choices: readonly ServiceIssuerExchangeChoice[];
  account: Address;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const intl = useIntl();
  const [selection, setSelection] = useState("");
  const choice = choices.find((candidate) => candidate.key === selection);
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={intl.formatMessage({ id: "app.voucher.of.a.exchange" })}
      description={intl.formatMessage({ id: "app.voucher.ex.desc" })}
    >
      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span>{intl.formatMessage({ id: "app.voucher.exchange.pool" })}</span>
          <NativeSelect value={selection} onChange={(event) => setSelection(event.target.value)}>
            <option value="">
              {intl.formatMessage({ id: "app.voucher.exchange.choosePool" })}
            </option>
            {choices.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.input.symbol} → {candidate.output.symbol} · {candidate.poolName}
              </option>
            ))}
          </NativeSelect>
        </label>
        {choice ? (
          <p className="text-sm">
            {intl.formatMessage({ id: "app.voucher.exchange.receive" })}:{" "}
            {issuerAmount(choice.requiredOutput, choice.output, intl.locale)}
          </p>
        ) : null}
        {choice ? (
          <LiveExchangeSelection
            key={choice.key}
            choice={choice}
            account={account}
            onRefresh={onRefresh}
          />
        ) : null}
      </div>
    </DialogShell>
  );
}
function LiveExchangeSelection({
  choice,
  account,
  onRefresh,
}: {
  choice: ServiceIssuerExchangeChoice;
  account: Address;
  onRefresh: () => Promise<unknown>;
}) {
  const operations = useServiceIssuerOperations({
    address: account,
    routeId: choice.routeId,
    assetId: choice.input.id,
    poolId: choice.poolId,
  });
  return (
    <ServiceIssuerPanel
      holderOnly
      poolName={choice.poolName}
      snapshot={operations.snapshot.data}
      assets={[choice.input, choice.output]}
      isLoading={operations.snapshot.isLoading}
      isError={operations.snapshot.isError}
      onRefresh={async () => {
        await operations.snapshot.refetch();
        await onRefresh();
      }}
      onReview={operations.review.mutateAsync}
      onQuote={operations.quote.mutateAsync}
      onExecute={async (review) => {
        const outcome = await operations.execute.mutateAsync(review);
        if (outcome.status === "confirmed") await onRefresh();
        return outcome;
      }}
      onReconcile={async () => {
        const outcome = await operations.reconcile.mutateAsync();
        if (outcome?.status === "confirmed") await onRefresh();
        return outcome;
      }}
    />
  );
}
