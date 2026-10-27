import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerExchangeQuote,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { NativeSelect, TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount, parseIssuerAmount } from "./serviceIssuerPresentation";

interface Props {
  asset: ServiceIssuerAsset;
  assets: readonly ServiceIssuerAsset[];
  disabled: boolean;
  onReview: (action: ServiceIssuerAction) => void;
  onQuote: (input: {
    outputAssetId: string;
    amount: bigint;
  }) => Promise<ServiceIssuerExchangeQuote>;
}

/**
 * A holder's exchange in the curated pool: quantity entry, separate from the exact review and
 * signing step. An issuer's own acts are named on their service instead.
 */
export function ServiceIssuerForm({ asset, assets, disabled, onReview, onQuote }: Props) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const id = useId();
  const [kind, setKind] = useState("approveExchange");
  const [amount, setAmount] = useState("");
  const [outputAssetId, setOutput] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: ServiceIssuerExchangeQuote } | null>(
    null
  );
  const [quoting, setQuoting] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputKey = `${asset.id}:${kind}:${amount}:${outputAssetId}`;
  const current = useRef(inputKey);
  current.current = inputKey;
  const value = parseIssuerAmount(amount, asset.decimals);
  const output = assets.find((a) => a.id === outputAssetId && a.id !== asset.id);
  const reviewedQuote = quote?.key === inputKey ? quote.value : null;
  const needsAmount = kind === "approveExchange" || kind === "exchange";
  const locked = disabled || quoting;
  const commands = ["approveExchange", "revokeExchange", "exchange"];
  const changed = () => {
    setQuote(null);
    setFailed(false);
  };
  const action = (): ServiceIssuerAction | null => {
    if (!commands.includes(kind)) return null;
    if (needsAmount && value === null) return null;
    switch (kind) {
      case "approveExchange":
        return { kind, amount: value! };
      case "revokeExchange":
        return { kind };
      case "exchange":
        return reviewedQuote && output
          ? {
              kind,
              outputAssetId: output.id,
              amount: value!,
              quotedOutput: reviewedQuote.quotedOutput,
              minimumOutput: reviewedQuote.quotedOutput,
              deadline: reviewedQuote.expiresAt,
            }
          : null;
      default:
        return null;
    }
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const prepared = action();
        if (!locked && prepared) onReview(prepared);
      }}
    >
      <label htmlFor={`${id}-action`} className="block space-y-1 text-sm">
        <span>{text("action")}</span>
        <NativeSelect
          id={`${id}-action`}
          value={kind}
          disabled={locked}
          onChange={(e) => {
            setKind(e.target.value);
            changed();
          }}
        >
          {commands.map((command) => (
            <option key={command} value={command}>
              {text(`actions.${command}`)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <p id={`${id}-help`} className="text-xs text-text-sub-600">
        {text("finiteHelp")}
      </p>
      {needsAmount ? (
        <label htmlFor={`${id}-amount`} className="block space-y-1 text-sm">
          <span>
            {text("amount")} ({asset.symbol})
          </span>
          <TextInput
            id={`${id}-amount`}
            value={amount}
            inputMode="decimal"
            required
            disabled={locked}
            aria-describedby={`${id}-help`}
            onChange={(e) => {
              setAmount(e.target.value);
              changed();
            }}
          />
        </label>
      ) : null}
      {kind === "exchange" ? (
        <>
          <label htmlFor={`${id}-output`} className="block space-y-1 text-sm">
            <span>{text("receiveAsset")}</span>
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
                    {a.name} ({a.symbol})
                  </option>
                ))}
            </NativeSelect>
          </label>
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
                if (current.current === key) setQuote({ key, value: result });
              } catch {
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
                {text("estimatedOutput")}:{" "}
                {issuerAmount(reviewedQuote.quotedOutput, output, locale)}
              </p>
              <p>
                {text("estimatedFees")}:{" "}
                {issuerAmount(reviewedQuote.reservedOutputFees, output, locale)}
              </p>
              <p>
                {text("minimum")}: {issuerAmount(reviewedQuote.quotedOutput, output, locale)}
              </p>
              <p>{text("exactOutput")}</p>
            </div>
          ) : null}
        </>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-error-base">
          {text("quoteFailed")}
        </p>
      ) : null}
      <Button type="submit" disabled={locked || action() === null}>
        {text("review")}
      </Button>
    </form>
  );
}
