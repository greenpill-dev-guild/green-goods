import {
  getOctantVaultCampaignCopy,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  OCTANT_VAULT_MANIFEST_FIELD_LABELS,
  prepareOctantVaultWalletEndow,
  type OctantVaultCampaignManifest,
  type OctantVaultManifestField,
  type OctantVaultWalletEndowPreparedTransaction,
  useAuth,
  useOctantVaultWalletEndow,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import {
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import { formatUnits, parseUnits } from "viem";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";

const CARD_ENDOW_QA_SEARCH_PARAM = "cardEndowQa";
const CARD_ENDOW_QA_CAMPAIGN_SLUG = "greenpill-nyc-card-endow-qa";
const CardEndowPanel = lazy(() => import("./VaultCardEndowQa"));

const fieldMessageIds: Record<OctantVaultManifestField, string> = {
  chainId: "public.vaults.field.chainId",
  vaultAddress: "public.vaults.field.vaultAddress",
  assetAddress: "public.vaults.field.assetAddress",
  assetSymbol: "public.vaults.field.assetSymbol",
  assetDecimals: "public.vaults.field.assetDecimals",
  recipientRoutingSummary: "public.vaults.field.recipientRoutingSummary",
  protocolGuildDestinationContext: "public.vaults.field.protocolGuildDestinationContext",
  explorerLink: "public.vaults.field.explorerLink",
  campaignCopy: "public.vaults.field.campaignCopy",
};

const copyFieldMessageIds = {
  headline: "headline",
  summary: "summary",
  fundingPurpose: "fundingPurpose",
  recipientLogic: "recipientLogic",
  riskNote: "riskNote",
} as const;

function campaignCopyId(
  campaign: OctantVaultCampaignManifest,
  field: keyof typeof copyFieldMessageIds
) {
  return `public.vaults.campaign.${campaign.slug}.${copyFieldMessageIds[field]}`;
}

function formatCampaignCopy(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  campaign: OctantVaultCampaignManifest
) {
  const copy = getOctantVaultCampaignCopy(campaign);

  return {
    headline: formatMessage({
      id: campaignCopyId(campaign, "headline"),
      defaultMessage: copy.headline,
    }),
    summary: formatMessage({
      id: campaignCopyId(campaign, "summary"),
      defaultMessage: copy.summary,
    }),
    fundingPurpose: formatMessage({
      id: campaignCopyId(campaign, "fundingPurpose"),
      defaultMessage: copy.fundingPurpose,
    }),
    recipientLogic: formatMessage({
      id: campaignCopyId(campaign, "recipientLogic"),
      defaultMessage: copy.recipientLogic,
    }),
    riskNote: formatMessage({
      id: campaignCopyId(campaign, "riskNote"),
      defaultMessage: copy.riskNote,
    }),
  };
}

function formatFieldLabel(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  field: OctantVaultManifestField
): string {
  return formatMessage({
    id: fieldMessageIds[field],
    defaultMessage: OCTANT_VAULT_MANIFEST_FIELD_LABELS[field],
  });
}

function formatCardEndowStatus(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  status: ReturnType<typeof getOctantVaultCampaignTransactionState>["cardEndowStatus"]
): string {
  if (status === "visible") {
    return formatMessage({
      id: "public.vaults.cardEndow.visible",
      defaultMessage: "Thirdweb Card Endow proof is ready.",
    });
  }

  if (status === "hidden_manifest_incomplete") {
    return formatMessage({
      id: "public.vaults.cardEndow.hiddenManifestIncomplete",
      defaultMessage: "Card funding stays hidden until the manifest and proof gates pass.",
    });
  }

  return formatMessage({
    id: "public.vaults.cardEndow.hiddenPendingProof",
    defaultMessage:
      "Card funding stays hidden until custody, share, manage, and provider proof passes.",
  });
}

function isCardEndowQaEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get(CARD_ENDOW_QA_SEARCH_PARAM);
  return value === "1" || value === "true";
}

function getCardEndowQaCampaign(
  campaigns: readonly OctantVaultCampaignManifest[]
): OctantVaultCampaignManifest | null {
  const greenpillNycCampaign = campaigns.find((campaign) => campaign.slug === "greenpill-nyc");

  if (!greenpillNycCampaign?.vault) return null;

  return {
    ...greenpillNycCampaign,
    slug: CARD_ENDOW_QA_CAMPAIGN_SLUG,
    displayName: "Greenpill NYC Card Endow QA",
    fixtureRole: "standard_campaign",
    previewCopy: undefined,
    campaignCopy: {
      headline: "QA-gated card funding for the Greenpill NYC vault.",
      summary:
        "A hidden QA fixture that uses the Greenpill NYC vault tuple and proves the recovered-wallet Card Endow path.",
      fundingPurpose:
        "Fund the recovered Thirdweb email wallet first, then let that same wallet approve and deposit into the Greenpill NYC Octant vault.",
      recipientLogic:
        "The recovered Thirdweb email wallet is both the funded wallet and the receiver that must show positive vault shares.",
      riskNote:
        "Live card payment and onchain approval stay locked until the QA user confirms the exact chain, vault, token, amount, and receiver.",
    },
    recipientRoutingSummary:
      "QA route: Thirdweb card funds the recovered email wallet, then that wallet approves the token and deposits into the Greenpill NYC vault for itself.",
  };
}

function buildCardEndowCampaigns(
  campaigns: readonly OctantVaultCampaignManifest[],
  cardEndowQaEnabled: boolean
): OctantVaultCampaignManifest[] {
  if (!cardEndowQaEnabled) return [...campaigns];

  const qaCampaign = getCardEndowQaCampaign(campaigns);
  if (!qaCampaign) return [...campaigns];

  return [...campaigns, qaCampaign];
}

function CampaignStatus({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const state = getOctantVaultCampaignTransactionState(campaign);
  const label =
    state.manifestStatus === "complete"
      ? formatMessage({
          id: "public.vaults.status.ready",
          defaultMessage: "Manifest complete",
        })
      : formatMessage({
          id: "public.vaults.status.blocked",
          defaultMessage: "Blocked pending manifest",
        });

  return (
    <span
      className={
        state.manifestStatus === "complete"
          ? "inline-flex w-fit rounded-full bg-primary-action/12 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-primary-base"
          : "inline-flex w-fit rounded-full bg-bg-weak-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-sub-600 ring-1 ring-stroke-soft-200"
      }
    >
      {label}
    </span>
  );
}

function ManifestMissingList({
  missingFields,
  id,
}: {
  missingFields: readonly OctantVaultManifestField[];
  id: string;
}) {
  const { formatMessage } = useIntl();

  if (missingFields.length === 0) {
    return (
      <p id={id} className="text-sm leading-[1.55] text-text-sub-600">
        {formatMessage({
          id: "public.vaults.manifest.complete",
          defaultMessage:
            "This campaign is ready for the amount-first Wallet Endow confirmation flow.",
        })}
      </p>
    );
  }

  return (
    <div id={id}>
      <p className="text-sm leading-[1.55] text-text-sub-600">
        {formatMessage({
          id: "public.vaults.manifest.blocked",
          defaultMessage: "Transactions stay disabled until these manifest fields are supplied:",
        })}
      </p>
      <ul
        className="mt-3 flex flex-wrap gap-2"
        aria-label={formatMessage({
          id: "public.vaults.manifest.missingFields",
          defaultMessage: "Missing manifest fields",
        })}
      >
        {missingFields.map((field) => (
          <li
            key={field}
            className="rounded-full bg-bg-white-0 px-3 py-1 text-xs text-text-sub-600 ring-1 ring-stroke-soft-200"
          >
            {formatFieldLabel(formatMessage, field)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VaultMetadata({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const chainValue = campaign.vault?.chainId
    ? formatMessage(
        { id: "public.vaults.metadata.chainValue", defaultMessage: "Ethereum · chain {chainId}" },
        { chainId: campaign.vault.chainId }
      )
    : formatMessage({ id: "public.vaults.metadata.pending", defaultMessage: "Pending" });
  const assetValue = campaign.vault?.asset?.symbol
    ? formatMessage(
        {
          id: "public.vaults.metadata.assetValue",
          defaultMessage: "{symbol} · {decimals, plural, one {# decimal} other {# decimals}}",
        },
        {
          symbol: campaign.vault.asset.symbol,
          decimals: campaign.vault.asset.decimals ?? 0,
        }
      )
    : formatMessage({ id: "public.vaults.metadata.pending", defaultMessage: "Pending" });
  const vaultValue = campaign.vault?.vaultAddress
    ? campaign.vault.vaultAddress
    : formatMessage({ id: "public.vaults.metadata.pending", defaultMessage: "Pending" });
  const explorerValue = campaign.vault?.explorerLink
    ? campaign.vault.explorerLink
    : formatMessage({ id: "public.vaults.metadata.pending", defaultMessage: "Pending" });

  const items = [
    {
      label: formatMessage({ id: "public.vaults.metadata.chain", defaultMessage: "Chain" }),
      value: chainValue,
    },
    {
      label: formatMessage({ id: "public.vaults.metadata.asset", defaultMessage: "Asset" }),
      value: assetValue,
    },
    {
      label: formatMessage({
        id: "public.vaults.metadata.vaultAddress",
        defaultMessage: "Vault address",
      }),
      value: vaultValue,
    },
    {
      label: formatMessage({ id: "public.vaults.metadata.explorer", defaultMessage: "Explorer" }),
      value: explorerValue,
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="border-t border-stroke-soft-200 pt-3">
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {item.label}
          </dt>
          <dd className="mt-1 break-words leading-[1.5] text-text-sub-600">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CampaignCard({
  campaign,
  cardEndowQaEnabled = false,
  onSelectCardEndow,
  onSelectWalletEndow,
}: {
  campaign: OctantVaultCampaignManifest;
  cardEndowQaEnabled?: boolean;
  onSelectCardEndow?: (campaign: OctantVaultCampaignManifest) => void;
  onSelectWalletEndow?: (campaign: OctantVaultCampaignManifest) => void;
}) {
  const { formatMessage } = useIntl();
  const copy = formatCampaignCopy(formatMessage, campaign);
  const transactionState = getOctantVaultCampaignTransactionState(campaign);
  const showCardEndowQaAction = cardEndowQaEnabled && transactionState.walletEndowEnabled;
  const missingId = `vault-campaign-${campaign.slug}-missing-fields`;
  const walletEndowLabel = transactionState.walletEndowEnabled
    ? formatMessage({
        id: "public.vaults.walletEndow.chooseAmount",
        defaultMessage: "Choose amount",
      })
    : formatMessage({
        id: "public.vaults.walletEndow.unavailable",
        defaultMessage: "Wallet Endow unavailable",
      });

  return (
    <article
      data-testid={`vault-campaign-card-${campaign.slug}`}
      className="flex min-h-full flex-col gap-6 border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6"
      aria-labelledby={`vault-campaign-${campaign.slug}-title`}
    >
      <header className="flex flex-col gap-4">
        <CampaignStatus campaign={campaign} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {campaign.communityName}
          </p>
          <h3
            id={`vault-campaign-${campaign.slug}-title`}
            className="mt-2 font-serif text-2xl font-normal leading-[1.08] text-text-strong-950"
          >
            {campaign.displayName}
          </h3>
        </div>
        <p className="text-base leading-[1.6] text-text-sub-600">{copy.summary}</p>
      </header>

      <EditorialDivider />

      <section aria-labelledby={`vault-campaign-${campaign.slug}-story-title`}>
        <h4
          id={`vault-campaign-${campaign.slug}-story-title`}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({ id: "public.vaults.card.story", defaultMessage: "Campaign story" })}
        </h4>
        <p className="mt-2 font-serif text-xl leading-[1.25] text-text-strong-950">
          {copy.headline}
        </p>
        <dl className="mt-5 space-y-4 text-sm leading-[1.6] text-text-sub-600">
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.fundingPurpose",
                defaultMessage: "Funding purpose",
              })}
            </dt>
            <dd className="mt-1">{copy.fundingPurpose}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.recipientLogic",
                defaultMessage: "Recipient logic",
              })}
            </dt>
            <dd className="mt-1">{copy.recipientLogic}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.guardrail",
                defaultMessage: "Guardrail",
              })}
            </dt>
            <dd className="mt-1">{copy.riskNote}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={`vault-campaign-${campaign.slug}-metadata-title`}>
        <h4
          id={`vault-campaign-${campaign.slug}-metadata-title`}
          className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.card.onchainContext",
            defaultMessage: "Onchain context",
          })}
        </h4>
        <VaultMetadata campaign={campaign} />
      </section>

      <section
        className="mt-auto"
        aria-labelledby={`vault-campaign-${campaign.slug}-actions-title`}
      >
        <h4
          id={`vault-campaign-${campaign.slug}-actions-title`}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.card.transactionState",
            defaultMessage: "Transaction state",
          })}
        </h4>
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            disabled={!transactionState.walletEndowEnabled}
            onClick={() => {
              if (transactionState.walletEndowEnabled) onSelectWalletEndow?.(campaign);
            }}
            aria-describedby={missingId}
            aria-label={
              transactionState.walletEndowEnabled
                ? formatMessage(
                    {
                      id: "public.vaults.walletEndow.chooseAmountLabel",
                      defaultMessage: "Choose amount for {campaign}",
                    },
                    { campaign: campaign.displayName }
                  )
                : formatMessage(
                    {
                      id: "public.vaults.walletEndow.unavailableLabel",
                      defaultMessage: "Wallet Endow unavailable for {campaign}",
                    },
                    { campaign: campaign.displayName }
                  )
            }
            className="w-full rounded-full bg-text-strong-950 px-5 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
          >
            {walletEndowLabel}
          </button>
          {showCardEndowQaAction ? (
            <button
              type="button"
              onClick={() => onSelectCardEndow?.(campaign)}
              aria-label={formatMessage(
                {
                  id: "public.vaults.cardEndow.payByCardLabel",
                  defaultMessage: "Pay by card for {campaign}",
                },
                { campaign: campaign.displayName }
              )}
              className="w-full rounded-full border border-primary-action bg-bg-white-0 px-5 py-3 text-sm font-semibold text-primary-base transition-colors hover:bg-primary-action/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
            >
              {formatMessage({
                id: "public.vaults.cardEndow.payByCard",
                defaultMessage: "Pay by card",
              })}
            </button>
          ) : null}
          <p className="text-sm leading-[1.5] text-text-soft-400">
            {showCardEndowQaAction
              ? formatMessage({
                  id: "public.vaults.cardEndow.qaAvailable",
                  defaultMessage:
                    "QA card funding is available after email-wallet recovery and exact tuple confirmation.",
                })
              : formatCardEndowStatus(formatMessage, transactionState.cardEndowStatus)}
          </p>
        </div>
        <div className="mt-5">
          <ManifestMissingList id={missingId} missingFields={transactionState.missingFields} />
        </div>
      </section>
    </article>
  );
}

interface WalletEndowPanelProps {
  campaign: OctantVaultCampaignManifest;
  onClose: () => void;
  onAmountChange: () => void;
  onContinueToWallet: (amount: bigint) => void;
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

function WalletEndowPanel({
  campaign,
  onClose,
  onAmountChange,
  onContinueToWallet,
}: WalletEndowPanelProps) {
  const { formatMessage } = useIntl();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const [amountInput, setAmountInput] = useState("");
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
  const showWalletAction = hasReadyAmount && !amountError;
  const actionLabel = !showWalletAction
    ? formatMessage({
        id: "public.vaults.walletEndow.enterAmount",
        defaultMessage: "Enter an amount",
      })
    : formatMessage({
        id: "public.vaults.walletEndow.continueToWallet",
        defaultMessage: "Continue to wallet",
      });

  useEffect(() => {
    setAmountInput("");
  }, [campaign.slug]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!showWalletAction || !parsedAmount) return;

      onContinueToWallet(parsedAmount);
    },
    [onContinueToWallet, parsedAmount, showWalletAction]
  );

  return (
    <aside
      className="mt-10 border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6"
      aria-labelledby="public-vaults-wallet-endow-title"
      data-testid="vault-wallet-endow-panel"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.walletEndow.kicker",
              defaultMessage: "Wallet Endow",
            })}
          </EditorialKicker>
          <h3
            id="public-vaults-wallet-endow-title"
            className="font-serif text-2xl font-normal leading-[1.08] text-text-strong-950"
          >
            {formatMessage({
              id: "public.vaults.walletEndow.title",
              defaultMessage: "Prepare Wallet Endow",
            })}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-[1.65] text-text-sub-600">
            {formatMessage(
              {
                id: "public.vaults.walletEndow.body",
                defaultMessage:
                  "Choose the amount for {campaign}. Wallet connection is requested only after this final confirmation step.",
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

      <form className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSubmit}>
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
            onChange={(event) => {
              setAmountInput(event.target.value);
              onAmountChange();
            }}
          />
          {amountError ? (
            <p id={amountErrorId} className="mt-2 text-sm leading-[1.5] text-error-base">
              {amountError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col justify-end gap-3">
          <button
            type="submit"
            disabled={!showWalletAction}
            className="min-h-12 rounded-full bg-text-strong-950 px-6 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
          >
            {actionLabel}
          </button>
          <p className="max-w-sm text-xs leading-[1.5] text-text-soft-400">
            {formatMessage({
              id: "public.vaults.walletEndow.cardHidden",
              defaultMessage:
                "Card funding remains hidden until custody, share, manage, and provider proof passes.",
            })}
          </p>
        </div>
      </form>
    </aside>
  );
}

interface WalletEndowConfirmationPanelProps {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  primaryWalletAddress?: string | null;
  isSubmitting: boolean;
  submissionError?: unknown;
  onClose: () => void;
  onConnectWallet: () => void;
  onSubmitWalletEndow: (
    transaction: OctantVaultWalletEndowPreparedTransaction,
    callbacks: { onError: () => void; onSuccess: () => void }
  ) => void;
}

function WalletEndowConfirmationPanel({
  campaign,
  amount,
  primaryWalletAddress,
  isSubmitting,
  submissionError,
  onClose,
  onConnectWallet,
  onSubmitWalletEndow,
}: WalletEndowConfirmationPanelProps) {
  const { formatMessage } = useIntl();
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const formattedAmount = formatUnits(amount, decimals);
  const actionLabel = primaryWalletAddress
    ? formatMessage({
        id: "public.vaults.walletEndow.confirm",
        defaultMessage: "Confirm Wallet Endow",
      })
    : formatMessage({
        id: "public.vaults.walletEndow.connect",
        defaultMessage: "Connect Wallet",
      });

  useEffect(() => {
    setStatus("idle");
  }, [amount, campaign.slug]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!primaryWalletAddress) {
        onConnectWallet();
        return;
      }

      const prepared = prepareOctantVaultWalletEndow({
        campaign,
        amount,
        receiverAddress: primaryWalletAddress,
      });

      if (prepared.status !== "ready" || !prepared.transaction) return;

      onSubmitWalletEndow(prepared.transaction, {
        onError: () => setStatus("idle"),
        onSuccess: () => setStatus("success"),
      });
    },
    [amount, campaign, onConnectWallet, onSubmitWalletEndow, primaryWalletAddress]
  );

  return (
    <aside
      className="mt-6 border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6"
      aria-labelledby="public-vaults-wallet-endow-confirm-title"
      data-testid="vault-wallet-endow-confirmation"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.walletEndow.kicker",
              defaultMessage: "Wallet Endow",
            })}
          </EditorialKicker>
          <h3
            id="public-vaults-wallet-endow-confirm-title"
            className="font-serif text-2xl font-normal leading-[1.08] text-text-strong-950"
          >
            {formatMessage({
              id: "public.vaults.walletEndow.confirmTitle",
              defaultMessage: "Confirm with wallet",
            })}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-[1.65] text-text-sub-600">
            {formatMessage(
              {
                id: "public.vaults.walletEndow.confirmBody",
                defaultMessage:
                  "Confirm the selected amount with the wallet that should receive the vault position for {campaign}.",
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

      <form
        className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        onSubmit={handleSubmit}
      >
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({
              id: "public.vaults.walletEndow.confirmAmountLabel",
              defaultMessage: "Selected amount",
            })}
          </p>
          <p className="mt-2 text-base font-medium text-text-strong-950">
            {formatMessage(
              {
                id: "public.vaults.walletEndow.confirmAmount",
                defaultMessage: "{amount} {symbol}",
              },
              { amount: formattedAmount, symbol }
            )}
          </p>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 rounded-full bg-text-strong-950 px-6 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
        >
          {isSubmitting
            ? formatMessage({
                id: "public.vaults.walletEndow.submitting",
                defaultMessage: "Submitting...",
              })
            : actionLabel}
        </button>
      </form>
      {status === "success" ? (
        <p className="mt-5 rounded-2xl bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
          {formatMessage({
            id: "public.vaults.walletEndow.success",
            defaultMessage:
              "Wallet Endow was submitted. Route-local receipt and management proof continue in the next gates.",
          })}
        </p>
      ) : null}
      {submissionError ? (
        <p className="mt-5 rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {formatMessage({
            id: "public.vaults.walletEndow.error",
            defaultMessage:
              "Wallet Endow could not be submitted. Review the wallet error and retry.",
          })}
        </p>
      ) : null}
    </aside>
  );
}

function WalletEndowRuntimePanel({
  campaign,
  amount,
  onClose,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  onClose: () => void;
}) {
  return (
    <WalletRuntimeProviders>
      <WalletEndowRuntimePanelContent campaign={campaign} amount={amount} onClose={onClose} />
    </WalletRuntimeProviders>
  );
}

function WalletEndowRuntimePanelContent({
  campaign,
  amount,
  onClose,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  onClose: () => void;
}) {
  const { authMode, primaryAddress } = useUser();
  const { loginWithWallet } = useAuth();
  const walletEndow = useOctantVaultWalletEndow({ errorMode: "inline" });
  const primaryWalletAddress = authMode === "wallet" ? primaryAddress : null;
  const handleWalletEndowSubmit = useCallback(
    (
      transaction: OctantVaultWalletEndowPreparedTransaction,
      callbacks: { onError: () => void; onSuccess: () => void }
    ) => {
      walletEndow.mutate(transaction, callbacks);
    },
    [walletEndow]
  );

  return (
    <WalletEndowConfirmationPanel
      campaign={campaign}
      amount={amount}
      primaryWalletAddress={primaryWalletAddress}
      isSubmitting={walletEndow.isPending}
      submissionError={walletEndow.error}
      onClose={onClose}
      onConnectWallet={loginWithWallet}
      onSubmitWalletEndow={handleWalletEndowSubmit}
    />
  );
}

export function VaultsPageContent({
  campaigns: campaignItems,
}: {
  campaigns?: OctantVaultCampaignManifest[];
} = {}) {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const cardEndowQaEnabled = isCardEndowQaEnabled(location.search);
  const campaigns = useMemo(
    () => buildCardEndowCampaigns(campaignItems ?? getOctantVaultCampaigns(), cardEndowQaEnabled),
    [campaignItems, cardEndowQaEnabled]
  );
  const [selectedWalletEndowCampaign, setSelectedWalletEndowCampaign] =
    useState<OctantVaultCampaignManifest | null>(null);
  const [selectedCardEndowCampaign, setSelectedCardEndowCampaign] =
    useState<OctantVaultCampaignManifest | null>(null);
  const [walletEndowAmount, setWalletEndowAmount] = useState<bigint | null>(null);
  const handleSelectWalletEndow = useCallback((campaign: OctantVaultCampaignManifest) => {
    setSelectedWalletEndowCampaign(campaign);
    setSelectedCardEndowCampaign(null);
    setWalletEndowAmount(null);
  }, []);
  const handleSelectCardEndow = useCallback((campaign: OctantVaultCampaignManifest) => {
    setSelectedCardEndowCampaign(campaign);
    setSelectedWalletEndowCampaign(null);
    setWalletEndowAmount(null);
  }, []);
  const handleCloseWalletEndow = useCallback(() => {
    setSelectedWalletEndowCampaign(null);
    setWalletEndowAmount(null);
  }, []);
  const handleCloseCardEndow = useCallback(() => {
    setSelectedCardEndowCampaign(null);
  }, []);

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("vaults")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({
          id: "public.vaults.hero.kicker",
          defaultMessage: "Octant V2 Ethereum vaults",
        })}
        titleId="public-vaults-title"
        title={formatMessage(
          {
            id: "public.vaults.hero.title",
            defaultMessage: "Octant vault campaigns for <accent>public goods</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.vaults.hero.lede",
          defaultMessage:
            "Browse Greenpill NYC and EVMavericks campaign slots before any wallet step. Wallet Endow stays disabled until each Octant V2 Ethereum vault manifest is complete.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-vaults-browse-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.vaults.browse.kicker",
                defaultMessage: "§ 01 — Campaign manifest",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-vaults-browse-title">
              {formatMessage({
                id: "public.vaults.browse.title",
                defaultMessage: "Two pilot slots, one dedicated vault route.",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-5 max-w-2xl">
              {formatMessage({
                id: "public.vaults.browse.lede",
                defaultMessage: "No wallet connection needed to browse.",
              })}
            </EditorialLede>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.slug}
                campaign={campaign}
                cardEndowQaEnabled={cardEndowQaEnabled}
                onSelectCardEndow={handleSelectCardEndow}
                onSelectWalletEndow={handleSelectWalletEndow}
              />
            ))}
          </div>
          {selectedWalletEndowCampaign ? (
            <WalletEndowPanel
              campaign={selectedWalletEndowCampaign}
              onClose={handleCloseWalletEndow}
              onAmountChange={() => setWalletEndowAmount(null)}
              onContinueToWallet={setWalletEndowAmount}
            />
          ) : null}
          {selectedCardEndowCampaign ? (
            <Suspense
              fallback={
                <p className="mt-10 rounded-2xl bg-bg-white-0 p-4 text-sm leading-[1.55] text-text-sub-600 ring-1 ring-stroke-soft-200">
                  {formatMessage({
                    id: "public.vaults.cardEndow.loading",
                    defaultMessage: "Loading Card Endow QA...",
                  })}
                </p>
              }
            >
              <CardEndowPanel campaign={selectedCardEndowCampaign} onClose={handleCloseCardEndow} />
            </Suspense>
          ) : null}
          {selectedWalletEndowCampaign && walletEndowAmount ? (
            <WalletEndowRuntimePanel
              campaign={selectedWalletEndowCampaign}
              amount={walletEndowAmount}
              onClose={handleCloseWalletEndow}
            />
          ) : null}
        </div>
      </section>

      <section
        className="bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-vaults-boundary-title"
      >
        <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.boundary.kicker",
              defaultMessage: "§ 02 — Route boundary",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-vaults-boundary-title" size="sub">
            {formatMessage({
              id: "public.vaults.boundary.title",
              defaultMessage: "This is separate from Garden funding.",
            })}
          </EditorialHeading>
          <p className="mt-4 max-w-3xl text-sm leading-[1.65] text-text-sub-600 md:text-base">
            {formatMessage({
              id: "public.vaults.boundary.body",
              defaultMessage:
                "/vaults is the Octant V2 Ethereum vault crowdfunding surface. /fund remains the existing Garden endowment page and is only reuse context for later shared capability.",
            })}
          </p>
        </div>
      </section>

      <PublicFooter variant="soil" />
    </>
  );
}

export default function VaultsPage() {
  return <VaultsPageContent />;
}
