import {
  prepareOctantVaultCardEndowFallbackPlan,
  type Address,
  type OctantVaultCardEndowFallbackPlan,
  type OctantVaultCampaignManifest,
  validateDecimalInput,
} from "@green-goods/shared";
import { type FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  readContract,
  type ThirdwebClient,
} from "thirdweb";
import { defineChain, ethereum } from "thirdweb/chains";
import {
  BuyWidget,
  ThirdwebProvider,
  useConnect,
  useSendAndConfirmTransaction,
} from "thirdweb/react";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets/in-app";
import { formatUnits, isAddress, parseUnits } from "viem";
import { EditorialKicker } from "@/components/Public/atoms";

function getThirdwebClientId(): string {
  return import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim() ?? "";
}

function getThirdwebChain(chainId: number) {
  return chainId === ethereum.id ? ethereum : defineChain(chainId);
}

function getAmountErrorMessage(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  validationKey: string | null,
  symbol: string
) {
  if (validationKey === "app.treasury.tooManyDecimals") {
    return formatMessage(
      {
        id: "public.vaults.walletEndow.amount.tooManyDecimals",
        defaultMessage: "Use fewer decimals for {symbol}.",
      },
      { symbol }
    );
  }

  if (validationKey) {
    return formatMessage({
      id: "public.vaults.walletEndow.amount.invalid",
      defaultMessage: "Enter a valid amount.",
    });
  }

  return null;
}

function formatProviderFlow(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  flow: OctantVaultCardEndowFallbackPlan["providerFlow"]
) {
  if (flow === "fund_recovered_wallet_then_user_authorized_deposit") {
    return formatMessage({
      id: "public.vaults.cardEndow.providerFlow.fundRecoveredWallet",
      defaultMessage: "Thirdweb card funds the recovered email wallet first.",
    });
  }

  return flow;
}

export interface CardEndowPanelProps {
  campaign: OctantVaultCampaignManifest;
  onClose: () => void;
}

export default function CardEndowPanel({ campaign, onClose }: CardEndowPanelProps) {
  const { formatMessage } = useIntl();
  const clientId = getThirdwebClientId();
  const client = useMemo<ThirdwebClient | null>(() => {
    if (!clientId) return null;
    return createThirdwebClient({ clientId });
  }, [clientId]);

  return (
    <aside
      className="mt-10 border border-primary-action bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6"
      aria-labelledby="public-vaults-card-endow-title"
      data-testid="vault-card-endow-panel"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.cardEndow.kicker",
              defaultMessage: "Card Endow QA",
            })}
          </EditorialKicker>
          <h3
            id="public-vaults-card-endow-title"
            className="font-serif text-2xl font-normal leading-[1.08] text-text-strong-950"
          >
            {formatMessage({
              id: "public.vaults.cardEndow.title",
              defaultMessage: "Recover an email wallet before card funding",
            })}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-[1.65] text-text-sub-600">
            {formatMessage(
              {
                id: "public.vaults.cardEndow.body",
                defaultMessage:
                  "This QA flow creates or recovers a user-owned Thirdweb email wallet, funds that wallet by card, then asks that same wallet to approve and deposit into {campaign}.",
              },
              { campaign: campaign.displayName }
            )}
          </p>
        </div>
        <button
          type="button"
          className="w-fit rounded-full border border-stroke-soft-200 px-4 py-2 text-sm font-medium text-text-sub-600 transition-colors hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
          onClick={onClose}
        >
          {formatMessage({ id: "public.vaults.walletEndow.close", defaultMessage: "Close" })}
        </button>
      </div>

      {client ? (
        <ThirdwebProvider>
          <CardEndowProviderContent campaign={campaign} client={client} />
        </ThirdwebProvider>
      ) : (
        <p
          role="alert"
          className="mt-6 rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base"
        >
          {formatMessage({
            id: "public.vaults.cardEndow.missingClientId",
            defaultMessage:
              "Thirdweb email wallet QA requires VITE_THIRDWEB_CLIENT_ID before starting the client.",
          })}
        </p>
      )}
    </aside>
  );
}

function CardEndowProviderContent({
  campaign,
  client,
}: {
  campaign: OctantVaultCampaignManifest;
  client: ThirdwebClient;
}) {
  const { formatMessage } = useIntl();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const emailInputId = useId();
  const otpInputId = useId();
  const tupleConfirmId = useId();
  const [amountInput, setAmountInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [recoveredWalletAddress, setRecoveredWalletAddress] = useState<Address | null>(null);
  const [tupleConfirmed, setTupleConfirmed] = useState(false);
  const [cardFundingStatus, setCardFundingStatus] = useState<"idle" | "funded">("idle");
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "approved">("idle");
  const [depositStatus, setDepositStatus] = useState<"idle" | "deposited">("idle");
  const [shareBalance, setShareBalance] = useState<bigint | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const { connect, error: connectError, isConnecting } = useConnect();
  const sendAndConfirmTransaction = useSendAndConfirmTransaction({ payModal: false });
  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const validationKey = validateDecimalInput(amountInput, decimals);
  const amountError = getAmountErrorMessage(formatMessage, validationKey, symbol);
  const parsedAmount = useMemo(() => {
    const trimmed = amountInput.trim();
    if (!trimmed || validationKey) return null;

    try {
      return parseUnits(trimmed, decimals);
    } catch {
      return null;
    }
  }, [amountInput, decimals, validationKey]);
  const hasReadyAmount = typeof parsedAmount === "bigint" && parsedAmount > 0n;
  const formattedAmount = hasReadyAmount ? formatUnits(parsedAmount, decimals) : "";
  const chainId = campaign.vault?.chainId ?? ethereum.id;
  const chain = useMemo(() => getThirdwebChain(chainId), [chainId]);
  const buyWidgetWallets = useMemo(
    () => [
      inAppWallet({
        auth: { options: ["email"] },
        metadata: { name: "Green Goods" },
      }),
    ],
    []
  );
  const receiverAddress =
    recoveredWalletAddress && isAddress(recoveredWalletAddress) ? recoveredWalletAddress : null;
  const fallbackPreparation = useMemo(() => {
    if (!hasReadyAmount || !receiverAddress || !parsedAmount) return null;

    return prepareOctantVaultCardEndowFallbackPlan({
      campaign,
      amount: parsedAmount.toString(),
      receiverAddress,
    });
  }, [campaign, hasReadyAmount, parsedAmount, receiverAddress]);
  const plan = fallbackPreparation?.status === "ready" ? fallbackPreparation.plan : undefined;
  const canSendEmailCode =
    Boolean(client) && hasReadyAmount && emailInput.trim().includes("@") && !otpSent;
  const canVerifyEmailWallet =
    Boolean(client) &&
    hasReadyAmount &&
    otpSent &&
    emailInput.trim().includes("@") &&
    otpInput.trim().length > 0;
  const canRenderCardFunding = Boolean(plan && tupleConfirmed);
  const canAuthorizeApproval = Boolean(plan && cardFundingStatus === "funded");
  const canAuthorizeDeposit = Boolean(plan && approvalStatus === "approved");
  const hasPositiveShares = shareBalance !== null && shareBalance > 0n;

  useEffect(() => {
    setAmountInput("");
    setEmailInput("");
    setOtpInput("");
    setOtpSent(false);
    setRecoveredWalletAddress(null);
    setTupleConfirmed(false);
    setCardFundingStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setShareBalance(null);
    setFlowError(null);
  }, [campaign.slug]);

  useEffect(() => {
    setTupleConfirmed(false);
    setCardFundingStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setShareBalance(null);
  }, [amountInput, recoveredWalletAddress]);

  const handleSendEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSendEmailCode) return;

      setFlowError(null);
      try {
        await preAuthenticate({
          client,
          strategy: "email",
          email: emailInput.trim(),
        });
        setOtpSent(true);
      } catch (error) {
        setFlowError(error instanceof Error ? error.message : "Thirdweb email code failed.");
      }
    },
    [canSendEmailCode, client, emailInput]
  );

  const handleVerifyEmailWallet = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canVerifyEmailWallet) return;

      setFlowError(null);
      try {
        await connect(async () => {
          const wallet = inAppWallet({
            auth: { options: ["email"] },
            metadata: { name: "Green Goods" },
          });
          const account = await wallet.connect({
            client,
            chain,
            strategy: "email",
            email: emailInput.trim(),
            verificationCode: otpInput.trim(),
          });

          setRecoveredWalletAddress(account.address);
          return wallet;
        });
      } catch (error) {
        setFlowError(error instanceof Error ? error.message : "Thirdweb email wallet failed.");
      }
    },
    [canVerifyEmailWallet, chain, client, connect, emailInput, otpInput]
  );

  const readShareBalance = useCallback(async () => {
    if (!plan) return;

    const vaultContract = getContract({
      client,
      chain,
      address: plan.receiptExpectation.expectedVaultAddress,
    });
    const result = await readContract({
      contract: vaultContract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [plan.receiptExpectation.receiverAddress],
    });
    const shares = typeof result === "bigint" ? result : BigInt(String(result ?? "0"));
    setShareBalance(shares);
  }, [chain, client, plan]);

  const handleApprove = useCallback(async () => {
    if (!plan || !canAuthorizeApproval) return;

    setFlowError(null);
    try {
      const tokenContract = getContract({
        client,
        chain,
        address: plan.cardFunding.tokenAddress,
      });
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 value)",
        params: [plan.receiptExpectation.expectedVaultAddress, BigInt(plan.cardFunding.amount)],
      });

      await sendAndConfirmTransaction.mutateAsync(transaction);
      setApprovalStatus("approved");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "Token approval failed.");
    }
  }, [canAuthorizeApproval, chain, client, plan, sendAndConfirmTransaction]);

  const handleDeposit = useCallback(async () => {
    if (!plan || !canAuthorizeDeposit) return;

    setFlowError(null);
    try {
      const vaultContract = getContract({
        client,
        chain,
        address: plan.receiptExpectation.expectedVaultAddress,
      });
      const transaction = prepareContractCall({
        contract: vaultContract,
        method: "function deposit(uint256 assets, address receiver) returns (uint256)",
        params: [BigInt(plan.cardFunding.amount), plan.receiptExpectation.receiverAddress],
      });

      await sendAndConfirmTransaction.mutateAsync(transaction);
      setDepositStatus("deposited");
      await readShareBalance();
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "Vault deposit failed.");
    }
  }, [canAuthorizeDeposit, chain, client, plan, readShareBalance, sendAndConfirmTransaction]);

  return (
    <div className="mt-6 grid gap-6">
      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSendEmailCode}>
        <div>
          <label
            htmlFor={amountInputId}
            className="block font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.walletEndow.amountLabel",
              defaultMessage: "Amount",
            })}
          </label>
          <p id={amountHelpId} className="mt-2 text-sm leading-[1.5] text-text-sub-600">
            {formatMessage(
              {
                id: "public.vaults.walletEndow.amountHelp",
                defaultMessage: "Enter an amount in {symbol}.",
              },
              { symbol }
            )}
          </p>
          <input
            id={amountInputId}
            value={amountInput}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={amountError ? `${amountHelpId} ${amountErrorId}` : amountHelpId}
            aria-invalid={Boolean(amountError)}
            className="mt-3 w-full rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-3 text-base text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action focus:ring-2 focus:ring-primary-action/20"
            placeholder="0.00"
            onChange={(event) => setAmountInput(event.target.value)}
          />
          {amountError ? (
            <p id={amountErrorId} className="mt-2 text-sm leading-[1.5] text-error-base">
              {amountError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={emailInputId}
            className="block font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({ id: "public.vaults.cardEndow.emailLabel", defaultMessage: "Email" })}
          </label>
          <p className="mt-2 text-sm leading-[1.5] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.emailHelp",
              defaultMessage: "Thirdweb sends a verification code to recover the embedded wallet.",
            })}
          </p>
          <input
            id={emailInputId}
            value={emailInput}
            type="email"
            autoComplete="email"
            className="mt-3 w-full rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-3 text-base text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action focus:ring-2 focus:ring-primary-action/20"
            placeholder="qa@example.org"
            onChange={(event) => setEmailInput(event.target.value)}
          />
          <button
            type="submit"
            disabled={!canSendEmailCode}
            className="mt-3 min-h-12 rounded-full bg-text-strong-950 px-6 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.cardEndow.sendCode",
              defaultMessage: "Send email code",
            })}
          </button>
        </div>
      </form>

      <form
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={handleVerifyEmailWallet}
      >
        <div>
          <label
            htmlFor={otpInputId}
            className="block font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.cardEndow.otpLabel",
              defaultMessage: "Thirdweb code",
            })}
          </label>
          <input
            id={otpInputId}
            value={otpInput}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={!otpSent}
            className="mt-3 w-full rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-3 text-base text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 disabled:cursor-not-allowed disabled:text-text-soft-400 focus:border-primary-action focus:ring-2 focus:ring-primary-action/20"
            placeholder="123456"
            onChange={(event) => setOtpInput(event.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={!canVerifyEmailWallet || isConnecting}
          className="min-h-12 self-end rounded-full bg-text-strong-950 px-6 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.cardEndow.verifyWallet",
            defaultMessage: "Verify email wallet",
          })}
        </button>
      </form>

      {connectError ? (
        <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {connectError.message}
        </p>
      ) : null}

      {plan ? (
        <section
          className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-4"
          aria-labelledby="public-vaults-card-endow-tuple-title"
          data-testid="vault-card-endow-tuple"
        >
          <h4
            id="public-vaults-card-endow-tuple-title"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.cardEndow.tupleTitle",
              defaultMessage: "Exact Card Endow tuple",
            })}
          </h4>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleCampaign",
                  defaultMessage: "Campaign",
                })}
              </dt>
              <dd className="break-words text-text-sub-600">{campaign.displayName}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleReceiver",
                  defaultMessage: "Receiver wallet",
                })}
              </dt>
              <dd className="break-all font-mono text-xs text-text-sub-600">
                {plan.receiptExpectation.receiverAddress}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleChain",
                  defaultMessage: "Chain",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.vaults.cardEndow.chainValue",
                    defaultMessage: "Ethereum chain {chainId}",
                  },
                  { chainId: plan.cardFunding.chainId }
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleVault",
                  defaultMessage: "Vault",
                })}
              </dt>
              <dd className="break-all font-mono text-xs text-text-sub-600">
                {plan.receiptExpectation.expectedVaultAddress}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleToken",
                  defaultMessage: "Token",
                })}
              </dt>
              <dd className="break-all text-text-sub-600">
                {plan.cardFunding.tokenSymbol} · {plan.cardFunding.tokenAddress}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleAmount",
                  defaultMessage: "Amount",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formattedAmount} {plan.cardFunding.tokenSymbol} ({plan.cardFunding.amount} base
                units)
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleProviderRoute",
                  defaultMessage: "Provider route",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formatProviderFlow(formatMessage, plan.providerFlow)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-sm leading-[1.6] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.authorizationOrder",
              defaultMessage:
                "After provider funding succeeds, this wallet must approve token -> vault, then deposit amount -> receiver.",
            })}
          </p>
          <p className="mt-2 text-sm leading-[1.6] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.shareProof",
              defaultMessage:
                "Success is verified only by reading vault.balanceOf(receiver) and confirming positive shares.",
            })}
          </p>
          <label
            htmlFor={tupleConfirmId}
            className="mt-5 flex gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm leading-[1.5] text-text-sub-600"
          >
            <input
              id={tupleConfirmId}
              type="checkbox"
              className="mt-1 size-4 rounded border-stroke-soft-200 text-primary-action focus:ring-primary-action"
              checked={tupleConfirmed}
              onChange={(event) => setTupleConfirmed(event.target.checked)}
            />
            <span>
              {formatMessage({
                id: "public.vaults.cardEndow.confirmTuple",
                defaultMessage:
                  "I confirm this exact campaign, chain, vault, token, amount, receiver, and provider route before live card payment.",
              })}
            </span>
          </label>
        </section>
      ) : receiverAddress ? (
        <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {formatMessage({
            id: "public.vaults.cardEndow.planBlocked",
            defaultMessage:
              "Card Endow fallback plan is blocked. Confirm the campaign manifest, amount, and recovered wallet address.",
          })}
        </p>
      ) : null}

      {canRenderCardFunding && plan ? (
        <section
          className="grid gap-4 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4"
          aria-label={formatMessage({
            id: "public.vaults.cardEndow.cardFundingRegion",
            defaultMessage: "Thirdweb card funding",
          })}
        >
          <div data-testid="vault-card-endow-buy-widget-host">
            <BuyWidget
              client={client}
              chain={chain}
              tokenAddress={plan.cardFunding.tokenAddress}
              amount={formatUnits(BigInt(plan.cardFunding.amount), plan.cardFunding.tokenDecimals)}
              receiverAddress={plan.cardFunding.destinationAddress}
              paymentMethods={["card"]}
              amountEditable={false}
              tokenEditable={false}
              connectOptions={{ wallets: buyWidgetWallets, autoConnect: false, chain }}
              theme="light"
              title={formatMessage({
                id: "public.vaults.cardEndow.buyWidgetTitle",
                defaultMessage: "Fund recovered email wallet",
              })}
              description={formatMessage({
                id: "public.vaults.cardEndow.buyWidgetDescription",
                defaultMessage:
                  "Thirdweb may show required card, provider, and compliance steps. Funds must land in the recovered receiver wallet.",
              })}
              buttonLabel={formatMessage({
                id: "public.vaults.cardEndow.buyWidgetButton",
                defaultMessage: "Fund wallet by card",
              })}
              purchaseData={{
                intent: "octant_vault_card_endow",
                route: "/vaults",
                campaignSlug: campaign.slug,
                vaultAddress: plan.receiptExpectation.expectedVaultAddress,
                tokenAddress: plan.receiptExpectation.expectedTokenAddress,
                receiverAddress: plan.receiptExpectation.receiverAddress,
                amount: plan.receiptExpectation.expectedAmount,
              }}
              onSuccess={() => setCardFundingStatus("funded")}
              onError={(error) => setFlowError(error.message)}
            />
          </div>
          {cardFundingStatus === "funded" ? (
            <p className="rounded-2xl bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
              {formatMessage({
                id: "public.vaults.cardEndow.cardFunded",
                defaultMessage:
                  "Thirdweb reported card funding success for the recovered wallet. The user can now approve the vault allowance.",
              })}
            </p>
          ) : null}
        </section>
      ) : plan ? (
        <p className="rounded-2xl bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.cardEndow.cardLocked",
            defaultMessage:
              "Live card payment stays locked until the exact tuple confirmation is checked.",
          })}
        </p>
      ) : null}

      {plan ? (
        <section className="grid gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4 sm:grid-cols-3">
          <button
            type="button"
            disabled={!canAuthorizeApproval || sendAndConfirmTransaction.isPending}
            className="min-h-12 rounded-full bg-text-strong-950 px-5 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
            onClick={handleApprove}
          >
            {approvalStatus === "approved"
              ? formatMessage({
                  id: "public.vaults.cardEndow.approved",
                  defaultMessage: "Approval confirmed",
                })
              : formatMessage({
                  id: "public.vaults.cardEndow.approve",
                  defaultMessage: "Approve token -> vault",
                })}
          </button>
          <button
            type="button"
            disabled={!canAuthorizeDeposit || sendAndConfirmTransaction.isPending}
            className="min-h-12 rounded-full bg-text-strong-950 px-5 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
            onClick={handleDeposit}
          >
            {depositStatus === "deposited"
              ? formatMessage({
                  id: "public.vaults.cardEndow.deposited",
                  defaultMessage: "Deposit confirmed",
                })
              : formatMessage({
                  id: "public.vaults.cardEndow.deposit",
                  defaultMessage: "Deposit to receiver",
                })}
          </button>
          <button
            type="button"
            disabled={depositStatus !== "deposited"}
            className="min-h-12 rounded-full border border-stroke-soft-200 px-5 py-3 text-sm font-semibold text-text-sub-600 transition-colors hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
            onClick={readShareBalance}
          >
            {formatMessage({
              id: "public.vaults.cardEndow.readShares",
              defaultMessage: "Read vault shares",
            })}
          </button>
        </section>
      ) : null}

      {hasPositiveShares ? (
        <p className="rounded-2xl bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
          {formatMessage(
            {
              id: "public.vaults.cardEndow.positiveShares",
              defaultMessage:
                "Verified positive vault.balanceOf(receiver): {shares} shares are visible for the recovered wallet.",
            },
            { shares: shareBalance?.toString() ?? "0" }
          )}
        </p>
      ) : shareBalance !== null ? (
        <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {formatMessage({
            id: "public.vaults.cardEndow.noShares",
            defaultMessage: "vault.balanceOf(receiver) did not return positive shares.",
          })}
        </p>
      ) : null}

      {flowError ? (
        <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {flowError}
        </p>
      ) : null}
    </div>
  );
}
