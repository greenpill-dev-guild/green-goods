import {
  aggregateCampaignCookieJarOperators,
  buildCampaignCookieJarMetadata,
  diffCampaignCookieJarAllowlist,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
  extractErrorMessage,
  FileUploadField,
  FormField,
  formatAddress,
  formatTokenAmount,
  getCampaignCookieJarPayoutAssets,
  getDefaultCampaignCookieJarPayoutAsset,
  logger,
  normalizeCampaignAddress,
  resolveIPFSUrl,
  Textarea,
  TextInput,
  toastService,
  type Address,
  type CampaignCookieJarCampaign,
  type CampaignCookieJarPayoutAsset,
  type CampaignCookieJarPayoutAssetId,
  type Garden,
  uploadFileToIPFS,
  useCampaignCookieJar,
  useCampaignCookieJarCampaigns,
  useCookieJarFactoryAddress,
  useCreateCampaignCookieJar,
  useCurrentChain,
  useGardens,
  useRole,
  useSyncCampaignCookieJarAllowlist,
  useUpdateCampaignCookieJarMetadata,
  useUser,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
  RiImageLine,
  RiRefreshLine,
  RiTimeLine,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useReadContracts } from "wagmi";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { AdminDialog } from "@/components/AdminDialog";
import {
  buildCampaignCookieJarCreatePayload,
  canCreateCampaignCookieJar,
  canSyncCampaignCookieJarAllowlist,
  filterCampaignCookieJarCampaigns,
  filterCampaignCookieJarGardens,
  getCampaignCookieJarPublicUrl,
  isValidCampaignCookieJarMetadataUrl,
  isUsableCampaignCookieJarTokenDecimals,
  orderCampaignCookieJarGardensForSelection,
  resolveCampaignCookieJarCreateFollowUp,
  resolveCampaignCookieJarManageDraft,
} from "../campaignCookieJarPanel.model";

const PUBLIC_COOKIE_BASE_URL = "https://greengoods.app/cookies";

function parseAmountInput(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

function publicJarLink(jarAddress: Address): string {
  return `${PUBLIC_COOKIE_BASE_URL}?jar=${jarAddress}`;
}

function haveSameAddressSet(left: readonly Address[], right: readonly Address[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map((address) => address.toLowerCase()));
  return left.every((address) => rightKeys.has(address.toLowerCase()));
}

function normalizeMetadataField(value: string | undefined): string {
  return value?.trim() ?? "";
}

function gardensForAggregation(gardens: readonly Garden[]) {
  return gardens.map((garden) => ({
    id: garden.id,
    name: garden.name,
    operators: garden.operators,
  }));
}

function formatCampaignDate(seconds: number | undefined, locale: string): string | null {
  if (!seconds) return null;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(seconds * 1000);
}

function formatSourceGardens(
  sourceGardens: readonly Address[],
  gardensByAddress: Map<string, Garden>
): string {
  if (sourceGardens.length === 0) return "";
  const names = sourceGardens
    .map((address) => gardensByAddress.get(address.toLowerCase())?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return `${sourceGardens.length} gardens`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} more`;
}

function GardenSelector({
  gardens,
  selectedGardenIds,
  onToggle,
  onSelectMany,
  onClear,
  search,
  setSearch,
  listClassName = "max-h-80 overflow-y-auto",
}: {
  gardens: readonly Garden[];
  selectedGardenIds: readonly string[];
  onToggle: (gardenId: string) => void;
  onSelectMany?: (gardenIds: string[]) => void;
  onClear?: () => void;
  search: string;
  setSearch: (value: string) => void;
  listClassName?: string;
}) {
  const { formatMessage } = useIntl();
  const selectedSet = useMemo(
    () => new Set(selectedGardenIds.map((id) => id.toLowerCase())),
    [selectedGardenIds]
  );
  const filteredGardens = useMemo(
    () => filterCampaignCookieJarGardens(gardens, search),
    [gardens, search]
  );
  const visibleGardens = useMemo(() => {
    return orderCampaignCookieJarGardensForSelection(gardens, selectedGardenIds, search);
  }, [gardens, search, selectedGardenIds]);
  const allVisibleSelected =
    filteredGardens.length > 0 &&
    filteredGardens.every((garden) => selectedSet.has(garden.id.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.searchGardens",
            defaultMessage: "Search gardens",
          })}
          htmlFor="campaign-cookie-jar-garden-search"
        >
          <TextInput
            id="campaign-cookie-jar-garden-search"
            surface="admin"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={formatMessage({
              id: "cockpit.community.cookies.searchGardensPlaceholder",
              defaultMessage: "Search by name, slug, or address",
            })}
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => onSelectMany?.(filteredGardens.map((garden) => garden.id))}
            disabled={!onSelectMany || filteredGardens.length === 0 || allVisibleSelected}
          >
            {formatMessage({
              id: "cockpit.community.cookies.selectVisibleGardens",
              defaultMessage: "Select visible",
            })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            onClick={onClear}
            disabled={!onClear || selectedGardenIds.length === 0}
          >
            {formatMessage({
              id: "cockpit.community.cookies.clearGardens",
              defaultMessage: "Clear",
            })}
          </AdminButton>
        </div>
      </div>
      <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
        {formatMessage(
          {
            id: "cockpit.community.cookies.gardenSelectorSummary",
            defaultMessage:
              "{selected, plural, one {# selected garden} other {# selected gardens}} - {visible, plural, one {# visible garden} other {# visible gardens}}",
          },
          { selected: selectedGardenIds.length, visible: filteredGardens.length }
        )}
      </p>
      <div
        className={`rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] ${listClassName}`}
      >
        {visibleGardens.length === 0 ? (
          <p className="p-4 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({
              id: "cockpit.community.cookies.noGardenMatches",
              defaultMessage: "No gardens match that search.",
            })}
          </p>
        ) : (
          visibleGardens.map((garden) => (
            <div
              key={garden.id}
              className="flex cursor-pointer items-start gap-3 border-b border-[rgb(var(--m3-outline-variant))] px-3 py-2.5 last:border-b-0"
            >
              <AdminCheckbox
                checked={selectedSet.has(garden.id.toLowerCase())}
                onChange={() => onToggle(garden.id)}
                label={garden.name}
                description={formatMessage(
                  {
                    id: "cockpit.community.cookies.operatorCount",
                    defaultMessage:
                      "{count, plural, one {# operator} other {# operators}} - {address}",
                  },
                  { count: garden.operators.length, address: formatAddress(garden.id) }
                )}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CampaignImageInput({
  value,
  onChange,
  file,
  onFileChange,
  disabled,
  source,
}: {
  value: string;
  onChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  source: string;
}) {
  const { formatMessage } = useIntl();
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const resolvedPreviewUrl = value ? resolveIPFSUrl(value) : "";

  const handleFilesChange = async (files: File[]) => {
    const nextFile = files[0];
    if (!nextFile) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadFileToIPFS(nextFile, { source });
      const imageUrl = resolveIPFSUrl(result.cid);
      onFileChange(nextFile);
      onChange(imageUrl);
      toastService.success({
        title: formatMessage({
          id: "cockpit.community.cookies.imageUploaded",
          defaultMessage: "Campaign image uploaded",
        }),
        message: formatMessage({
          id: "cockpit.community.cookies.imageUploadedMessage",
          defaultMessage: "The image is ready for this cookie jar.",
        }),
        context: "campaign cookie jar image upload",
        suppressLogging: true,
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      setUploadError(message);
      logger.error("Campaign cookie jar image upload failed", { error });
      toastService.error({
        title: formatMessage({
          id: "cockpit.community.cookies.imageUploadFailed",
          defaultMessage: "Image upload failed",
        }),
        message: formatMessage({
          id: "cockpit.community.cookies.imageUploadFailedMessage",
          defaultMessage: "Could not upload the campaign image. Try again or paste a URL.",
        }),
        context: "campaign cookie jar image upload",
        error,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <FileUploadField
        label={formatMessage({
          id: "cockpit.community.cookies.campaignImageUpload",
          defaultMessage: "Campaign image",
        })}
        helpText={formatMessage({
          id: "cockpit.community.cookies.campaignImageUploadHelp",
          defaultMessage: "Upload the campaign image. URL entry is available as a fallback.",
        })}
        accept="image/*"
        multiple={false}
        compress
        showPreview
        disabled={disabled || isUploading}
        onFilesChange={handleFilesChange}
        currentFiles={file ? [file] : []}
        onRemoveFile={() => {
          onFileChange(null);
          onChange("");
        }}
      />
      {isUploading ? (
        <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
          {formatMessage({
            id: "cockpit.community.cookies.imageUploading",
            defaultMessage: "Uploading campaign image...",
          })}
        </p>
      ) : null}
      {uploadError ? (
        <p className="text-body-sm text-[rgb(var(--m3-error))]">{uploadError}</p>
      ) : null}
      {resolvedPreviewUrl && !file ? (
        <div className="overflow-hidden rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))]">
          <img
            src={resolvedPreviewUrl}
            alt=""
            className="h-32 w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      <AdminButton
        type="button"
        variant="text"
        size="sm"
        onClick={() => setShowUrlFallback((current) => !current)}
      >
        {showUrlFallback
          ? formatMessage({
              id: "cockpit.community.cookies.hideImageUrl",
              defaultMessage: "Hide image URL",
            })
          : formatMessage({
              id: "cockpit.community.cookies.pasteImageUrl",
              defaultMessage: "Paste image URL",
            })}
      </AdminButton>
      {showUrlFallback ? (
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.campaignImage",
            defaultMessage: "Campaign image URL",
          })}
          htmlFor={`${source}-url`}
          error={
            value && !isValidCampaignCookieJarMetadataUrl(value)
              ? formatMessage({
                  id: "cockpit.community.cookies.invalidMetadataUrl",
                  defaultMessage: "Use an http(s), IPFS, or site-relative URL.",
                })
              : undefined
          }
        >
          <TextInput
            id={`${source}-url`}
            surface="admin"
            value={value}
            onChange={(event) => {
              onFileChange(null);
              onChange(event.target.value);
            }}
          />
        </FormField>
      ) : null}
    </div>
  );
}

function CampaignJarListRow({
  campaign,
  gardensByAddress,
  onSelect,
}: {
  campaign: CampaignCookieJarCampaign;
  gardensByAddress: Map<string, Garden>;
  onSelect: (campaign: CampaignCookieJarCampaign) => void;
}) {
  const { formatMessage, locale } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(campaign.address);
  const metadata = jar?.metadata ?? campaign.metadata;
  const title = metadata?.title ?? campaign.title ?? campaign.label;
  const description = metadata?.description;
  const sourceLabel = formatSourceGardens(metadata?.sourceGardens ?? [], gardensByAddress);
  const dateLabel = formatCampaignDate(campaign.createdAt, locale);
  const image = metadata?.image ? resolveIPFSUrl(metadata.image) : null;
  const balanceLabel = jar
    ? `${formatTokenAmount(jar.balance, jar.decimals, 4)} ${jar.symbol}`
    : isLoading
      ? formatMessage({
          id: "cockpit.community.cookies.rowReading",
          defaultMessage: "Reading...",
        })
      : formatMessage({
          id: "cockpit.community.cookies.rowUnavailable",
          defaultMessage: "Unavailable",
        });

  return (
    <button
      type="button"
      className="grid w-full gap-4 border-b border-[rgb(var(--m3-outline-variant))] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[rgb(var(--m3-on-surface)/0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))] sm:grid-cols-[4rem_minmax(0,1fr)_auto]"
      onClick={() => onSelect(campaign)}
      aria-label={formatMessage(
        {
          id: "cockpit.community.cookies.manageJarAria",
          defaultMessage: "Manage {title}",
        },
        { title }
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface-variant))]">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <RiImageLine className="h-6 w-6" aria-hidden />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
            {title}
          </h3>
          {hasDetailReadFailure ? (
            <span className="rounded-full bg-[rgb(var(--m3-error-container))] px-2 py-0.5 text-label-sm text-[rgb(var(--m3-on-error-container))]">
              {formatMessage({
                id: "cockpit.community.cookies.needsReview",
                defaultMessage: "Needs review",
              })}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="line-clamp-2 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {description}
          </p>
        ) : null}
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
          <span>{formatAddress(campaign.address)}</span>
          {sourceLabel ? <span>{sourceLabel}</span> : null}
          {dateLabel ? <span>{dateLabel}</span> : null}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-1 text-left sm:text-right">
        <p className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
          {balanceLabel}
        </p>
        <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
          {formatMessage({
            id: "cockpit.community.cookies.rowBalance",
            defaultMessage: "Jar balance",
          })}
        </p>
      </div>
    </button>
  );
}

function CampaignCookieJarAssetPicker({
  assets,
  selectedAssetId,
  onSelect,
}: {
  assets: readonly CampaignCookieJarPayoutAsset[];
  selectedAssetId: CampaignCookieJarPayoutAssetId | "custom";
  onSelect: (assetId: CampaignCookieJarPayoutAssetId) => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup">
      {assets.map((asset) => {
        const selected = selectedAssetId === asset.id;
        return (
          <button
            key={asset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!asset.supported}
            onClick={() => onSelect(asset.id)}
            className={[
              "min-h-[6rem] rounded-[var(--m3-shape-md)] border p-4 text-left transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
              selected
                ? "border-[rgb(var(--m3-primary))] bg-[rgb(var(--m3-primary-container)/0.45)]"
                : "border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))]",
              asset.supported
                ? "hover:border-[rgb(var(--m3-primary))]"
                : "cursor-not-allowed opacity-55",
            ].join(" ")}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                  {asset.label}
                </span>
                <span className="mt-1 block text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                  {formatMessage(
                    {
                      id: "cockpit.community.cookies.assetDecimals",
                      defaultMessage: "{symbol} - {decimals} decimals",
                    },
                    { symbol: asset.symbol, decimals: asset.decimals }
                  )}
                </span>
              </span>
              {selected ? (
                <span className="rounded-full bg-[rgb(var(--m3-primary))] px-2 py-0.5 text-label-sm text-[rgb(var(--m3-on-primary))]">
                  {formatMessage({ id: "app.action.selected", defaultMessage: "Selected" })}
                </span>
              ) : null}
            </span>
            <span className="mt-3 block break-all text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
              {asset.supported
                ? asset.address
                : formatMessage(
                    {
                      id: "cockpit.community.cookies.assetUnavailable",
                      defaultMessage: "{asset} is not available on this network yet.",
                    },
                    { asset: asset.label }
                  )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-[rgb(var(--m3-outline-variant))] py-3 last:border-b-0">
      <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">{label}</p>
      <p className="mt-1 break-words text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
        {value}
      </p>
    </div>
  );
}

function CampaignCookieJarCreatedState({
  jarAddress,
  onBackToList,
  onCreateAnother,
}: {
  jarAddress: Address;
  onBackToList: () => void;
  onCreateAnother: () => void;
}) {
  const { formatMessage } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(jarAddress);
  const publicUrl = publicJarLink(jarAddress);

  return (
    <section className="surface-section">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--m3-primary-container))] text-[rgb(var(--m3-on-primary-container))]">
              <RiCheckboxCircleLine className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCompleteEyebrow",
                  defaultMessage: "Transaction confirmed",
                })}
              </p>
              <h2 className="mt-1 text-headline-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCompleteTitle",
                  defaultMessage: "Cookie jar created",
                })}
              </h2>
              <p className="mt-2 max-w-2xl text-body-md text-[rgb(var(--m3-on-surface-variant))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCompleteDescription",
                  defaultMessage:
                    "The jar address was captured from the confirmed transaction and is queryable onchain. It may take the indexer a moment to show it in the campaign list.",
                })}
              </p>
            </div>
          </div>

          <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-4">
            <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.jarAddress",
                defaultMessage: "Jar address",
              })}
            </p>
            <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {jarAddress}
            </p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 break-all text-label-md text-[rgb(var(--m3-primary))] underline-offset-4 hover:underline"
            >
              {publicUrl}
              <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            <AdminButton type="button" leadingIcon={<RiArrowLeftLine />} onClick={onBackToList}>
              {formatMessage({
                id: "cockpit.community.cookies.backToJars",
                defaultMessage: "Back to cookie jars",
              })}
            </AdminButton>
            <AdminButton type="button" variant="outlined" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                {formatMessage({
                  id: "cockpit.community.cookies.openPublicLink",
                  defaultMessage: "Open public link",
                })}
              </a>
            </AdminButton>
            <AdminButton
              type="button"
              variant="text"
              leadingIcon={<RiAddLine />}
              onClick={onCreateAnother}
            >
              {formatMessage({
                id: "cockpit.community.cookies.createAnother",
                defaultMessage: "Create another",
              })}
            </AdminButton>
          </div>
        </div>

        <AdminCard variant="outlined" className="space-y-3">
          <h3 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.onchainReadTitle",
              defaultMessage: "Onchain read",
            })}
          </h3>
          {isLoading ? (
            <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.onchainReadLoading",
                defaultMessage: "Reading jar details...",
              })}
            </p>
          ) : jar ? (
            <div>
              <ReviewLine
                label={formatMessage({
                  id: "cockpit.community.cookies.rowBalance",
                  defaultMessage: "Jar balance",
                })}
                value={`${formatTokenAmount(jar.balance, jar.decimals, 4)} ${jar.symbol}`}
              />
              <ReviewLine
                label={formatMessage({
                  id: "cockpit.community.cookies.claimAmountPerOperator",
                  defaultMessage: "Claim amount per operator",
                })}
                value={`${formatTokenAmount(jar.fixedAmount, jar.decimals, 4)} ${jar.symbol}`}
              />
              <ReviewLine
                label={formatMessage({
                  id: "cockpit.community.cookies.generatedOperators",
                  defaultMessage: "Generated operators",
                })}
                value={jar.allowlist.length}
              />
            </div>
          ) : (
            <p className="text-body-sm text-[rgb(var(--m3-error))]">
              {formatMessage({
                id: "cockpit.community.cookies.onchainReadUnavailable",
                defaultMessage:
                  "The jar was created, but this browser could not read the jar details yet.",
              })}
            </p>
          )}
          {hasDetailReadFailure ? (
            <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.onchainReadPartial",
                defaultMessage:
                  "Some optional metadata reads failed. The direct jar link still works.",
              })}
            </p>
          ) : null}
        </AdminCard>
      </div>
    </section>
  );
}

function CampaignCookieJarSubmittedState({
  hash,
  manualInput,
  manualAddress,
  onManualInputChange,
  onUseManualAddress,
  onBackToList,
}: {
  hash: string;
  manualInput: string;
  manualAddress: Address | null;
  onManualInputChange: (value: string) => void;
  onUseManualAddress: () => void;
  onBackToList: () => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <section className="surface-section">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))]">
            <RiTimeLine className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmittedEyebrow",
                defaultMessage: "Submitted",
              })}
            </p>
            <h2 className="mt-1 text-headline-sm font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmitted",
                defaultMessage: "Creation submitted",
              })}
            </h2>
            <p className="mt-2 max-w-2xl text-body-md text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmittedDescription",
                defaultMessage:
                  "The wallet returned a submitted transaction without a final jar address. Once the transaction is executed, paste the created jar address to generate the public link and seed the sync form.",
              })}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-4">
          <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.submittedTransaction",
              defaultMessage: "Submitted transaction",
            })}
          </p>
          <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {hash}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <FormField
            label={formatMessage({
              id: "cockpit.community.cookies.createdJarAddressInput",
              defaultMessage: "Created jar address",
            })}
            htmlFor="campaign-cookie-jar-created-address"
            error={
              manualInput && !manualAddress
                ? formatMessage({
                    id: "cockpit.community.cookies.invalidAddress",
                    defaultMessage: "Enter a valid Ethereum address.",
                  })
                : undefined
            }
          >
            <TextInput
              id="campaign-cookie-jar-created-address"
              surface="admin"
              value={manualInput}
              onChange={(event) => onManualInputChange(event.target.value)}
            />
          </FormField>
          <AdminButton type="button" onClick={onUseManualAddress} disabled={!manualAddress}>
            {formatMessage({
              id: "cockpit.community.cookies.useCreatedJar",
              defaultMessage: "Use jar address",
            })}
          </AdminButton>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminButton type="button" variant="outlined" onClick={onBackToList}>
            {formatMessage({
              id: "cockpit.community.cookies.backToJars",
              defaultMessage: "Back to cookie jars",
            })}
          </AdminButton>
        </div>
      </div>
    </section>
  );
}

interface CampaignCookieJarCreateWorkspaceProps {
  onCancel: () => void;
  initialCreatedJarAddress?: Address;
  initialSubmittedHash?: string;
}

export function CampaignCookieJarCreateWorkspace({
  onCancel,
  initialCreatedJarAddress,
  initialSubmittedHash,
}: CampaignCookieJarCreateWorkspaceProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const { isDeployer, loading: roleLoading } = useRole();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens(chainId);
  const {
    factoryAddress,
    moduleConfigured,
    isLoading: factoryLoading,
  } = useCookieJarFactoryAddress();
  const createJar = useCreateCampaignCookieJar({ errorMode: "inline" });

  const payoutAssets = useMemo(() => getCampaignCookieJarPayoutAssets(chainId), [chainId]);
  const defaultPayoutAsset = useMemo(
    () => getDefaultCampaignCookieJarPayoutAsset(chainId),
    [chainId]
  );

  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignImage, setCampaignImage] = useState("");
  const [campaignImageFile, setCampaignImageFile] = useState<File | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<CampaignCookieJarPayoutAssetId | "custom">(
    defaultPayoutAsset?.id ?? "usdc"
  );
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [withdrawalIntervalDays, setWithdrawalIntervalDays] = useState("0");
  const [jarOwner, setJarOwner] = useState("");
  const [selectedGardenIds, setSelectedGardenIds] = useState<string[]>([]);
  const [gardenSearch, setGardenSearch] = useState("");
  const [extraAddresses, setExtraAddresses] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createdJarAddress, setCreatedJarAddress] = useState<Address | null>(
    initialCreatedJarAddress ?? null
  );
  const [createdJarPendingHash, setCreatedJarPendingHash] = useState<string | null>(
    initialSubmittedHash ?? null
  );
  const [createdJarManualInput, setCreatedJarManualInput] = useState("");
  const completionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedAssetId === "custom") return;
    const selectedAsset = payoutAssets.find((asset) => asset.id === selectedAssetId);
    if (selectedAsset?.supported) return;
    if (defaultPayoutAsset) setSelectedAssetId(defaultPayoutAsset.id);
  }, [defaultPayoutAsset, payoutAssets, selectedAssetId]);

  useEffect(() => {
    setJarOwner((current) => current || primaryAddress || "");
  }, [primaryAddress]);

  const selectedRegistryAsset =
    selectedAssetId === "custom"
      ? null
      : (payoutAssets.find((asset) => asset.id === selectedAssetId) ?? null);
  const normalizedCustomTokenAddress = normalizeCampaignAddress(customTokenAddress);
  const tokenInfoQuery = useReadContracts({
    contracts:
      selectedAssetId === "custom" && normalizedCustomTokenAddress
        ? [
            {
              address: normalizedCustomTokenAddress,
              abi: ERC20_DECIMALS_ABI,
              functionName: "decimals" as const,
            },
            {
              address: normalizedCustomTokenAddress,
              abi: ERC20_SYMBOL_ABI,
              functionName: "symbol" as const,
            },
          ]
        : [],
    allowFailure: true,
    query: {
      enabled: selectedAssetId === "custom" && Boolean(normalizedCustomTokenAddress),
    },
  });
  const customTokenDecimalsValue = tokenInfoQuery.data?.[0]?.result;
  const customTokenDecimalsConfirmed =
    selectedAssetId === "custom" &&
    isUsableCampaignCookieJarTokenDecimals(customTokenDecimalsValue);
  const tokenDecimals =
    selectedAssetId === "custom"
      ? customTokenDecimalsConfirmed
        ? customTokenDecimalsValue
        : 18
      : (selectedRegistryAsset?.decimals ?? 18);
  const tokenSymbol =
    selectedAssetId === "custom"
      ? ((tokenInfoQuery.data?.[1]?.result as string | undefined) ?? "")
      : (selectedRegistryAsset?.symbol ?? "");
  const tokenAddress =
    selectedAssetId === "custom"
      ? normalizedCustomTokenAddress
      : (selectedRegistryAsset?.address ?? null);
  const tokenDecimalsConfirmed =
    selectedAssetId === "custom"
      ? customTokenDecimalsConfirmed
      : Boolean(selectedRegistryAsset?.supported && selectedRegistryAsset.address);
  const customTokenLoading =
    selectedAssetId === "custom" &&
    Boolean(normalizedCustomTokenAddress) &&
    (tokenInfoQuery.isLoading || tokenInfoQuery.isFetching);
  const customTokenError =
    selectedAssetId === "custom" &&
    Boolean(normalizedCustomTokenAddress) &&
    !customTokenLoading &&
    !customTokenDecimalsConfirmed;
  const publicCampaignUrl = getCampaignCookieJarPublicUrl(campaignTitle);
  const metadataUrlsValid = isValidCampaignCookieJarMetadataUrl(campaignImage);
  const aggregation = useMemo(
    () =>
      aggregateCampaignCookieJarOperators({
        gardens: gardensForAggregation(gardens),
        selectedGardenIds,
        extraAddressesInput: extraAddresses,
      }),
    [extraAddresses, gardens, selectedGardenIds]
  );
  const parsedClaimAmount = parseAmountInput(claimAmount, tokenDecimals);
  const normalizedJarOwner = normalizeCampaignAddress(jarOwner);
  const createdJarManualAddress = normalizeCampaignAddress(createdJarManualInput);
  const canCreate = canCreateCampaignCookieJar({
    factoryAddress,
    tokenAddress,
    tokenDecimalsConfirmed,
    jarOwner: normalizedJarOwner,
    campaignTitle,
    hasValidClaimConfig: Boolean(parsedClaimAmount),
    allowlistCount: aggregation.allowlist.length,
    invalidAddressCount: aggregation.invalidAddresses.length,
    metadataUrlsValid,
    isDeployer,
  });
  const payoutLabel =
    parsedClaimAmount && tokenSymbol
      ? `${formatTokenAmount(parsedClaimAmount, tokenDecimals, 4)} ${tokenSymbol}`
      : tokenSymbol || "--";

  const toggleGarden = (gardenId: string) => {
    setSelectedGardenIds((current) =>
      current.some((id) => id.toLowerCase() === gardenId.toLowerCase())
        ? current.filter((id) => id.toLowerCase() !== gardenId.toLowerCase())
        : [...current, gardenId]
    );
  };

  const selectGardens = (gardenIds: string[]) => {
    setSelectedGardenIds((current) => {
      const seen = new Set(current.map((id) => id.toLowerCase()));
      const next = [...current];
      for (const gardenId of gardenIds) {
        const key = gardenId.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(gardenId);
      }
      return next;
    });
  };

  const applyCreatedJarAddress = (jarAddress: Address) => {
    setCreatedJarAddress(jarAddress);
    setCreatedJarPendingHash(null);
    setCreatedJarManualInput("");
  };

  const resetCreateForm = () => {
    setCampaignTitle("");
    setCampaignDescription("");
    setCampaignImage("");
    setCampaignImageFile(null);
    setSelectedAssetId(defaultPayoutAsset?.id ?? "usdc");
    setCustomTokenAddress("");
    setClaimAmount("");
    setWithdrawalIntervalDays("0");
    setJarOwner(primaryAddress || "");
    setSelectedGardenIds([]);
    setGardenSearch("");
    setExtraAddresses("");
    setAdvancedOpen(false);
    setCreatedJarAddress(null);
    setCreatedJarPendingHash(null);
    setCreatedJarManualInput("");
    createJar.reset();
  };

  useEffect(() => {
    if (!createdJarAddress && !createdJarPendingHash) return;
    completionRef.current?.scrollIntoView({ block: "start" });
  }, [createdJarAddress, createdJarPendingHash]);

  const handleCreate = () => {
    if (
      !canCreate ||
      !factoryAddress ||
      !tokenAddress ||
      !normalizedJarOwner ||
      !parsedClaimAmount
    ) {
      return;
    }
    const intervalDays = Number(withdrawalIntervalDays);
    createJar.mutate(
      buildCampaignCookieJarCreatePayload({
        factoryAddress,
        campaignTitle,
        campaignDescription,
        campaignImage,
        campaignExternalUrl: publicCampaignUrl,
        tokenAddress,
        jarOwner: normalizedJarOwner,
        allowlist: aggregation.allowlist,
        sourceGardens: aggregation.sources.map((source) => source.gardenAddress),
        extraAllowlist: aggregation.extraAllowlist,
        fixedAmount: parsedClaimAmount,
        withdrawalInterval:
          Number.isFinite(intervalDays) && intervalDays > 0
            ? BigInt(Math.floor(intervalDays * 86400))
            : 0n,
      }),
      {
        onSuccess: (result) => {
          const followUp = resolveCampaignCookieJarCreateFollowUp(result);
          if (followUp.kind === "ready") {
            applyCreatedJarAddress(followUp.jarAddress);
          } else {
            setCreatedJarAddress(null);
            setCreatedJarPendingHash(followUp.hash);
          }
        },
      }
    );
  };

  if (createdJarAddress) {
    return (
      <div ref={completionRef}>
        <CampaignCookieJarCreatedState
          jarAddress={createdJarAddress}
          onBackToList={onCancel}
          onCreateAnother={resetCreateForm}
        />
      </div>
    );
  }

  if (createdJarPendingHash) {
    return (
      <div ref={completionRef}>
        <CampaignCookieJarSubmittedState
          hash={createdJarPendingHash}
          manualInput={createdJarManualInput}
          manualAddress={createdJarManualAddress}
          onManualInputChange={setCreatedJarManualInput}
          onUseManualAddress={() => {
            if (!createdJarManualAddress) return;
            applyCreatedJarAddress(createdJarManualAddress);
          }}
          onBackToList={onCancel}
        />
      </div>
    );
  }

  return (
    <div className="relative pb-32 lg:pb-0">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-5">
          {!moduleConfigured ? (
            <AdminCard
              variant="outlined"
              className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
            >
              {formatMessage({
                id: "cockpit.community.cookies.factoryMissing",
                defaultMessage:
                  "Cookie Jar factory discovery is not configured on this network yet.",
              })}
            </AdminCard>
          ) : null}

          {!isDeployer && !roleLoading ? (
            <AdminCard
              variant="outlined"
              className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
            >
              {formatMessage({
                id: "cockpit.community.cookies.deployerOnly",
                defaultMessage:
                  "This surface is intended for deployer and ops wallets. Connect a deployer wallet to create and manage campaign cookie jars.",
              })}
            </AdminCard>
          ) : null}

          {createJar.error ? (
            <AdminCard
              variant="outlined"
              className="border-[rgb(var(--m3-error))] text-body-sm text-[rgb(var(--m3-error))]"
              role="alert"
            >
              {createJar.error.message}
            </AdminCard>
          ) : null}

          <section className="surface-section overflow-visible">
            <div className="mb-4">
              <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">01</p>
              <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCampaignSection",
                  defaultMessage: "Campaign",
                })}
              </h2>
            </div>
            <div className="grid gap-4">
              <FormField
                label={formatMessage({
                  id: "cockpit.community.cookies.campaignName",
                  defaultMessage: "Campaign name",
                })}
                htmlFor="campaign-cookie-jar-title"
              >
                <TextInput
                  id="campaign-cookie-jar-title"
                  surface="admin"
                  value={campaignTitle}
                  onChange={(event) => setCampaignTitle(event.target.value)}
                />
              </FormField>
              <FormField
                label={formatMessage({
                  id: "cockpit.community.cookies.campaignDescription",
                  defaultMessage: "Campaign description",
                })}
                htmlFor="campaign-cookie-jar-description"
              >
                <Textarea
                  id="campaign-cookie-jar-description"
                  surface="admin"
                  value={campaignDescription}
                  onChange={(event) => setCampaignDescription(event.target.value)}
                />
              </FormField>
              <CampaignImageInput
                value={campaignImage}
                onChange={setCampaignImage}
                file={campaignImageFile}
                onFileChange={setCampaignImageFile}
                disabled={createJar.isPending}
                source="campaign-cookie-jar-create-image"
              />
              <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-3">
                <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
                  {formatMessage({
                    id: "cockpit.community.cookies.generatedCampaignLink",
                    defaultMessage: "Campaign page",
                  })}
                </p>
                <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                  {publicCampaignUrl}
                </p>
              </div>
            </div>
          </section>

          <section className="surface-section overflow-visible">
            <div className="mb-4">
              <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">02</p>
              <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createPayoutSection",
                  defaultMessage: "Payout",
                })}
              </h2>
            </div>
            <div className="space-y-4">
              <CampaignCookieJarAssetPicker
                assets={payoutAssets}
                selectedAssetId={selectedAssetId}
                onSelect={setSelectedAssetId}
              />
              <FormField
                label={formatMessage({
                  id: "cockpit.community.cookies.claimAmountPerOperator",
                  defaultMessage: "Claim amount per operator",
                })}
                htmlFor="campaign-cookie-jar-claim-amount"
              >
                <div className="flex items-center gap-2">
                  <TextInput
                    id="campaign-cookie-jar-claim-amount"
                    surface="admin"
                    inputMode="decimal"
                    value={claimAmount}
                    onChange={(event) => setClaimAmount(event.target.value)}
                    placeholder="0.00"
                  />
                  <span className="inline-flex min-h-11 items-center rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] px-3 text-label-md text-[rgb(var(--m3-on-surface-variant))]">
                    {tokenSymbol || "TOKEN"}
                  </span>
                </div>
              </FormField>
            </div>
          </section>

          <section className="surface-section overflow-visible">
            <div className="mb-4">
              <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">03</p>
              <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createGardensSection",
                  defaultMessage: "Eligible gardens",
                })}
              </h2>
            </div>
            <GardenSelector
              gardens={gardens}
              selectedGardenIds={selectedGardenIds}
              onToggle={toggleGarden}
              onSelectMany={selectGardens}
              onClear={() => setSelectedGardenIds([])}
              search={gardenSearch}
              setSearch={setGardenSearch}
              listClassName="overflow-visible"
            />
            {aggregation.missingOperatorGardens.length > 0 ? (
              <p className="mt-3 text-body-sm text-[rgb(var(--m3-error))]">
                {formatMessage(
                  {
                    id: "cockpit.community.cookies.missingOperatorsSummary",
                    defaultMessage:
                      "{count, plural, one {# selected garden has no operator} other {# selected gardens have no operator}}.",
                  },
                  { count: aggregation.missingOperatorGardens.length }
                )}
              </p>
            ) : null}
          </section>

          <section className="surface-section overflow-visible">
            <details
              open={advancedOpen}
              onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.advanced",
                  defaultMessage: "Advanced",
                })}
              </summary>
              {advancedOpen ? (
                <div className="mt-4 grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      type="button"
                      variant={selectedAssetId === "custom" ? "tonal" : "outlined"}
                      size="sm"
                      onClick={() => setSelectedAssetId("custom")}
                    >
                      {formatMessage({
                        id: "cockpit.community.cookies.useCustomToken",
                        defaultMessage: "Use custom token",
                      })}
                    </AdminButton>
                    {selectedAssetId === "custom" && defaultPayoutAsset ? (
                      <AdminButton
                        type="button"
                        variant="text"
                        size="sm"
                        onClick={() => setSelectedAssetId(defaultPayoutAsset.id)}
                      >
                        {formatMessage({
                          id: "cockpit.community.cookies.useDefaultAssets",
                          defaultMessage: "Use default assets",
                        })}
                      </AdminButton>
                    ) : null}
                  </div>
                  {selectedAssetId === "custom" ? (
                    <FormField
                      label={formatMessage({
                        id: "cockpit.community.cookies.tokenAddress",
                        defaultMessage: "ERC20 token address",
                      })}
                      htmlFor="campaign-cookie-jar-custom-token"
                      hint={
                        tokenSymbol
                          ? formatMessage(
                              {
                                id: "cockpit.community.cookies.tokenInfo",
                                defaultMessage: "{symbol}, {decimals} decimals",
                              },
                              { symbol: tokenSymbol, decimals: tokenDecimals }
                            )
                          : customTokenLoading
                            ? formatMessage({
                                id: "cockpit.community.cookies.tokenInfoLoading",
                                defaultMessage: "Reading token decimals...",
                              })
                            : undefined
                      }
                      error={
                        customTokenAddress && !normalizedCustomTokenAddress
                          ? formatMessage({
                              id: "cockpit.community.cookies.invalidAddress",
                              defaultMessage: "Enter a valid Ethereum address.",
                            })
                          : customTokenError
                            ? formatMessage({
                                id: "cockpit.community.cookies.tokenDecimalsRequired",
                                defaultMessage:
                                  "Token decimals could not be read. Check the ERC20 address and try again.",
                              })
                            : undefined
                      }
                    >
                      <TextInput
                        id="campaign-cookie-jar-custom-token"
                        surface="admin"
                        value={customTokenAddress}
                        onChange={(event) => setCustomTokenAddress(event.target.value)}
                      />
                    </FormField>
                  ) : null}
                  <FormField
                    label={formatMessage({
                      id: "cockpit.community.cookies.owner",
                      defaultMessage: "Jar owner",
                    })}
                    htmlFor="campaign-cookie-jar-owner"
                    error={
                      jarOwner && !normalizedJarOwner
                        ? formatMessage({
                            id: "cockpit.community.cookies.invalidAddress",
                            defaultMessage: "Enter a valid Ethereum address.",
                          })
                        : undefined
                    }
                  >
                    <TextInput
                      id="campaign-cookie-jar-owner"
                      surface="admin"
                      value={jarOwner}
                      onChange={(event) => setJarOwner(event.target.value)}
                    />
                  </FormField>
                  <FormField
                    label={formatMessage({
                      id: "cockpit.community.cookies.cooldownDays",
                      defaultMessage: "Cooldown days",
                    })}
                    htmlFor="campaign-cookie-jar-cooldown"
                  >
                    <TextInput
                      id="campaign-cookie-jar-cooldown"
                      surface="admin"
                      inputMode="numeric"
                      value={withdrawalIntervalDays}
                      onChange={(event) => setWithdrawalIntervalDays(event.target.value)}
                    />
                  </FormField>
                  <FormField
                    label={formatMessage({
                      id: "cockpit.community.cookies.extraAddresses",
                      defaultMessage: "Extra allowlist addresses",
                    })}
                    htmlFor="campaign-cookie-jar-extra-addresses"
                    error={
                      aggregation.invalidAddresses.length > 0
                        ? formatMessage(
                            {
                              id: "cockpit.community.cookies.invalidExtras",
                              defaultMessage: "Invalid addresses: {addresses}",
                            },
                            { addresses: aggregation.invalidAddresses.join(", ") }
                          )
                        : undefined
                    }
                  >
                    <Textarea
                      id="campaign-cookie-jar-extra-addresses"
                      surface="admin"
                      value={extraAddresses}
                      onChange={(event) => setExtraAddresses(event.target.value)}
                      placeholder={formatMessage({
                        id: "cockpit.community.cookies.extraPlaceholder",
                        defaultMessage: "Paste addresses separated by commas, spaces, or new lines",
                      })}
                    />
                  </FormField>
                </div>
              ) : null}
            </details>
          </section>
        </div>

        <aside className="sticky top-20 hidden space-y-4 lg:block">
          <AdminCard variant="outlined" className="space-y-2">
            <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.review",
                defaultMessage: "Review",
              })}
            </h2>
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.reviewPayout",
                defaultMessage: "Payout",
              })}
              value={payoutLabel}
            />
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.selectedGardens",
                defaultMessage: "Selected gardens",
              })}
              value={aggregation.sources.length}
            />
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.generatedOperators",
                defaultMessage: "Generated operators",
              })}
              value={aggregation.allowlist.length}
            />
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.missingOperators",
                defaultMessage: "Missing operators",
              })}
              value={aggregation.missingOperatorGardens.length}
            />
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.generatedCampaignLink",
                defaultMessage: "Campaign page",
              })}
              value={publicCampaignUrl}
            />
            <div className="pt-3">
              <AdminButton
                type="button"
                className="w-full"
                onClick={handleCreate}
                disabled={!canCreate || createJar.isPending || gardensLoading || factoryLoading}
                loading={createJar.isPending}
              >
                {formatMessage({
                  id: "cockpit.community.cookies.create",
                  defaultMessage: "Create cookie jar",
                })}
              </AdminButton>
              <AdminButton type="button" variant="text" className="mt-2 w-full" onClick={onCancel}>
                {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
              </AdminButton>
            </div>
            {createJar.error ? (
              <p className="text-body-sm text-[rgb(var(--m3-error))]">{createJar.error.message}</p>
            ) : null}
          </AdminCard>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-sticky border-t border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-high))] p-3 shadow-[var(--m3-elevation-3)] lg:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-label-md font-semibold text-[rgb(var(--m3-on-surface))]">
              {payoutLabel}
            </p>
            <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage(
                {
                  id: "cockpit.community.cookies.mobileReviewSummary",
                  defaultMessage:
                    "{gardens, plural, one {# garden} other {# gardens}} - {operators, plural, one {# operator} other {# operators}}",
                },
                { gardens: aggregation.sources.length, operators: aggregation.allowlist.length }
              )}
            </p>
          </div>
          <AdminButton
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || createJar.isPending || gardensLoading || factoryLoading}
            loading={createJar.isPending}
          >
            {formatMessage({
              id: "cockpit.community.cookies.create",
              defaultMessage: "Create cookie jar",
            })}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export function CampaignCookieJarPanel() {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { isDeployer, loading: roleLoading } = useRole();
  const { data: gardens = [] } = useGardens(chainId);
  const {
    campaigns,
    isLoading: campaignsLoading,
    error: campaignsError,
  } = useCampaignCookieJarCampaigns();
  const { factoryAddress, moduleConfigured } = useCookieJarFactoryAddress();
  const syncAllowlist = useSyncCampaignCookieJarAllowlist({ errorMode: "inline" });
  const updateMetadata = useUpdateCampaignCookieJarMetadata({ errorMode: "inline" });

  const [campaignSearch, setCampaignSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignCookieJarCampaign | null>(null);
  const [syncGardenIds, setSyncGardenIds] = useState<string[]>([]);
  const [syncGardenSearch, setSyncGardenSearch] = useState("");
  const [syncExtraAddresses, setSyncExtraAddresses] = useState("");
  const [syncCampaignDescription, setSyncCampaignDescription] = useState("");
  const [syncCampaignImage, setSyncCampaignImage] = useState("");
  const [syncCampaignImageFile, setSyncCampaignImageFile] = useState<File | null>(null);
  const selectedJarAddress = selectedCampaign?.address;
  const syncJar = useCampaignCookieJar(selectedJarAddress, {
    enabled: Boolean(selectedJarAddress),
  });

  useEffect(() => {
    if (!selectedCampaign) return;
    const draft = resolveCampaignCookieJarManageDraft(selectedCampaign, syncJar.jar?.metadata);
    setSyncGardenIds(draft.selectedGardenIds);
    setSyncExtraAddresses(draft.extraAddresses);
    setSyncCampaignDescription(draft.description);
    setSyncCampaignImage(draft.image);
    setSyncCampaignImageFile(null);
  }, [selectedCampaign, syncJar.jar?.metadata]);

  const gardensByAddress = useMemo(() => {
    const map = new Map<string, Garden>();
    for (const garden of gardens) {
      map.set(garden.id.toLowerCase(), garden);
    }
    return map;
  }, [gardens]);

  const visibleCampaigns = useMemo(
    () => filterCampaignCookieJarCampaigns(campaigns, campaignSearch),
    [campaignSearch, campaigns]
  );

  const syncMetadataUrlsValid = isValidCampaignCookieJarMetadataUrl(syncCampaignImage);
  const syncAggregation = useMemo(
    () =>
      aggregateCampaignCookieJarOperators({
        gardens: gardensForAggregation(gardens),
        selectedGardenIds: syncGardenIds,
        extraAddressesInput: syncExtraAddresses,
      }),
    [gardens, syncExtraAddresses, syncGardenIds]
  );
  const syncDiff = useMemo(
    () =>
      diffCampaignCookieJarAllowlist({
        current: syncJar.jar?.allowlist ?? [],
        desired: syncAggregation.allowlist,
      }),
    [syncAggregation.allowlist, syncJar.jar?.allowlist]
  );
  const syncSourceGardens = useMemo(
    () => syncAggregation.sources.map((source) => source.gardenAddress),
    [syncAggregation.sources]
  );
  const selectedCampaignSlug =
    syncJar.jar?.metadata?.slug ?? selectedCampaign?.metadata?.slug ?? selectedCampaign?.slug ?? "";
  const selectedCampaignPublicUrl = selectedCampaignSlug
    ? `${PUBLIC_COOKIE_BASE_URL}?campaign=${selectedCampaignSlug}`
    : selectedCampaign
      ? getCampaignCookieJarPublicUrl(selectedCampaign.title ?? selectedCampaign.label)
      : "";
  const syncMetadataChanged = useMemo(() => {
    if (!selectedCampaign || !syncJar.jar) return false;
    const currentMetadata = syncJar.jar.metadata ?? selectedCampaign.metadata;
    if (!currentMetadata) return true;

    return (
      !haveSameAddressSet(currentMetadata.sourceGardens, syncSourceGardens) ||
      !haveSameAddressSet(currentMetadata.extraAllowlist, syncAggregation.extraAllowlist) ||
      normalizeMetadataField(currentMetadata.description) !==
        normalizeMetadataField(syncCampaignDescription) ||
      normalizeMetadataField(currentMetadata.image) !== normalizeMetadataField(syncCampaignImage) ||
      normalizeMetadataField(currentMetadata.externalUrl) !==
        normalizeMetadataField(selectedCampaignPublicUrl)
    );
  }, [
    selectedCampaign,
    syncAggregation.extraAllowlist,
    syncCampaignDescription,
    syncCampaignImage,
    selectedCampaignPublicUrl,
    syncJar.jar,
    syncSourceGardens,
  ]);
  const syncMetadataPayload = useMemo(() => {
    if (!selectedCampaign || !syncJar.jar || !factoryAddress || !syncMetadataChanged) return null;
    const currentMetadata = syncJar.jar.metadata ?? selectedCampaign.metadata;

    return JSON.stringify(
      buildCampaignCookieJarMetadata({
        title:
          currentMetadata?.title ??
          selectedCampaign.title ??
          formatMessage({
            id: "cockpit.community.cookies.untitledCampaign",
            defaultMessage: "Campaign cookie jar",
          }),
        slug: currentMetadata?.slug ?? selectedCampaign.slug,
        description: syncCampaignDescription,
        image: syncCampaignImage,
        externalUrl: selectedCampaignPublicUrl,
        sourceGardens: syncSourceGardens,
        extraAllowlist: syncAggregation.extraAllowlist,
        chainId,
        createdAt: currentMetadata?.createdAt,
      })
    );
  }, [
    chainId,
    factoryAddress,
    formatMessage,
    selectedCampaign,
    syncAggregation.extraAllowlist,
    syncCampaignDescription,
    syncCampaignImage,
    selectedCampaignPublicUrl,
    syncJar.jar,
    syncMetadataChanged,
    syncSourceGardens,
  ]);

  const toggleSyncGarden = (gardenId: string) => {
    setSyncGardenIds((current) =>
      current.some((id) => id.toLowerCase() === gardenId.toLowerCase())
        ? current.filter((id) => id.toLowerCase() !== gardenId.toLowerCase())
        : [...current, gardenId]
    );
  };

  const selectSyncGardens = (gardenIds: string[]) => {
    setSyncGardenIds((current) => {
      const seen = new Set(current.map((id) => id.toLowerCase()));
      const next = [...current];
      for (const gardenId of gardenIds) {
        const key = gardenId.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(gardenId);
      }
      return next;
    });
  };

  const canSync = canSyncCampaignCookieJarAllowlist({
    jarAddress: selectedJarAddress,
    isJarOwner: Boolean(syncJar.jar?.isOwner),
    invalidAddressCount: syncAggregation.invalidAddresses.length,
    grantCount: syncDiff.grant.length,
    revokeCount: syncDiff.revoke.length,
    metadataChanged: syncMetadataChanged,
    canUpdateMetadata: Boolean(factoryAddress),
    metadataUrlsValid: syncMetadataUrlsValid,
  });

  const handleSync = () => {
    if (!selectedJarAddress || !canSync) return;
    const hasAllowlistDiff = syncDiff.grant.length > 0 || syncDiff.revoke.length > 0;
    if (!hasAllowlistDiff) {
      if (!factoryAddress || !syncMetadataPayload) return;
      updateMetadata.mutate({
        factoryAddress,
        jarAddress: selectedJarAddress,
        metadata: syncMetadataPayload,
      });
      return;
    }

    syncAllowlist.mutate(
      {
        jarAddress: selectedJarAddress,
        grant: syncDiff.grant,
        revoke: syncDiff.revoke,
      },
      {
        onSuccess: () => {
          if (!factoryAddress || !syncMetadataPayload) return;
          updateMetadata.mutate({
            factoryAddress,
            jarAddress: selectedJarAddress,
            metadata: syncMetadataPayload,
          });
        },
      }
    );
  };

  const selectedCampaignTitle =
    syncJar.jar?.metadata?.title ??
    selectedCampaign?.metadata?.title ??
    selectedCampaign?.title ??
    selectedCampaign?.label ??
    formatMessage({
      id: "cockpit.community.cookies.untitledCampaign",
      defaultMessage: "Campaign cookie jar",
    });

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col gap-5">
      {!moduleConfigured ? (
        <AdminCard
          variant="outlined"
          className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
        >
          {formatMessage({
            id: "cockpit.community.cookies.factoryMissing",
            defaultMessage: "Cookie Jar factory discovery is not configured on this network yet.",
          })}
        </AdminCard>
      ) : null}

      {!isDeployer && !roleLoading ? (
        <AdminCard
          variant="outlined"
          className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
        >
          {formatMessage({
            id: "cockpit.community.cookies.deployerOnly",
            defaultMessage:
              "This surface is intended for deployer and ops wallets. Connect a deployer wallet to create and manage campaign cookie jars.",
          })}
        </AdminCard>
      ) : null}

      <AdminCard
        variant="outlined"
        className="flex min-h-[32rem] flex-1 flex-col overflow-hidden p-0"
      >
        <div className="border-b border-[rgb(var(--m3-outline-variant))] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
            <div>
              <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.listTitle",
                  defaultMessage: "Cookie jar campaigns",
                })}
              </h2>
              <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                {formatMessage(
                  {
                    id: "cockpit.community.cookies.listDescription",
                    defaultMessage:
                      "{count, plural, one {# trusted campaign jar} other {# trusted campaign jars}} indexed for this network.",
                  },
                  { count: campaigns.length }
                )}
              </p>
            </div>
            <FormField
              label={formatMessage({
                id: "cockpit.community.cookies.searchCampaigns",
                defaultMessage: "Search cookie jars",
              })}
              htmlFor="campaign-cookie-jar-search"
            >
              <TextInput
                id="campaign-cookie-jar-search"
                surface="admin"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                placeholder={formatMessage({
                  id: "cockpit.community.cookies.searchCampaignsPlaceholder",
                  defaultMessage: "Search by name, slug, or address",
                })}
              />
            </FormField>
          </div>
        </div>

        {campaignsLoading ? (
          <div className="flex-1 space-y-3 p-4 sm:p-5" role="status" aria-live="polite">
            <span className="sr-only">
              {formatMessage({
                id: "cockpit.community.cookies.loadingCampaigns",
                defaultMessage: "Loading campaign cookie jars...",
              })}
            </span>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`cookie-jar-skeleton-${index}`}
                className="h-20 rounded-sm skeleton-shimmer"
              />
            ))}
          </div>
        ) : null}

        {!campaignsLoading && campaignsError ? (
          <div className="flex-1 p-5 text-body-sm text-[rgb(var(--m3-error))]">
            {formatMessage({
              id: "cockpit.community.cookies.loadFailed",
              defaultMessage: "Could not load campaign cookie jars. Direct jar links still work.",
            })}
          </div>
        ) : null}

        {!campaignsLoading && !campaignsError && campaigns.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 p-5">
            <p className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.emptyTitle",
                defaultMessage: "No campaign cookie jars yet",
              })}
            </p>
            <p className="max-w-xl text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.emptyDescription",
                defaultMessage:
                  "Create the first campaign jar, then it will appear here once the indexer sees it.",
              })}
            </p>
          </div>
        ) : null}

        {!campaignsLoading &&
        !campaignsError &&
        campaigns.length > 0 &&
        visibleCampaigns.length === 0 ? (
          <div className="flex-1 p-5 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({
              id: "cockpit.community.cookies.noCampaignMatches",
              defaultMessage: "No cookie jars match that search.",
            })}
          </div>
        ) : null}

        {!campaignsLoading && visibleCampaigns.length > 0 ? (
          <div>
            {visibleCampaigns.map((campaign) => (
              <CampaignJarListRow
                key={campaign.address}
                campaign={campaign}
                gardensByAddress={gardensByAddress}
                onSelect={setSelectedCampaign}
              />
            ))}
          </div>
        ) : null}
      </AdminCard>

      <AdminDialog
        open={Boolean(selectedCampaign)}
        onOpenChange={(open) => {
          if (!open) setSelectedCampaign(null);
        }}
        title={formatMessage(
          {
            id: "cockpit.community.cookies.manageTitle",
            defaultMessage: "Manage {title}",
          },
          { title: selectedCampaignTitle }
        )}
        description={formatMessage({
          id: "cockpit.community.cookies.manageDescription",
          defaultMessage:
            "Review the public link, update campaign metadata, and sync garden operator access.",
        })}
        className="sm:max-w-3xl"
        actions={
          <>
            <AdminButton type="button" variant="text" onClick={() => setSelectedCampaign(null)}>
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              leadingIcon={<RiRefreshLine />}
              onClick={handleSync}
              disabled={!canSync || syncAllowlist.isPending || updateMetadata.isPending}
              loading={syncAllowlist.isPending || updateMetadata.isPending}
            >
              {formatMessage({
                id: "cockpit.community.cookies.sync",
                defaultMessage: "Sync allowlist",
              })}
            </AdminButton>
          </>
        }
      >
        {selectedCampaign ? (
          <div className="space-y-5">
            <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] p-3">
              <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.jarAddress",
                  defaultMessage: "Jar address",
                })}
              </p>
              <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                {selectedCampaign.address}
              </p>
              <a
                href={publicJarLink(selectedCampaign.address)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-label-md text-[rgb(var(--m3-primary))] underline-offset-4 hover:underline"
              >
                {formatMessage({
                  id: "cockpit.community.cookies.openPublicLink",
                  defaultMessage: "Open public link",
                })}
                <RiExternalLinkLine className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={formatMessage({
                  id: "cockpit.community.cookies.campaignDescription",
                  defaultMessage: "Campaign description",
                })}
                htmlFor="campaign-cookie-jar-manage-description"
                className="md:col-span-2"
              >
                <Textarea
                  id="campaign-cookie-jar-manage-description"
                  surface="admin"
                  value={syncCampaignDescription}
                  onChange={(event) => setSyncCampaignDescription(event.target.value)}
                />
              </FormField>
              <CampaignImageInput
                value={syncCampaignImage}
                onChange={setSyncCampaignImage}
                file={syncCampaignImageFile}
                onFileChange={setSyncCampaignImageFile}
                disabled={syncAllowlist.isPending || updateMetadata.isPending}
                source="campaign-cookie-jar-manage-image"
              />
              <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-3">
                <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
                  {formatMessage({
                    id: "cockpit.community.cookies.generatedCampaignLink",
                    defaultMessage: "Campaign page",
                  })}
                </p>
                <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                  {selectedCampaignPublicUrl}
                </p>
              </div>
            </div>
            <GardenSelector
              gardens={gardens}
              selectedGardenIds={syncGardenIds}
              onToggle={toggleSyncGarden}
              onSelectMany={selectSyncGardens}
              onClear={() => setSyncGardenIds([])}
              search={syncGardenSearch}
              setSearch={setSyncGardenSearch}
            />
            <FormField
              label={formatMessage({
                id: "cockpit.community.cookies.extraAddresses",
                defaultMessage: "Extra allowlist addresses",
              })}
              htmlFor="campaign-cookie-jar-manage-extra-addresses"
            >
              <Textarea
                id="campaign-cookie-jar-manage-extra-addresses"
                surface="admin"
                value={syncExtraAddresses}
                onChange={(event) => setSyncExtraAddresses(event.target.value)}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-3">
              <DiffStat
                label={formatMessage({
                  id: "cockpit.community.cookies.desired",
                  defaultMessage: "Desired",
                })}
                value={syncAggregation.allowlist.length}
              />
              <DiffStat
                label={formatMessage({
                  id: "cockpit.community.cookies.grant",
                  defaultMessage: "Grant",
                })}
                value={syncDiff.grant.length}
              />
              <DiffStat
                label={formatMessage({
                  id: "cockpit.community.cookies.revoke",
                  defaultMessage: "Revoke",
                })}
                value={syncDiff.revoke.length}
              />
            </div>
            {syncAggregation.invalidAddresses.length > 0 ? (
              <p className="text-body-sm text-[rgb(var(--m3-error))]">
                {formatMessage(
                  {
                    id: "cockpit.community.cookies.invalidExtras",
                    defaultMessage: "Invalid addresses: {addresses}",
                  },
                  { addresses: syncAggregation.invalidAddresses.join(", ") }
                )}
              </p>
            ) : null}
            {selectedJarAddress && syncJar.jar && !syncJar.jar.isOwner ? (
              <p className="text-body-sm text-[rgb(var(--m3-error))]">
                {formatMessage({
                  id: "cockpit.community.cookies.jarOwnerRequired",
                  defaultMessage:
                    "Connect the jar owner or ops Safe to grant, revoke, and update campaign metadata.",
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}

function DiffStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] px-3 py-2">
      <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">{label}</p>
      <p className="mt-1 text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">{value}</p>
    </div>
  );
}
