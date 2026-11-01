import { Alert, type AlertVariant } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import {
  TxHoldFeedback,
  TxInlineFeedback,
} from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useCookieJarDeposit } from "@green-goods/shared/hooks/cookie-jar/useCookieJarDeposit";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useTxErrorMessages } from "@green-goods/shared/hooks/utils/useTxErrorMessages";
import { useDepositPlan } from "@green-goods/shared/hooks/vault/useVaultDeposit";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import {
  claimsToEmptyJar,
  formatClaimCadence,
  isJarClaimLimitLow,
} from "@green-goods/shared/utils/cookie-jar-claim-limit";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminTextField } from "@/components/AdminTextField";
import { type CookieJarReadState, resolveCookieJarReadState } from "./cookieJarReadState";

// Stands in for the form until a jar can be funded. Fund Cookie Jar can open this
// dialog before the jars are read, or for a garden whose jars can't be read.
const JAR_READ_NOTICES: Record<
  Exclude<CookieJarReadState, "ready">,
  { variant: AlertVariant; titleId?: string; bodyId: string }
> = {
  checking: { variant: "info", bodyId: "app.cookieJar.loading" },
  offline: {
    variant: "warning",
    titleId: "cockpit.community.payouts.jarsOffline.title",
    bodyId: "cockpit.community.payouts.jarsOffline.body",
  },
  failed: {
    variant: "error",
    titleId: "cockpit.community.payouts.jarsReadFailed.title",
    bodyId: "cockpit.community.payouts.jarsReadFailed.body",
  },
  "no-jar": {
    variant: "info",
    titleId: "app.cookieJar.noJars",
    bodyId: "cockpit.community.payouts.noJarHow",
  },
  unavailable: {
    variant: "info",
    titleId: "app.cookieJar.moduleNotConfigured",
    bodyId: "app.cookieJar.noJarsHint",
  },
};

interface CookieJarDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  defaultJarAddress?: Address | null;
  /** Leave the deposit and open this jar's per-claim limit editor instead. */
  onFixLimit?: (jarAddress: Address) => void;
}

export function CookieJarDepositModal({
  isOpen,
  onClose,
  gardenAddress,
  defaultJarAddress = null,
  onFixLimit,
}: CookieJarDepositModalProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();

  const jarRead = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress) && isOpen,
  });
  const { jars } = jarRead;
  const readState = resolveCookieJarReadState(jarRead);

  const depositMutation = useCookieJarDeposit(gardenAddress, { errorMode: "inline" });
  const resetDepositMutation = depositMutation.reset;

  const [depositJar, setDepositJar] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDepositJar(defaultJarAddress ?? "");
    setDepositAmount("");
    resetDepositMutation();
  }, [defaultJarAddress, isOpen, resetDepositMutation]);

  useEffect(() => {
    if (!isOpen || depositJar) return;
    if (defaultJarAddress && jars.some((jar) => jar.jarAddress === defaultJarAddress)) {
      setDepositJar(defaultJarAddress);
      return;
    }
    // Fund Cookie Jar names no jar: start on the garden's first, and the switcher can change it.
    if (jars.length > 0) {
      setDepositJar(jars[0].jarAddress);
    }
  }, [defaultJarAddress, depositJar, isOpen, jars]);

  // A jar whose decimals are unread or failed has a fallback in their place, which would misread
  // the amount.
  const selectedDepositJar = useMemo(
    () => (readState === "ready" ? jars.find((j) => j.jarAddress === depositJar) : undefined),
    [jars, depositJar, readState]
  );

  const depositDecimals = selectedDepositJar?.decimals ?? 18;

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedDepositJar?.assetAddress as Address | undefined,
    // This dialog stays mounted on every Community tab, so a closed one reads nothing.
    query: { enabled: isOpen && Boolean(primaryAddress && selectedDepositJar) },
  });

  const depositInputError = useMemo(
    () => validateDecimalInput(depositAmount, depositDecimals),
    [depositAmount, depositDecimals]
  );

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount.trim() || depositInputError) return 0n;
    try {
      return parseUnits(depositAmount, depositDecimals);
    } catch {
      return 0n;
    }
  }, [depositAmount, depositInputError, depositDecimals]);

  useEffect(() => {
    if (!depositMutation.error) return;
    resetDepositMutation();
  }, [depositAmount, depositJar, depositMutation.error, resetDepositMutation]);

  const depositTxError = useTxErrorMessages(depositMutation.error);
  const plan = useDepositPlan({
    target:
      selectedDepositJar && primaryAddress
        ? {
            kind: "jar",
            address: selectedDepositJar.jarAddress,
            asset: selectedDepositJar.assetAddress,
          }
        : null,
    amount: parsedDepositAmount,
    decimals: depositDecimals,
    symbol: selectedDepositJar
      ? getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined)
      : "",
    gardenAddress,
    enabled: isOpen,
    onLanded: () => {
      setDepositAmount("");
      resetDepositMutation();
    },
  });
  const showTxError =
    Boolean(depositMutation.error) &&
    !(plan.unconfirmedIsHeld && depositTxError.view.kind === "unconfirmed");

  const isPending = depositMutation.isPending;
  // Funding is the last moment before gardeners meet a limit set too low. It warns, never
  // blocks: the deposit still goes through, the fix is just the first thing offered.
  const lowLimitJar =
    onFixLimit && selectedDepositJar && isJarClaimLimitLow(selectedDepositJar)
      ? selectedDepositJar
      : null;
  const handleDeposit = () => {
    if (!selectedDepositJar || parsedDepositAmount <= 0n || plan.isPaused) return;
    depositMutation.mutate(
      {
        jarAddress: selectedDepositJar.jarAddress,
        amount: parsedDepositAmount,
        assetAddress: selectedDepositJar.assetAddress,
      },
      {
        onSuccess: () => {
          setDepositAmount("");
          onClose();
        },
      }
    );
  };

  const notice = readState === "ready" ? null : JAR_READ_NOTICES[readState];

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      // Workspace tone — mounted from the Community workspace and its payouts panel.
      tone="community"
      title={formatMessage({
        id: "app.cookieJar.depositModal.title",
        defaultMessage: "Fund Cookie Jar",
      })}
      description={formatMessage({
        id: "app.cookieJar.depositModal.description",
        defaultMessage: "Fund a jar from your connected wallet.",
      })}
      preventClose={isPending}
      actions={
        notice ? (
          <Button type="button" emphasis="tertiary" size="sm" onClick={onClose}>
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </Button>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <p className="mr-auto type-meta text-text-soft empty:hidden" aria-live="polite">
              {plan.signatureLine}
            </p>
            {lowLimitJar ? (
              <>
                <Button
                  type="button"
                  emphasis="secondary"
                  size="sm"
                  loading={isPending}
                  disabled={parsedDepositAmount <= 0n || plan.isPaused}
                  onClick={handleDeposit}
                >
                  {formatMessage({ id: "app.cookieJar.depositAnyway" })}
                </Button>
                <Button
                  size="sm"
                  type="button"
                  disabled={isPending}
                  onClick={() => onFixLimit?.(lowLimitJar.jarAddress)}
                >
                  {formatMessage({ id: "app.cookieJar.fixLimitFirst" })}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="sm"
                  onClick={onClose}
                  disabled={isPending}
                >
                  {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
                </Button>
                <Button
                  size="sm"
                  type="button"
                  loading={isPending}
                  disabled={!selectedDepositJar || parsedDepositAmount <= 0n || plan.isPaused}
                  onClick={handleDeposit}
                >
                  {formatMessage({ id: "app.cookieJar.deposit", defaultMessage: "Deposit" })}
                </Button>
              </>
            )}
          </div>
        )
      }
    >
      {notice ? (
        <Alert
          variant={notice.variant}
          title={notice.titleId ? formatMessage({ id: notice.titleId }) : undefined}
        >
          {formatMessage({ id: notice.bodyId })}
        </Alert>
      ) : (
        <div className="space-y-4">
          {plan.holdFeedback ? <TxHoldFeedback {...plan.holdFeedback} isBusy={isPending} /> : null}
          {/* Jar switcher — compact single-select between the garden's jars (e.g. DAI / WETH) */}
          {jars.length > 1 && (
            <AdminFieldGroup
              as="div"
              label={formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie jar" })}
            >
              <AdminChoiceGroup
                ariaLabel={formatMessage({
                  id: "app.cookieJar.title",
                  defaultMessage: "Cookie jar",
                })}
                columns={2}
                value={depositJar || null}
                onChange={setDepositJar}
                options={jars.map((jar) => {
                  const jarSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                  return {
                    value: jar.jarAddress,
                    label: jarSymbol,
                    description: `${formatTokenAmount(jar.balance, jar.decimals)} ${jarSymbol}`,
                  };
                })}
              />
            </AdminFieldGroup>
          )}

          {/* Amount in the jar — the prominent number for the selected jar */}
          {selectedDepositJar && (
            <div className="rounded-lg bg-bg-weak px-4 py-3">
              <p className="type-label-sm text-text-soft">
                {formatMessage({ id: "app.cookieJar.balance", defaultMessage: "Jar Balance" })}
              </p>
              <p className="mt-1 type-title-lg font-semibold tabular-nums text-text-strong">
                {formatTokenAmount(selectedDepositJar.balance, selectedDepositJar.decimals)}{" "}
                <span className="type-title-md font-medium text-text-sub">
                  {getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined)}
                </span>
              </p>
            </div>
          )}

          {/* Amount */}
          <AdminTextField
            id="deposit-amount"
            label={formatMessage({ id: "app.cookieJar.amount", defaultMessage: "How much" })}
            type="text"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.00"
            error={depositInputError ? formatMessage({ id: depositInputError }) : undefined}
            inputProps={{ inputMode: "decimal" }}
          />

          {/* Wallet balance */}
          <div className="space-y-1">
            <p className="type-meta text-text-soft">
              {formatMessage({
                id: "app.treasury.walletBalance",
                defaultMessage: "Wallet balance",
              })}
              :{" "}
              {walletBalance
                ? `${formatTokenAmount(walletBalance.value, walletBalance.decimals)} ${walletBalance.symbol}`
                : "--"}
            </p>
          </div>

          {lowLimitJar ? (
            <Alert
              variant="warning"
              title={formatMessage(
                { id: "app.cookieJar.depositLowLimit.title" },
                {
                  limit: formatTokenAmount(lowLimitJar.maxWithdrawal, lowLimitJar.decimals),
                  asset: getVaultAssetSymbol(lowLimitJar.assetAddress, undefined),
                }
              )}
            >
              {formatMessage(
                { id: "app.cookieJar.depositLowLimit.cadence" },
                { cadence: formatClaimCadence(formatMessage, lowLimitJar.withdrawalInterval) }
              )}
              {parsedDepositAmount > 0n
                ? ` ${formatMessage(
                    { id: "app.cookieJar.depositLowLimit.claims" },
                    {
                      amount: formatTokenAmount(parsedDepositAmount, lowLimitJar.decimals),
                      asset: getVaultAssetSymbol(lowLimitJar.assetAddress, undefined),
                      count: Number(
                        claimsToEmptyJar(parsedDepositAmount, lowLimitJar.maxWithdrawal)
                      ),
                    }
                  )}`
                : null}
            </Alert>
          ) : null}

          {/* Error feedback */}
          <TxInlineFeedback
            visible={showTxError}
            severity={depositTxError.view.severity}
            title={depositTxError.title}
            message={depositTxError.message}
            reserveClassName="min-h-[5.5rem]"
          />
        </div>
      )}
    </AdminDialog>
  );
}
