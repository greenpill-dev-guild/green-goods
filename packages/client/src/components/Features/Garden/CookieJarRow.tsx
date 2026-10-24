import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import {
  FormattedAmountInput,
  useFormattedAmountInput,
} from "@green-goods/shared/components/Form/FormattedAmountInput";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useCookieJarWithdraw } from "@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import {
  formatClaimCadence,
  isJarClaimLimitLow,
} from "@green-goods/shared/utils/cookie-jar-claim-limit";
import { RiCookieLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";

/** What a gardener can take right now: the per-claim cap, bounded by what the jar still holds. */
export function getClaimableNow(jar: CookieJar) {
  return jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
}

export interface CookieJarRowProps {
  jar: CookieJar;
  /** The garden the claim is recorded against. */
  gardenAddress: Address;
  /** Named in the claim's confirmation; the list's own heading or sheet already shows it. */
  gardenName: string;
  /**
   * The amount on the right: what the gardener can take now (the wallet, where a gardener
   * claims), or what the jar holds (a garden's endowment sheet).
   */
  amount: "claimable" | "balance";
}

/**
 * A garden's cookie jar as a gardener meets it, on the shared item row: the asset, the jar's
 * status, its per-claim limit, and an amount on the right, with no action on the row. The row
 * opens the jar's page beneath it: the limit with its cadence, what the jar holds, and the
 * claim form. A garden's jar only; campaign jars and the stipend jar are other things.
 */
export function CookieJarRow({ jar, gardenAddress, gardenName, amount }: CookieJarRowProps) {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const withdrawMutation = useCookieJarWithdraw(gardenAddress);
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const decimals = jar.decimals;
  const assetSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const claimableNow = getClaimableNow(jar);
  const panelId = `cookie-jar-claim-${jar.jarAddress.toLowerCase()}`;
  const amountState = useFormattedAmountInput(amountInput, decimals);
  const inputError = amountState.formatErrorId;
  const parsedAmount = amountState.parsedAmount ?? 0n;

  const executeWithdraw = () => {
    withdrawMutation.mutate(
      { jarAddress: jar.jarAddress, amount: parsedAmount, purpose },
      {
        onSuccess: () => {
          setAmountInput("");
          setPurpose("");
          setExpanded(false);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <ItemRow
        lead={{ kind: "icon", icon: <RiCookieLine /> }}
        title={assetSymbol}
        status={
          jar.isPaused
            ? { label: formatMessage({ id: "app.cookieJar.paused" }), tone: "warning" }
            : { label: formatMessage({ id: "app.cookieJar.active" }), tone: "success" }
        }
        details={[
          formatMessage(
            { id: "app.cookieJar.perClaim" },
            { amount: formatTokenAmount(jar.maxWithdrawal, decimals), asset: assetSymbol }
          ),
        ]}
        amount={
          amount === "claimable"
            ? {
                value: `${formatTokenAmount(claimableNow, decimals)} ${assetSymbol}`,
                caption: formatMessage({ id: "app.cookieJar.maxWithdrawal" }),
              }
            : {
                value: `${formatTokenAmount(jar.balance, decimals)} ${assetSymbol}`,
                caption: formatMessage({ id: "app.cookieJar.balance" }),
              }
        }
        onOpen={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
      />

      {expanded && (
        <div id={panelId} className="gg-card gg-item-row-page space-y-2 p-3">
          {/* The cadence and the holdings live on the jar's page, so the row keeps one detail. */}
          <p className="text-xs text-text-soft-400">
            {formatMessage(
              { id: "app.cookieJar.claimLimitSummary" },
              {
                amount: formatTokenAmount(jar.maxWithdrawal, decimals),
                asset: assetSymbol,
                cadence: formatClaimCadence(formatMessage, jar.withdrawalInterval),
              }
            )}
          </p>
          <p className="text-xs text-text-soft-400">
            {formatMessage(
              { id: "app.cookieJar.jarHolds" },
              { amount: formatTokenAmount(jar.balance, decimals), asset: assetSymbol }
            )}
          </p>
          {jar.isPaused ? (
            <p className="text-sm text-warning-dark">
              {formatMessage({ id: "app.cookieJar.paused" })}
            </p>
          ) : (
            <>
              {/* A message, not a button: only a steward who can sign for the garden can
                  raise the limit, and they see the same jar flagged in admin. Claiming the
                  allowed amount still works. */}
              {isJarClaimLimitLow(jar) ? (
                <Alert variant="info" className="p-3">
                  {formatMessage({ id: "app.cookieJar.claimLimitLowNotice" })}
                </Alert>
              ) : null}
              <FormattedAmountInput
                value={amountInput}
                onValueChange={setAmountInput}
                placeholder={formatMessage({ id: "app.cookieJar.amount" })}
                aria-label={formatMessage({ id: "app.cookieJar.amount" })}
                endSlot={
                  <Button
                    type="button"
                    emphasis="secondary"
                    onClick={() => setAmountInput(formatUnits(claimableNow, decimals))}
                  >
                    {formatMessage({ id: "app.treasury.max" })}
                  </Button>
                }
                errorClassName="mt-2 text-xs text-error-dark"
                error={inputError ? formatMessage({ id: inputError }) : null}
              />

              <div className="space-y-1">
                <label
                  htmlFor={`${panelId}-purpose`}
                  className="block text-xs font-medium text-text-sub-600"
                >
                  {formatMessage({ id: "app.cookieJar.purpose" })}{" "}
                  <span aria-hidden="true" className="text-error-dark">
                    *
                  </span>
                </label>
                <Textarea
                  id={`${panelId}-purpose`}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={formatMessage({ id: "app.cookieJar.purposePlaceholder" })}
                  required
                  aria-required="true"
                  className="resize-none"
                  rows={2}
                />
                <p className="text-xs text-text-soft-400">
                  {formatMessage({
                    id: "app.cookieJar.purposeHelp",
                    defaultMessage:
                      "Briefly say what this claim is for. It's recorded with the payout.",
                  })}
                </p>
              </div>

              {!isOnline ? (
                <p className="text-xs text-warning-dark" role="status">
                  {formatMessage({
                    id: "app.cookieJar.withdrawOffline",
                    defaultMessage: "Offline. Claims need a connection to reach the jar.",
                  })}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={() => setShowConfirm(true)}
                loading={withdrawMutation.isPending}
                disabled={
                  !withdrawMutation.isPending &&
                  (!isOnline ||
                    parsedAmount <= 0n ||
                    parsedAmount > jar.maxWithdrawal ||
                    parsedAmount > jar.balance ||
                    !purpose.trim())
                }
                className="w-full"
              >
                {formatMessage({ id: "app.cookieJar.withdraw" })}
              </Button>

              <ConfirmDialog
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                title={formatMessage({ id: "app.cookieJar.confirmWithdrawTitle" })}
                description={formatMessage(
                  { id: "app.cookieJar.confirmWithdrawDescription" },
                  {
                    amount: formatTokenAmount(parsedAmount, decimals),
                    asset: assetSymbol,
                    garden: gardenName,
                  }
                )}
                confirmLabel={formatMessage({ id: "app.cookieJar.withdraw" })}
                variant="warning"
                isLoading={withdrawMutation.isPending}
                onConfirm={() => {
                  setShowConfirm(false);
                  executeWithdraw();
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
