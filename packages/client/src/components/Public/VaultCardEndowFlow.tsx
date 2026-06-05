import {
  buildPublicFundingAvailabilityKey,
  PUBLIC_AGENT_ROUTES,
  type SubmitFundingIntentProofResponse,
} from "@green-goods/shared/public-contracts";
import {
  prepareOctantVaultCardEndowFallbackPlan,
  getOctantVaultAssetDisplayPolicy,
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
import {
  CHECKOUT_FIELD_LABEL,
  CHECKOUT_GHOST_BUTTON,
  CHECKOUT_INPUT,
  CHECKOUT_PRIMARY_BUTTON,
  CheckoutScreen,
  CheckoutSummary,
  type CheckoutSummaryItem,
} from "./vaultCheckoutShell";

function getAgentApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "";
}

function getThirdwebClientId(): string {
  return import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim() ?? "";
}

function getThirdwebChain(chainId: number) {
  return chainId === ethereum.id ? ethereum : defineChain(chainId);
}

function getTransactionHash(result: unknown): `0x${string}` | null {
  if (!result || typeof result !== "object") return null;
  const candidate = (result as { transactionHash?: unknown }).transactionHash;
  return typeof candidate === "string" && candidate.startsWith("0x")
    ? (candidate as `0x${string}`)
    : null;
}

/**
 * Render-only view of where the Card Endow ceremony is. Derived strictly from the
 * authoritative booleans below — it never owns amount, receiver, lock, or status
 * state; it only decides which single step to show. A failed step resets its own
 * status to idle, so the derivation naturally holds the stage and the inline
 * error renders in place.
 */
type CardEndowStage = "recover" | "review" | "fund" | "approve" | "deposit" | "done";

export interface VaultCardEndowFlowProps {
  campaign: OctantVaultCampaignManifest;
  /** Base-unit amount selected in the checkout dialog before the card path opens. */
  amount: bigint;
  /** Decisions already made (amount, method) — shown as a compact summary strip. */
  summaryItems: CheckoutSummaryItem[];
  /** Step back to the amount/method configure step (only while inputs are unlocked). */
  onBack: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}

/**
 * VaultCardEndowFlow — the Card payment path for the /vaults checkout sheet.
 *
 * Mounted (lazily) only once a valid amount exists and the user chose Card. Renders
 * one focused step at a time inside the fixed-height sheet, keeping every Card Endow
 * safety gate: email verification first, donor review before the Thirdweb
 * BuyWidget, strict WETH approve -> deposit ordering, and proof only after a
 * positive `vault.balanceOf(receiver)` read.
 */
export default function VaultCardEndowFlow({
  campaign,
  amount,
  summaryItems,
  onBack,
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
      <CheckoutScreen
        footer={
          <button type="button" onClick={onBack} className={CHECKOUT_GHOST_BUTTON}>
            {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
          </button>
        }
      >
        <p
          role="alert"
          className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base"
        >
          {formatMessage({
            id: "public.vaults.cardEndow.missingClientId",
            defaultMessage:
              "Card checkout is not available on this domain yet. Please choose wallet or try again later.",
          })}
        </p>
      </CheckoutScreen>
    );
  }

  return (
    <ThirdwebProvider>
      <CardEndowProviderContent
        campaign={campaign}
        amount={amount}
        client={client}
        summaryItems={summaryItems}
        onBack={onBack}
        onCheckoutGuardChange={onCheckoutGuardChange}
      />
    </ThirdwebProvider>
  );
}

function CardEndowProviderContent({
  campaign,
  amount,
  client,
  summaryItems,
  onBack,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  client: ThirdwebClient;
  summaryItems: CheckoutSummaryItem[];
  onBack: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  const { formatMessage } = useIntl();
  const emailInputId = useId();
  const emailHelpId = useId();
  const emailStatusId = useId();
  const emailFormId = useId();
  const otpInputId = useId();
  const otpHelpId = useId();
  const otpFormId = useId();
  const tupleConfirmId = useId();
  const otpRef = useRef<HTMLInputElement>(null);
  const [emailInput, setEmailInput] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [recoveredWalletAddress, setRecoveredWalletAddress] = useState<Address | null>(null);
  const [tupleAcknowledged, setTupleAcknowledged] = useState(false);
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

  // Render-only stage derivation (read state, never own it). Highest first.
  const stage: CardEndowStage =
    depositStatus === "deposited"
      ? "done"
      : cardFundingStatus === "funded" && approvalStatus === "approved"
        ? "deposit"
        : cardFundingStatus === "funded"
          ? "approve"
          : tupleConfirmed && plan
            ? "fund"
            : receiverAddress
              ? "review"
              : "recover";

  // Switching campaign (a fresh checkout) clears every Card Endow gate.
  useEffect(() => {
    setEmailInput("");
    setOtpEmail(null);
    setVerifiedEmail(null);
    setOtpInput("");
    setOtpSent(false);
    setRecoveredWalletAddress(null);
    setTupleAcknowledged(false);
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
    setTupleAcknowledged(false);
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

  // Keyboard continuity: once a fresh code is sent, move focus to the OTP field so
  // a keyboard user is not stranded between the email and verification steps.
  useEffect(() => {
    if (otpSent) otpRef.current?.focus();
  }, [otpSent]);

  const resetRecoveredWalletFlow = useCallback(() => {
    setOtpInput("");
    setOtpSent(false);
    setOtpEmail(null);
    setVerifiedEmail(null);
    setRecoveredWalletAddress(null);
    setTupleAcknowledged(false);
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
        setFlowError(error instanceof Error ? error.message : "Email code could not be sent.");
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
        setFlowError(
          error instanceof Error
            ? error.message
            : "Email wallet verification could not be completed."
        );
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

  // ── Render helpers ─────────────────────────────────────────────────────────
  const canEditCheckout = !checkoutInputsLocked;
  const assetDisplay = getOctantVaultAssetDisplayPolicy(
    plan?.cardFunding.tokenSymbol ?? campaign.vault?.asset?.symbol
  );

  const cardSummaryItems: CheckoutSummaryItem[] = [
    ...summaryItems,
    ...(verifiedEmail
      ? [
          {
            label: formatMessage({
              id: "public.vaults.cardEndow.emailLabel",
              defaultMessage: "Email",
            }),
            value: verifiedEmail,
          },
        ]
      : []),
    ...(receiverAddress
      ? [
          {
            label: formatMessage({
              id: "public.vaults.cardEndow.positionHolder",
              defaultMessage: "Vault position",
            }),
            value: formatMessage({
              id: "public.vaults.cardEndow.positionHolderValue",
              defaultMessage: "Verified email wallet",
            }),
          },
        ]
      : []),
  ];

  const backButton = canEditCheckout ? (
    <button type="button" onClick={onBack} className={CHECKOUT_GHOST_BUTTON}>
      {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
    </button>
  ) : null;

  const errorNotes = (
    <>
      {connectError ? (
        <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {connectError.message}
        </p>
      ) : null}
      {flowError ? (
        <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {flowError}
        </p>
      ) : null}
    </>
  );

  // ── recover: email + OTP ───────────────────────────────────────────────────
  if (stage === "recover") {
    return (
      <CheckoutScreen
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              form={otpSent ? otpFormId : emailFormId}
              disabled={otpSent ? !canVerifyEmailWallet || isConnecting : !canSendEmailCode}
              className={CHECKOUT_PRIMARY_BUTTON}
            >
              {otpSent
                ? formatMessage({
                    id: "public.vaults.cardEndow.verifyWallet",
                    defaultMessage: "Verify email",
                  })
                : formatMessage({
                    id: "public.vaults.cardEndow.sendCode",
                    defaultMessage: "Send email code",
                  })}
            </button>
            {backButton}
          </div>
        }
      >
        <div className="flex min-h-[31rem] flex-col gap-5" data-testid="vault-card-endow-flow">
          <CheckoutSummary items={cardSummaryItems} onEdit={canEditCheckout ? onBack : undefined} />

          <form id={emailFormId} className="grid gap-2" onSubmit={handleSendEmailCode}>
            <label htmlFor={emailInputId} className={CHECKOUT_FIELD_LABEL}>
              {formatMessage({ id: "public.vaults.cardEndow.emailLabel", defaultMessage: "Email" })}
            </label>
            <p id={emailHelpId} className="text-sm leading-[1.5] text-text-sub-600">
              {formatMessage({
                id: "public.vaults.cardEndow.emailHelp",
                defaultMessage: "We send a verification code before opening secure card payment.",
              })}
            </p>
            <input
              id={emailInputId}
              value={emailInput}
              type="email"
              autoComplete="email"
              aria-describedby={otpSent ? `${emailHelpId} ${emailStatusId}` : emailHelpId}
              className={CHECKOUT_INPUT}
              placeholder="qa@example.org"
              onChange={(event) => handleEmailInputChange(event.target.value)}
            />
          </form>

          <div id={emailStatusId} aria-live="polite" aria-atomic="true" className="min-h-[3.25rem]">
            {otpSent && otpEmail ? (
              <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
                {formatMessage(
                  {
                    id: "public.vaults.cardEndow.emailCodeSent",
                    defaultMessage: "Code sent. Check {email} and enter the 6-digit code below.",
                  },
                  { email: otpEmail }
                )}
              </p>
            ) : null}
          </div>

          <form
            id={otpFormId}
            className="grid min-h-[6.5rem] gap-2"
            onSubmit={handleVerifyEmailWallet}
          >
            <label htmlFor={otpInputId} className={CHECKOUT_FIELD_LABEL}>
              {formatMessage({
                id: "public.vaults.cardEndow.otpLabel",
                defaultMessage: "Email code",
              })}
            </label>
            <p id={otpHelpId} className="text-sm leading-[1.5] text-text-sub-600">
              {otpSent
                ? formatMessage({
                    id: "public.vaults.cardEndow.otpHelp",
                    defaultMessage: "Enter the 6-digit code from your email.",
                  })
                : formatMessage({
                    id: "public.vaults.cardEndow.otpHelpLocked",
                    defaultMessage: "Send the code above to unlock this field.",
                  })}
            </p>
            <input
              ref={otpRef}
              id={otpInputId}
              value={otpInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={!otpSent}
              aria-describedby={otpHelpId}
              className={CHECKOUT_INPUT}
              placeholder="123456"
              onChange={(event) => setOtpInput(event.target.value)}
            />
          </form>

          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── review: donor confirmation + technical WETH details ───────────────────
  if (stage === "review") {
    return (
      <CheckoutScreen
        footer={
          <div className="flex flex-col gap-3">
            {plan ? (
              <>
                <label
                  htmlFor={tupleConfirmId}
                  className="flex gap-3 border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm leading-[1.5] text-text-sub-600"
                >
                  <input
                    id={tupleConfirmId}
                    type="checkbox"
                    className="mt-1 size-4 border-stroke-soft-200 text-primary-action focus:ring-primary-action"
                    checked={tupleAcknowledged}
                    onChange={(event) => setTupleAcknowledged(event.target.checked)}
                  />
                  <span>
                    {formatMessage(
                      {
                        id: "public.vaults.cardEndow.confirmTuple",
                        defaultMessage:
                          "I'm ready to continue to secure card payment for {campaign}.",
                      },
                      { campaign: campaign.displayName }
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={!tupleAcknowledged}
                  onClick={() => setTupleConfirmed(true)}
                  className={CHECKOUT_PRIMARY_BUTTON}
                >
                  {formatMessage({
                    id: "public.vaults.cardEndow.confirmAndContinue",
                    defaultMessage: "Continue to card payment",
                  })}
                </button>
              </>
            ) : null}
            {backButton}
          </div>
        }
      >
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-flow">
          <CheckoutSummary items={cardSummaryItems} onEdit={canEditCheckout ? onBack : undefined} />

          {plan ? (
            <section
              className="flex flex-col gap-4"
              aria-labelledby="public-vaults-card-endow-review-title"
              data-testid="vault-card-endow-review"
            >
              <h4 id="public-vaults-card-endow-review-title" className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleTitle",
                  defaultMessage: "Review donation",
                })}
              </h4>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
                      defaultMessage: "ETH contribution",
                    })}
                  </dt>
                  <dd className="text-text-sub-600">
                    {formattedAmount} {assetDisplay.donorSymbol}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-text-strong-950">
                    {formatMessage({
                      id: "public.vaults.cardEndow.settlement",
                      defaultMessage: "Settlement",
                    })}
                  </dt>
                  <dd className="text-text-sub-600">
                    {formatMessage(
                      {
                        id: "public.vaults.cardEndow.settlementValue",
                        defaultMessage: "Settles into the Octant vault as {amount} {symbol}",
                      },
                      { amount: formattedAmount, symbol: assetDisplay.settlementSymbol }
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-text-strong-950">
                    {formatMessage({
                      id: "public.vaults.cardEndow.nextStep",
                      defaultMessage: "Next step",
                    })}
                  </dt>
                  <dd className="text-text-sub-600">
                    {formatMessage({
                      id: "public.vaults.cardEndow.nextStepValue",
                      defaultMessage: "Secure card payment",
                    })}
                  </dd>
                </div>
              </dl>
              <details className="border-t border-stroke-soft-200 pt-4">
                <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                  {formatMessage({
                    id: "public.vaults.checkout.technicalDetails",
                    defaultMessage: "Technical WETH details",
                  })}
                </summary>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-text-strong-950">
                      {formatMessage({
                        id: "public.vaults.cardEndow.tupleChain",
                        defaultMessage: "Ethereum network",
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
                        defaultMessage: "Octant vault",
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
                        defaultMessage: "WETH token",
                      })}
                    </dt>
                    <dd className="break-all text-text-sub-600">
                      {assetDisplay.technicalSymbol} · {plan.cardFunding.tokenAddress}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-text-strong-950">
                      {formatMessage({
                        id: "public.vaults.cardEndow.checkoutWallet",
                        defaultMessage: "Checkout wallet",
                      })}
                    </dt>
                    <dd className="break-all font-mono text-xs text-text-sub-600">
                      {plan.receiptExpectation.receiverAddress}
                    </dd>
                  </div>
                </dl>
              </details>
              <p className="text-sm leading-[1.6] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.authorizationOrder",
                  defaultMessage:
                    "Your card payment funds the verified email wallet with WETH, then you finish the Octant vault deposit from that wallet.",
                })}
              </p>
              <p className="bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.cardLocked",
                  defaultMessage: "No card payment starts until you continue.",
                })}
              </p>
            </section>
          ) : (
            <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
              {formatMessage({
                id: "public.vaults.cardEndow.planBlocked",
                defaultMessage:
                  "Card checkout is paused. Confirm the campaign, amount, and verified email wallet before continuing.",
              })}
            </p>
          )}

          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── fund: card payment widget is its own action (no footer) ────────────────
  if (stage === "fund" && plan) {
    return (
      <CheckoutScreen>
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-flow">
          <CheckoutSummary items={cardSummaryItems} />
          <section
            className="grid gap-4"
            aria-label={formatMessage({
              id: "public.vaults.cardEndow.cardFundingRegion",
              defaultMessage: "Card payment",
            })}
          >
            <div data-testid="vault-card-endow-buy-widget-host">
              <BuyWidget
                client={client}
                chain={chain}
                tokenAddress={plan.cardFunding.tokenAddress}
                amount={formatUnits(
                  BigInt(plan.cardFunding.amount),
                  plan.cardFunding.tokenDecimals
                )}
                receiverAddress={plan.cardFunding.destinationAddress}
                paymentMethods={["card"]}
                amountEditable={false}
                tokenEditable={false}
                connectOptions={{ wallets: buyWidgetWallets, autoConnect: false, chain }}
                theme="light"
                title={formatMessage({
                  id: "public.vaults.cardEndow.buyWidgetTitle",
                  defaultMessage: "Secure card payment",
                })}
                description={formatMessage({
                  id: "public.vaults.cardEndow.buyWidgetDescription",
                  defaultMessage:
                    "Card payment funds your verified email wallet with WETH for this Octant vault.",
                })}
                buttonLabel={formatMessage({
                  id: "public.vaults.cardEndow.buyWidgetButton",
                  defaultMessage: "Continue to card payment",
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
          </section>
          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── approve: authorize the vault to use the funded WETH ───────────────────
  if (stage === "approve") {
    return (
      <CheckoutScreen
        footer={
          <button
            type="button"
            disabled={!canAuthorizeApproval || sendAndConfirmTransaction.isPending}
            className={CHECKOUT_PRIMARY_BUTTON}
            onClick={handleApprove}
          >
            {approvalStatus === "pending"
              ? formatMessage({
                  id: "public.vaults.cardEndow.approving",
                  defaultMessage: "Approving...",
                })
              : formatMessage({
                  id: "public.vaults.cardEndow.approve",
                  defaultMessage: "Authorize vault deposit",
                })}
          </button>
        }
      >
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-flow">
          <CheckoutSummary items={cardSummaryItems} />
          <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
            {formatMessage({
              id: "public.vaults.cardEndow.cardFunded",
              defaultMessage:
                "Card funding is complete. Next, authorize the vault to use the WETH for this contribution.",
            })}
          </p>
          <p className="text-sm leading-[1.6] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.authorizationOrder",
              defaultMessage: "This authorization does not start another card payment.",
            })}
          </p>
          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── deposit: complete the vault position for the verified email wallet ─────
  if (stage === "deposit") {
    return (
      <CheckoutScreen
        footer={
          <button
            type="button"
            disabled={!canAuthorizeDeposit || sendAndConfirmTransaction.isPending}
            className={CHECKOUT_PRIMARY_BUTTON}
            onClick={handleDeposit}
          >
            {depositStatus === "pending"
              ? formatMessage({
                  id: "public.vaults.cardEndow.depositing",
                  defaultMessage: "Depositing...",
                })
              : formatMessage({
                  id: "public.vaults.cardEndow.deposit",
                  defaultMessage: "Complete vault deposit",
                })}
          </button>
        }
      >
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-flow">
          <CheckoutSummary items={cardSummaryItems} />
          <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
            {formatMessage({
              id: "public.vaults.cardEndow.approved",
              defaultMessage: "Vault authorization confirmed",
            })}
          </p>
          <p className="text-sm leading-[1.6] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.shareProof",
              defaultMessage:
                "Finish the deposit so the vault position is issued to your verified email wallet.",
            })}
          </p>
          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── done: positive-share proof + funding proof ─────────────────────────────
  return (
    <CheckoutScreen
      footer={
        hasPositiveShares ? null : (
          <button
            type="button"
            className={CHECKOUT_GHOST_BUTTON}
            onClick={() => void readShareBalance()}
          >
            {formatMessage({
              id: "public.vaults.cardEndow.readShares",
              defaultMessage: "Check vault position",
            })}
          </button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="vault-card-endow-flow">
        <CheckoutSummary items={cardSummaryItems} />
        {hasPositiveShares ? (
          <>
            <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
              {formatMessage(
                {
                  id: "public.vaults.cardEndow.positiveShares",
                  defaultMessage:
                    "Vault position confirmed: {shares} shares are visible for your verified email wallet.",
                },
                { shares: shareBalance?.toString() ?? "0" }
              )}
            </p>
            {proofStatus === "submitting" ? (
              <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.proofSubmitting",
                  defaultMessage: "Recording funding proof with the Green Goods agent...",
                })}
              </p>
            ) : null}
            {proofStatus === "recorded" ? (
              <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
                {formatMessage({
                  id: "public.vaults.cardEndow.proofRecorded",
                  defaultMessage: "Receipt recorded for your vault contribution.",
                })}
              </p>
            ) : null}
            {proofStatus === "error" ? (
              <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
                {proofError ??
                  formatMessage({
                    id: "public.vaults.cardEndow.proofFailed",
                    defaultMessage: "Funding proof could not be recorded.",
                  })}
              </p>
            ) : null}
          </>
        ) : shareBalance !== null ? (
          <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
            {formatMessage({
              id: "public.vaults.cardEndow.noShares",
              defaultMessage: "We could not confirm vault shares yet.",
            })}
          </p>
        ) : (
          <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.verifyingShares",
              defaultMessage: "Confirming your vault position...",
            })}
          </p>
        )}
        {errorNotes}
      </div>
    </CheckoutScreen>
  );
}
