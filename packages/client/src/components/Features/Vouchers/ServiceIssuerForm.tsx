import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerExchangeQuote,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { NativeSelect, TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { logger } from "@green-goods/shared/modules/app/logger";
import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount, parseIssuerAmount } from "./serviceIssuerPresentation";

interface Props {
  asset: ServiceIssuerAsset;
  assets: readonly ServiceIssuerAsset[];
  disabled: boolean;
  poolId?: string;
  onReview: (action: ServiceIssuerAction) => void;
  onQuote: (input: {
    outputAssetId: string;
    amount: bigint;
  }) => Promise<ServiceIssuerExchangeQuote>;
}

/**
 * A holder's exchange in the curated pool: quantity entry, separate from the exact review and
 * signing step. The form opens on the exchange, the act a holder came for. The pool's permission
 * to spend their vouchers, which the exchange needs and the review asks for in its turn, waits
 * under Manage permission in plain words, for the holder who sets or takes it back themselves.
 * An issuer's own acts are named on their service instead.
 */
export function ServiceIssuerForm({ asset, assets, poolId, disabled, onReview, onQuote }: Props) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const vouchers = formatMessage({ id: "app.voucher.unitPlain" }, { count: 2 });
  const id = useId();
  const [amount, setAmount] = useState("");
  const [outputAssetId, setOutput] = useState("");
  const [allowance, setAllowance] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: ServiceIssuerExchangeQuote } | null>(
    null
  );
  const [quoting, setQuoting] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputKey = `${poolId}:${asset.id}:${amount}:${outputAssetId}`;
  // The key the inputs had when a quote was asked for, kept after each render commits, so a
  // quote that lands after the inputs changed is dropped and one for inputs still on screen kept.
  const current = useRef(inputKey);
  useEffect(() => {
    current.current = inputKey;
  }, [inputKey]);
  const value = parseIssuerAmount(amount, asset.decimals);
  const allowed = parseIssuerAmount(allowance, asset.decimals);
  const output = assets.find((a) => a.id === outputAssetId && a.id !== asset.id);
  const reviewedQuote = quote?.key === inputKey ? quote.value : null;
  const locked = disabled || quoting;
  const changed = () => {
    setQuote(null);
    setFailed(false);
  };
  const exchange = (): ServiceIssuerAction | null =>
    reviewedQuote && output && value !== null
      ? {
          kind: "exchange",
          outputAssetId: output.id,
          amount: value,
          quotedOutput: reviewedQuote.quotedOutput,
          minimumOutput: reviewedQuote.quotedOutput,
          deadline: reviewedQuote.expiresAt,
        }
      : null;
  return (
    <div className="space-y-3" data-component="ServiceIssuerForm">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const prepared = exchange();
          if (!locked && prepared) onReview(prepared);
        }}
      >
        <FormField
          label={`${text("amount")} (${vouchers})`}
          htmlFor={`${id}-amount`}
          hint={text("finiteHelp")}
        >
          <TextInput
            id={`${id}-amount`}
            value={amount}
            inputMode="decimal"
            required
            disabled={locked}
            onChange={(e) => {
              setAmount(e.target.value);
              changed();
            }}
          />
        </FormField>
        <FormField label={text("receiveAsset")} htmlFor={`${id}-output`}>
          <NativeSelect
            id={`${id}-output`}
            value={outputAssetId}
            disabled={locked}
            required
            onChange={(e) => {
              setOutput(e.target.value);
              changed();
            }}
          >
            <option value="">{text("chooseAsset")}</option>
            {assets
              .filter((a) => a.id !== asset.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </NativeSelect>
        </FormField>
        <Button
          type="button"
          emphasis="secondary"
          loading={quoting}
          disabled={disabled || value === null || !output}
          onClick={async () => {
            if (locked || value === null || !output) return;
            const key = inputKey;
            setQuoting(true);
            setFailed(false);
            setQuote(null);
            try {
              const result = await onQuote({ amount: value, outputAssetId: output.id });
              if (current.current === key && result.poolId === poolId)
                setQuote({ key, value: result });
              else if (current.current === key) setFailed(true);
            } catch (error) {
              // The failure is shown under the act and recorded; nothing was sent.
              logger.error("Exchange quote failed", { error, assetId: asset.id, poolId });
              if (current.current === key) setFailed(true);
            } finally {
              setQuoting(false);
            }
          }}
        >
          {text("getQuote")}
        </Button>
        {reviewedQuote && output ? (
          <div className="space-y-1 text-sm">
            <p>
              {text("estimatedOutput")}: {issuerAmount(reviewedQuote.quotedOutput, output, intl)}
            </p>
            <p>
              {text("estimatedFees")}:{" "}
              {issuerAmount(reviewedQuote.grossOutput - reviewedQuote.quotedOutput, output, intl)}
            </p>
            <p>
              {text("minimum")}: {issuerAmount(reviewedQuote.quotedOutput, output, intl)}
            </p>
            {"intermediateResidue" in reviewedQuote &&
            typeof reviewedQuote.intermediateResidue === "bigint" ? (
              <p>
                {formatMessage({ id: "app.voucher.exchange.residue" })}:{" "}
                {issuerAmount(reviewedQuote.intermediateResidue, asset, intl)}
              </p>
            ) : null}
            <p>{text("exactOutput")}</p>
          </div>
        ) : null}
        {failed ? (
          <p role="alert" className="text-sm text-error-base">
            {text("quoteFailed")}
          </p>
        ) : null}
        <Button type="submit" disabled={locked || exchange() === null}>
          {formatMessage({ id: "app.voucher.ex.a.review" })}
        </Button>
      </form>
      <details className="space-y-3 text-sm" data-component="ServiceIssuerPermission">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          {text("managePermission")}
        </summary>
        <p className="text-xs text-text-sub-600">{text("permissionHelp")}</p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked && allowed !== null) onReview({ kind: "approveExchange", amount: allowed });
          }}
        >
          <FormField label={`${text("allowUpTo")} (${vouchers})`} htmlFor={`${id}-allowance`}>
            <TextInput
              id={`${id}-allowance`}
              value={allowance}
              inputMode="decimal"
              required
              disabled={locked}
              onChange={(e) => setAllowance(e.target.value)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" emphasis="secondary" disabled={locked || allowed === null}>
              {text("reviewPermission")}
            </Button>
            <Button
              type="button"
              emphasis="secondary"
              disabled={locked}
              onClick={() => onReview({ kind: "revokeExchange" })}
            >
              {text("actions.revokeExchange")}
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
