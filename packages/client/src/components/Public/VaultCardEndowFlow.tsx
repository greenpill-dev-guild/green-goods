import {
  buildPublicFundingAvailabilityKey,
  PUBLIC_AGENT_ROUTES,
  type SubmitFundingIntentProofResponse,
} from "@green-goods/shared/public-contracts";
import {
  prepareOctantVaultCardEndowFallbackPlan,
  type Address,
  type OctantVaultCardEndowFallbackPlan,
  type OctantVaultCampaignManifest,
} from "@green-goods/shared";
import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { formatUnits, isAddress } from "viem";
import type { VaultCheckoutGuardState } from "./VaultCheckoutDialog";

function getAgentApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "";
}

function getThirdwebClientId(): string {
  return import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim() ?? "";
}

function getThirdwebChain(chainId: number) {
  return chainId === ethereum.id ? ethereum : defineChain(chainId);
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

function getTransactionHash(result: unknown): `0x${string}` | null {
  if (!result || typeof result !== "object") return null;
  const candidate = (result as { transactionHash?: unknown }).transactionHash;
  return typeof candidate === "string" && candidate.startsWith("0x")
    ? (candidate as `0x${string}`)
    : null;
}

export interface VaultCardEndowFlowProps {
  campaign: OctantVaultCampaignManifest;
  /** Base-unit amount selected in the checkout dialog before the card path opens. */
  amount: bigint;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}

/**
 * VaultCardEndowFlow — the Card payment path for the /vaults checkout dialog.
 *
 * The dialog owns the modal shell, the amount-first step, and the Card/Wallet
 * method choice; this component is mounted (lazily) only once a valid amount
 * exists and the user has chosen Card. It keeps every Card Endow safety gate:
 * email-wallet recovery first, exact-tuple confirmation before the Thirdweb
 * BuyWidget, strict approve -> deposit ordering, and proof only after a positive
 * `vault.balanceOf(receiver)` read.
 */
export default function VaultCardEndowFlow({
  campaign,
  amount,
  onCheckoutGuardChange,
}: VaultCardEndowFlowProps) {
  const { formatMessage } = useIntl();
  const clientId = getThirdwebClientId();
  const client = useMemo<ThirdwebClient | null>(() => {
    if (!clientId) return null;
    return createThirdwebClient({ clientId });
  }, [clientId]);

  if (!client) {
    return (
      <p
        role="alert"
        className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base"
      >
        {formatMessage({
          id: "public.vaults.cardEndow.missingClientId",
          defaultMessage:
            "Thirdweb email wallet recovery requires VITE_THIRDWEB_CLIENT_ID before starting the client.",
        })}
      </p>
    );
  }

  return (
    <ThirdwebProvider>
      <CardEndowProviderContent
        campaign={campaign}
        amount={amount}
        client={client}
        onCheckoutGuardChange={onCheckoutGuardChange}
      />
    </ThirdwebProvider>
  );
}

function CardEndowProviderContent({
  campaign,
  amount,
  client,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  client: ThirdwebClient;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  const { formatMessage } = useIntl();
  const emailInputId = useId();
  const otpInputId = useId();
  const tupleConfirmId = useId();
  const [emailInput, setEmailInput] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [recoveredWalletAddress, setRecoveredWalletAddress] = useState<Address | null>(null);
  const [tupleConfirmed, setTupleConfirmed] = useState(false);
  const [cardFundingStatus, setCardFundingStatus] = useState<"idle" | "funded">("idle");
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "pending" | "approved">("idle");
  const [depositStatus, setDepositStatus] = useState<"idle" | "pending" | "deposited">("idle");
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);
  const [shareBalance, setShareBalance] = useState<bigint | null>(null);
  const [proofStatus, setProofStatus] = useState<"idle" | "submitting" | "recorded" | "error">(
    "idle"
  );
  const [proofError, setProofError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const { connect, error: connectError, isConnecting } = useConnect();
  const sendAndConfirmTransaction = useSendAndConfirmTransaction({ payModal: false });
  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const hasReadyAmount = amount > 0n;
  const formattedAmount = hasReadyAmount ? formatUnits(amount, decimals) : "";
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
  const flowKey = `${campaign.slug}:${amount.toString()}:${receiverAddress ?? ""}`;
  const flowKeyRef = useRef(flowKey);
  flowKeyRef.current = flowKey;
  const isCurrentFlow = useCallback((candidate: string) => flowKeyRef.current === candidate, []);
  const fallbackPreparation = useMemo(() => {
    if (!hasReadyAmount || !receiverAddress) return null;

    return prepareOctantVaultCardEndowFallbackPlan({
      campaign,
      amount: amount.toString(),
      receiverAddress,
    });
  }, [campaign, hasReadyAmount, amount, receiverAddress]);
  const plan = fallbackPreparation?.status === "ready" ? fallbackPreparation.plan : undefined;
  const canSendEmailCode =
    Boolean(client) && hasReadyAmount && emailInput.trim().includes("@") && !otpSent;
  const canVerifyEmailWallet =
    Boolean(client) &&
    hasReadyAmount &&
    otpSent &&
    otpEmail === emailInput.trim() &&
    emailInput.trim().includes("@") &&
    otpInput.trim().length > 0;
  const canRenderCardFunding = Boolean(plan && tupleConfirmed);
  const canAuthorizeApproval = Boolean(
    plan && tupleConfirmed && cardFundingStatus === "funded" && approvalStatus === "idle"
  );
  const canAuthorizeDeposit = Boolean(
    plan &&
      tupleConfirmed &&
      cardFundingStatus === "funded" &&
      approvalStatus === "approved" &&
      depositStatus === "idle"
  );
  const hasPositiveShares = shareBalance !== null && shareBalance > 0n;
  const valuePathStarted =
    cardFundingStatus === "funded" ||
    approvalStatus !== "idle" ||
    depositStatus !== "idle" ||
    depositTxHash !== null ||
    shareBalance !== null ||
    proofStatus !== "idle";
  const cardPaymentVisible = Boolean(plan && tupleConfirmed);
  const transactionPending =
    approvalStatus === "pending" ||
    depositStatus === "pending" ||
    proofStatus === "submitting" ||
    sendAndConfirmTransaction.isPending;
  const checkoutInputsLocked = Boolean(
    cardPaymentVisible || valuePathStarted || transactionPending
  );

  // Switching campaign (a fresh checkout) clears every Card Endow gate.
  useEffect(() => {
    setEmailInput("");
    setOtpEmail(null);
    setVerifiedEmail(null);
    setOtpInput("");
    setOtpSent(false);
    setRecoveredWalletAddress(null);
    setTupleConfirmed(false);
    setCardFundingStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setDepositTxHash(null);
    setShareBalance(null);
    setProofStatus("idle");
    setProofError(null);
    setFlowError(null);
  }, [campaign.slug]);

  // A changed amount or recovered wallet invalidates downstream proof gates, but
  // never the email/recovered-wallet inputs themselves — inline errors only set
  // `flowError`, so a failed step keeps the user's progress intact.
  useEffect(() => {
    setTupleConfirmed(false);
    setCardFundingStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setDepositTxHash(null);
    setShareBalance(null);
    setProofStatus("idle");
    setProofError(null);
    setFlowError(null);
  }, [amount, recoveredWalletAddress]);

  useEffect(() => {
    onCheckoutGuardChange({
      inputsLocked: checkoutInputsLocked,
      closeLocked: transactionPending,
    });
    return () =>
      onCheckoutGuardChange({
        inputsLocked: false,
        closeLocked: false,
      });
  }, [checkoutInputsLocked, onCheckoutGuardChange, transactionPending]);

  const resetRecoveredWalletFlow = useCallback(() => {
    setOtpInput("");
    setOtpSent(false);
    setOtpEmail(null);
    setVerifiedEmail(null);
    setRecoveredWalletAddress(null);
    setTupleConfirmed(false);
    setCardFundingStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setDepositTxHash(null);
    setShareBalance(null);
    setProofStatus("idle");
    setProofError(null);
    setFlowError(null);
  }, []);

  const handleEmailInputChange = useCallback(
    (nextEmail: string) => {
      setEmailInput(nextEmail);
      setFlowError(null);
      if (
        otpSent ||
        otpEmail !== null ||
        verifiedEmail !== null ||
        recoveredWalletAddress !== null
      ) {
        resetRecoveredWalletFlow();
      }
    },
    [otpEmail, otpSent, recoveredWalletAddress, resetRecoveredWalletFlow, verifiedEmail]
  );

  const handleSendEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSendEmailCode) return;

      const email = emailInput.trim();
      setFlowError(null);
      try {
        await preAuthenticate({
          client,
          strategy: "email",
          email,
        });
        setOtpInput("");
        setOtpEmail(email);
        setVerifiedEmail(null);
        setRecoveredWalletAddress(null);
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

      const email = emailInput.trim();
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
            email,
            verificationCode: otpInput.trim(),
          });

          setRecoveredWalletAddress(account.address);
          setVerifiedEmail(email);
          return wallet;
        });
      } catch (error) {
        setFlowError(error instanceof Error ? error.message : "Thirdweb email wallet failed.");
      }
    },
    [canVerifyEmailWallet, chain, client, connect, emailInput, otpInput]
  );

  const readShareBalance = useCallback(
    async (expectedFlowKey = flowKey): Promise<bigint | null> => {
      if (!plan) return null;

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
      if (!isCurrentFlow(expectedFlowKey)) return null;
      setShareBalance(shares);
      return shares;
    },
    [chain, client, flowKey, isCurrentFlow, plan]
  );

  const submitFundingProof = useCallback(
    async (transactionHash: `0x${string}`, shares: bigint, expectedFlowKey = flowKey) => {
      if (!plan || !campaign.vault?.asset || shares <= 0n || !isCurrentFlow(expectedFlowKey)) {
        return;
      }

      setProofStatus("submitting");
      setProofError(null);
      const availabilityKey = buildPublicFundingAvailabilityKey({
        gardenKey: campaign.slug,
        destinationType: "vault",
        destinationAddress: plan.receiptExpectation.expectedVaultAddress,
        fundingIntent: "endow",
        paymentMethod: "card",
        chainId: plan.cardFunding.chainId,
        token: plan.receiptExpectation.expectedTokenAddress,
        provider: "thirdweb",
        sourceRoute: "/vaults",
      });

      try {
        const response = await fetch(
          `${getAgentApiBaseUrl()}${PUBLIC_AGENT_ROUTES.fundingIntentProof}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              gardenId: campaign.slug,
              gardenName: campaign.displayName,
              destinationType: "vault",
              destinationAddress: plan.receiptExpectation.expectedVaultAddress,
              fundingIntent: "endow",
              paymentMethod: "card",
              provider: "thirdweb",
              sourceRoute: "/vaults",
              chainId: plan.cardFunding.chainId,
              token: plan.receiptExpectation.expectedTokenAddress,
              availabilityKey,
              clientRequestId: [
                "card-endow-proof",
                campaign.slug,
                plan.receiptExpectation.receiverAddress,
                transactionHash,
              ].join(":"),
              receiverAddress: plan.receiptExpectation.receiverAddress,
              receiverCustody: "user_owned_recovered_wallet",
              amount: plan.receiptExpectation.expectedAmount,
              transactionHash,
              shareBalance: shares.toString(),
              payerEmail: verifiedEmail ?? undefined,
              locale: "en",
            }),
          }
        );
        const json = (await response.json()) as SubmitFundingIntentProofResponse;
        if (!response.ok || !("ok" in json) || !json.ok) {
          throw new Error(
            "message" in json ? json.message : "Funding proof could not be recorded."
          );
        }
        if (isCurrentFlow(expectedFlowKey)) setProofStatus("recorded");
      } catch (error) {
        if (!isCurrentFlow(expectedFlowKey)) return;
        setProofStatus("error");
        setProofError(
          error instanceof Error ? error.message : "Funding proof could not be recorded."
        );
      }
    },
    [
      campaign.displayName,
      campaign.slug,
      campaign.vault?.asset,
      flowKey,
      isCurrentFlow,
      plan,
      verifiedEmail,
    ]
  );

  const handleApprove = useCallback(async () => {
    if (!plan || !canAuthorizeApproval) return;

    const expectedFlowKey = flowKey;
    setFlowError(null);
    setApprovalStatus("pending");
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
      if (isCurrentFlow(expectedFlowKey)) setApprovalStatus("approved");
    } catch (error) {
      if (!isCurrentFlow(expectedFlowKey)) return;
      setApprovalStatus("idle");
      setFlowError(error instanceof Error ? error.message : "Token approval failed.");
    }
  }, [
    canAuthorizeApproval,
    chain,
    client,
    flowKey,
    isCurrentFlow,
    plan,
    sendAndConfirmTransaction,
  ]);

  const handleDeposit = useCallback(async () => {
    if (!plan || !canAuthorizeDeposit) return;

    const expectedFlowKey = flowKey;
    setFlowError(null);
    setDepositStatus("pending");
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

      const result = await sendAndConfirmTransaction.mutateAsync(transaction);
      const txHash = getTransactionHash(result);
      if (!isCurrentFlow(expectedFlowKey)) return;
      setDepositTxHash(txHash);
      setDepositStatus("deposited");
      const shares = await readShareBalance(expectedFlowKey);
      if (txHash !== null && shares !== null && shares > 0n) {
        await submitFundingProof(txHash, shares, expectedFlowKey);
      }
    } catch (error) {
      if (!isCurrentFlow(expectedFlowKey)) return;
      setDepositStatus("idle");
      setFlowError(error instanceof Error ? error.message : "Vault deposit failed.");
    }
  }, [
    canAuthorizeDeposit,
    chain,
    client,
    flowKey,
    isCurrentFlow,
    plan,
    readShareBalance,
    sendAndConfirmTransaction,
    submitFundingProof,
  ]);

  useEffect(() => {
    if (
      depositTxHash === null ||
      !hasPositiveShares ||
      shareBalance === null ||
      proofStatus !== "idle"
    ) {
      return;
    }
    void submitFundingProof(depositTxHash, shareBalance);
  }, [depositTxHash, hasPositiveShares, proofStatus, shareBalance, submitFundingProof]);

  const handleCardFundingSuccess = useCallback(() => {
    const expectedFlowKey = flowKey;
    if (!isCurrentFlow(expectedFlowKey)) return;
    setFlowError(null);
    setCardFundingStatus("funded");
  }, [flowKey, isCurrentFlow]);

  const handleCardFundingError = useCallback(
    (error: { message: string }) => {
      const expectedFlowKey = flowKey;
      if (!isCurrentFlow(expectedFlowKey)) return;
      setFlowError(error.message);
    },
    [flowKey, isCurrentFlow]
  );

  return (
    <div className="grid gap-6" data-testid="vault-card-endow-flow">
      <form className="grid gap-2" onSubmit={handleSendEmailCode}>
        <label
          htmlFor={emailInputId}
          className="block font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({ id: "public.vaults.cardEndow.emailLabel", defaultMessage: "Email" })}
        </label>
        <p className="text-sm leading-[1.5] text-text-sub-600">
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
          className="mt-1 w-full rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-3 text-base text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action focus:ring-2 focus:ring-primary-action/20"
          placeholder="qa@example.org"
          onChange={(event) => handleEmailInputChange(event.target.value)}
        />
        <button
          type="submit"
          disabled={!canSendEmailCode}
          className="mt-2 min-h-12 rounded-full bg-text-strong-950 px-6 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.cardEndow.sendCode",
            defaultMessage: "Send email code",
          })}
        </button>
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
              defaultMessage: "Review before live card payment",
            })}
          </h4>
          {/* Human summary leads; the full onchain tuple is one tap away. */}
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
                  id: "public.vaults.cardEndow.tupleAmount",
                  defaultMessage: "Amount",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formattedAmount} {plan.cardFunding.tokenSymbol}
              </dd>
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
                  id: "public.vaults.cardEndow.tupleProviderRoute",
                  defaultMessage: "Provider route",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formatProviderFlow(formatMessage, plan.providerFlow)}
              </dd>
            </div>
          </dl>
          <details className="mt-4 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
              {formatMessage({
                id: "public.vaults.cardEndow.tupleDetailsSummary",
                defaultMessage: "Full onchain detail",
              })}
            </summary>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
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
                    id: "public.vaults.cardEndow.tupleBaseUnits",
                    defaultMessage: "Base units",
                  })}
                </dt>
                <dd className="text-text-sub-600">
                  {formatMessage(
                    {
                      id: "public.vaults.cardEndow.baseUnitsValue",
                      defaultMessage: "{amount} base units",
                    },
                    { amount: plan.cardFunding.amount }
                  )}
                </dd>
              </div>
            </dl>
          </details>
          <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
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
              onSuccess={handleCardFundingSuccess}
              onError={handleCardFundingError}
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
        <div className="grid gap-3">
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
          {proofStatus === "submitting" ? (
            <p className="rounded-2xl bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
              {formatMessage({
                id: "public.vaults.cardEndow.proofSubmitting",
                defaultMessage: "Recording funding proof with the Green Goods agent...",
              })}
            </p>
          ) : null}
          {proofStatus === "recorded" ? (
            <p className="rounded-2xl bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
              {formatMessage({
                id: "public.vaults.cardEndow.proofRecorded",
                defaultMessage: "Funding proof recorded for the recovered wallet receipt.",
              })}
            </p>
          ) : null}
          {proofStatus === "error" ? (
            <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
              {proofError ??
                formatMessage({
                  id: "public.vaults.cardEndow.proofFailed",
                  defaultMessage: "Funding proof could not be recorded.",
                })}
            </p>
          ) : null}
        </div>
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
