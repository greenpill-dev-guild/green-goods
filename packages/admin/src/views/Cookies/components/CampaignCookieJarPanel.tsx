import {
  aggregateCampaignCookieJarOperators,
  buildCampaignCookieJarMetadata,
  diffCampaignCookieJarAllowlist,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
  extractErrorMessage,
  FileUploadField,
  formatAddress,
  formatTokenAmount,
  logger,
  normalizeCampaignAddress,
  resolveIPFSUrl,
  toastService,
  type Address,
  type CampaignCookieJarCampaign,
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
  RiExternalLinkLine,
  RiImageLine,
  RiRefreshLine,
  RiSearchLine,
} from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useReadContracts } from "wagmi";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import {
  buildCampaignCookieJarCreatePayload,
  canCreateCampaignCookieJar,
  canSyncCampaignCookieJarAllowlist,
  filterCampaignCookieJarCampaigns,
  filterCampaignCookieJarGardens,
  isValidCampaignCookieJarMetadataUrl,
  isUsableCampaignCookieJarTokenDecimals,
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
  search,
  setSearch,
}: {
  gardens: readonly Garden[];
  selectedGardenIds: readonly string[];
  onToggle: (gardenId: string) => void;
  search: string;
  setSearch: (value: string) => void;
}) {
  const { formatMessage } = useIntl();
  const selectedSet = useMemo(
    () => new Set(selectedGardenIds.map((id) => id.toLowerCase())),
    [selectedGardenIds]
  );
  const visibleGardens = useMemo(() => {
    return filterCampaignCookieJarGardens(gardens, search);
  }, [gardens, search]);

  return (
    <div className="space-y-3">
      <AdminTextField
        label={formatMessage({
          id: "cockpit.community.cookies.searchGardens",
          defaultMessage: "Search gardens",
        })}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        variant="outlined"
      />
      <div className="max-h-64 overflow-y-auto rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))]">
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
        <AdminTextField
          label={formatMessage({
            id: "cockpit.community.cookies.campaignImage",
            defaultMessage: "Campaign image URL",
          })}
          value={value}
          onChange={(event) => {
            onFileChange(null);
            onChange(event.target.value);
          }}
          error={
            value && !isValidCampaignCookieJarMetadataUrl(value)
              ? formatMessage({
                  id: "cockpit.community.cookies.invalidMetadataUrl",
                  defaultMessage: "Use an http(s), IPFS, or site-relative URL.",
                })
              : undefined
          }
          variant="outlined"
        />
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

interface CampaignCookieJarPanelProps {
  initialCreateOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

export function CampaignCookieJarPanel({
  initialCreateOpen = false,
  onCreateOpenChange,
}: CampaignCookieJarPanelProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const { isDeployer, loading: roleLoading } = useRole();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens(chainId);
  const {
    campaigns,
    isLoading: campaignsLoading,
    error: campaignsError,
  } = useCampaignCookieJarCampaigns();
  const {
    factoryAddress,
    moduleConfigured,
    isLoading: factoryLoading,
  } = useCookieJarFactoryAddress();
  const createJar = useCreateCampaignCookieJar({ errorMode: "inline" });
  const syncAllowlist = useSyncCampaignCookieJarAllowlist({ errorMode: "inline" });
  const updateMetadata = useUpdateCampaignCookieJarMetadata({ errorMode: "inline" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignImage, setCampaignImage] = useState("");
  const [campaignImageFile, setCampaignImageFile] = useState<File | null>(null);
  const [campaignExternalUrl, setCampaignExternalUrl] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [withdrawalIntervalDays, setWithdrawalIntervalDays] = useState("0");
  const [jarOwner, setJarOwner] = useState("");
  const [selectedGardenIds, setSelectedGardenIds] = useState<string[]>([]);
  const [gardenSearch, setGardenSearch] = useState("");
  const [extraAddresses, setExtraAddresses] = useState("");
  const [createdJarAddress, setCreatedJarAddress] = useState<Address | null>(null);
  const [createdJarPendingHash, setCreatedJarPendingHash] = useState<string | null>(null);
  const [createdJarManualInput, setCreatedJarManualInput] = useState("");

  const [campaignSearch, setCampaignSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignCookieJarCampaign | null>(null);
  const [syncGardenIds, setSyncGardenIds] = useState<string[]>([]);
  const [syncGardenSearch, setSyncGardenSearch] = useState("");
  const [syncExtraAddresses, setSyncExtraAddresses] = useState("");
  const [syncCampaignDescription, setSyncCampaignDescription] = useState("");
  const [syncCampaignImage, setSyncCampaignImage] = useState("");
  const [syncCampaignImageFile, setSyncCampaignImageFile] = useState<File | null>(null);
  const [syncCampaignExternalUrl, setSyncCampaignExternalUrl] = useState("");
  const selectedJarAddress = selectedCampaign?.address;
  const syncJar = useCampaignCookieJar(selectedJarAddress, {
    enabled: Boolean(selectedJarAddress),
  });

  useEffect(() => {
    if (initialCreateOpen) {
      setDialogOpen(true);
    }
  }, [initialCreateOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    setJarOwner((current) => current || primaryAddress || "");
  }, [dialogOpen, primaryAddress]);

  useEffect(() => {
    if (!selectedCampaign) return;
    const draft = resolveCampaignCookieJarManageDraft(selectedCampaign, syncJar.jar?.metadata);
    setSyncGardenIds(draft.selectedGardenIds);
    setSyncExtraAddresses(draft.extraAddresses);
    setSyncCampaignDescription(draft.description);
    setSyncCampaignImage(draft.image);
    setSyncCampaignExternalUrl(draft.externalUrl);
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

  const normalizedTokenAddress = normalizeCampaignAddress(tokenAddress);
  const tokenInfoQuery = useReadContracts({
    contracts: normalizedTokenAddress
      ? [
          {
            address: normalizedTokenAddress,
            abi: ERC20_DECIMALS_ABI,
            functionName: "decimals" as const,
          },
          {
            address: normalizedTokenAddress,
            abi: ERC20_SYMBOL_ABI,
            functionName: "symbol" as const,
          },
        ]
      : [],
    allowFailure: true,
    query: {
      enabled: Boolean(normalizedTokenAddress),
    },
  });
  const tokenDecimalsResult = tokenInfoQuery.data?.[0];
  const tokenDecimalsValue = tokenDecimalsResult?.result;
  const tokenDecimalsConfirmed = isUsableCampaignCookieJarTokenDecimals(tokenDecimalsValue);
  const tokenDecimals = tokenDecimalsConfirmed ? tokenDecimalsValue : 18;
  const tokenSymbol = (tokenInfoQuery.data?.[1]?.result as string | undefined) ?? "";
  const tokenDecimalsLoading =
    Boolean(normalizedTokenAddress) && (tokenInfoQuery.isLoading || tokenInfoQuery.isFetching);
  const tokenDecimalsError =
    Boolean(normalizedTokenAddress) && !tokenDecimalsLoading && !tokenDecimalsConfirmed;
  const createMetadataUrlsValid =
    isValidCampaignCookieJarMetadataUrl(campaignImage) &&
    isValidCampaignCookieJarMetadataUrl(campaignExternalUrl);
  const syncMetadataUrlsValid =
    isValidCampaignCookieJarMetadataUrl(syncCampaignImage) &&
    isValidCampaignCookieJarMetadataUrl(syncCampaignExternalUrl);

  const aggregation = useMemo(
    () =>
      aggregateCampaignCookieJarOperators({
        gardens: gardensForAggregation(gardens),
        selectedGardenIds,
        extraAddressesInput: extraAddresses,
      }),
    [extraAddresses, gardens, selectedGardenIds]
  );
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
        normalizeMetadataField(syncCampaignExternalUrl)
    );
  }, [
    selectedCampaign,
    syncAggregation.extraAllowlist,
    syncCampaignDescription,
    syncCampaignExternalUrl,
    syncCampaignImage,
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
        externalUrl: syncCampaignExternalUrl,
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
    syncCampaignExternalUrl,
    syncCampaignImage,
    syncJar.jar,
    syncMetadataChanged,
    syncSourceGardens,
  ]);

  const parsedClaimAmount = parseAmountInput(claimAmount, tokenDecimals);
  const normalizedJarOwner = normalizeCampaignAddress(jarOwner);
  const createdJarManualAddress = normalizeCampaignAddress(createdJarManualInput);
  const canCreate = canCreateCampaignCookieJar({
    factoryAddress,
    tokenAddress: normalizedTokenAddress,
    tokenDecimalsConfirmed,
    jarOwner: normalizedJarOwner,
    campaignTitle,
    hasValidClaimConfig: Boolean(parsedClaimAmount),
    allowlistCount: aggregation.allowlist.length,
    invalidAddressCount: aggregation.invalidAddresses.length,
    metadataUrlsValid: createMetadataUrlsValid,
    isDeployer,
  });

  const toggleGarden = (gardenId: string) => {
    setSelectedGardenIds((current) =>
      current.some((id) => id.toLowerCase() === gardenId.toLowerCase())
        ? current.filter((id) => id.toLowerCase() !== gardenId.toLowerCase())
        : [...current, gardenId]
    );
  };

  const toggleSyncGarden = (gardenId: string) => {
    setSyncGardenIds((current) =>
      current.some((id) => id.toLowerCase() === gardenId.toLowerCase())
        ? current.filter((id) => id.toLowerCase() !== gardenId.toLowerCase())
        : [...current, gardenId]
    );
  };

  const setCreateDialogOpen = (open: boolean) => {
    setDialogOpen(open);
    onCreateOpenChange?.(open);
  };

  const applyCreatedJarAddress = (jarAddress: Address) => {
    setCreatedJarAddress(jarAddress);
    setCreatedJarPendingHash(null);
    setCreatedJarManualInput("");
  };

  const handleCreate = () => {
    if (
      !canCreate ||
      !factoryAddress ||
      !normalizedTokenAddress ||
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
        campaignExternalUrl,
        tokenAddress: normalizedTokenAddress,
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
          setCreateDialogOpen(false);
        },
      }
    );
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
    <div className="space-y-5">
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

      {createdJarAddress ? (
        <AdminCard variant="outlined" className="space-y-2">
          <p className="text-label-lg text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.createdJar",
              defaultMessage: "Created jar",
            })}
          </p>
          <p className="break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {createdJarAddress}
          </p>
          <a
            href={publicJarLink(createdJarAddress)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-label-md text-[rgb(var(--m3-primary))] underline-offset-4 hover:underline"
          >
            {publicJarLink(createdJarAddress)}
            <RiExternalLinkLine className="h-4 w-4" aria-hidden />
          </a>
        </AdminCard>
      ) : null}

      {createdJarPendingHash ? (
        <AdminCard variant="outlined" className="space-y-4">
          <div className="space-y-2">
            <p className="text-label-lg text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmitted",
                defaultMessage: "Creation submitted",
              })}
            </p>
            <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmittedDescription",
                defaultMessage:
                  "The wallet returned a submitted transaction without a final jar address. Once the transaction is executed, paste the created jar address to generate the public link.",
              })}
            </p>
            <p className="break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.submittedTransaction",
                defaultMessage: "Submitted transaction",
              })}
              {`: ${createdJarPendingHash}`}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.createdJarAddressInput",
                defaultMessage: "Created jar address",
              })}
              value={createdJarManualInput}
              onChange={(event) => setCreatedJarManualInput(event.target.value)}
              error={
                createdJarManualInput && !createdJarManualAddress
                  ? formatMessage({
                      id: "cockpit.community.cookies.invalidAddress",
                      defaultMessage: "Enter a valid Ethereum address.",
                    })
                  : undefined
              }
              variant="outlined"
            />
            <AdminButton
              type="button"
              onClick={() => {
                if (!createdJarManualAddress) return;
                applyCreatedJarAddress(createdJarManualAddress);
              }}
              disabled={!createdJarManualAddress}
            >
              {formatMessage({
                id: "cockpit.community.cookies.useCreatedJar",
                defaultMessage: "Use jar address",
              })}
            </AdminButton>
          </div>
        </AdminCard>
      ) : null}

      <AdminCard variant="outlined" className="overflow-hidden p-0">
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
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.searchCampaigns",
                defaultMessage: "Search cookie jars",
              })}
              value={campaignSearch}
              onChange={(event) => setCampaignSearch(event.target.value)}
              leadingIcon={RiSearchLine}
              variant="outlined"
            />
          </div>
        </div>

        {campaignsLoading ? (
          <div className="space-y-3 p-4 sm:p-5" role="status" aria-live="polite">
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
          <div className="p-5 text-body-sm text-[rgb(var(--m3-error))]">
            {formatMessage({
              id: "cockpit.community.cookies.loadFailed",
              defaultMessage: "Could not load campaign cookie jars. Direct jar links still work.",
            })}
          </div>
        ) : null}

        {!campaignsLoading && !campaignsError && campaigns.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-5">
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
            <AdminButton
              type="button"
              leadingIcon={<RiAddLine />}
              onClick={() => setCreateDialogOpen(true)}
              disabled={!isDeployer || !factoryAddress || factoryLoading || roleLoading}
            >
              {formatMessage({
                id: "cockpit.community.cookies.create",
                defaultMessage: "Create cookie jar",
              })}
            </AdminButton>
          </div>
        ) : null}

        {!campaignsLoading &&
        !campaignsError &&
        campaigns.length > 0 &&
        visibleCampaigns.length === 0 ? (
          <div className="p-5 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
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
        open={dialogOpen}
        onOpenChange={setCreateDialogOpen}
        title={formatMessage({
          id: "cockpit.community.cookies.dialogTitle",
          defaultMessage: "Create cookie jar",
        })}
        description={formatMessage({
          id: "cockpit.community.cookies.dialogDescription",
          defaultMessage:
            "Create a campaign jar from the deployed factory. Jar ownership defaults to this wallet; production should use the ops Safe.",
        })}
        className="sm:max-w-3xl"
        actions={
          <>
            <AdminButton type="button" variant="text" onClick={() => setCreateDialogOpen(false)}>
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || createJar.isPending || gardensLoading}
              loading={createJar.isPending}
            >
              {formatMessage({
                id: "cockpit.community.cookies.create",
                defaultMessage: "Create cookie jar",
              })}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.campaignName",
                defaultMessage: "Campaign name",
              })}
              value={campaignTitle}
              onChange={(event) => setCampaignTitle(event.target.value)}
              variant="outlined"
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.campaignExternalUrl",
                defaultMessage: "Campaign page URL",
              })}
              value={campaignExternalUrl}
              onChange={(event) => setCampaignExternalUrl(event.target.value)}
              error={
                campaignExternalUrl && !isValidCampaignCookieJarMetadataUrl(campaignExternalUrl)
                  ? formatMessage({
                      id: "cockpit.community.cookies.invalidMetadataUrl",
                      defaultMessage: "Use an http(s), IPFS, or site-relative URL.",
                    })
                  : undefined
              }
              variant="outlined"
            />
            <label className="block md:col-span-2">
              <span className="text-label-md text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.campaignDescription",
                  defaultMessage: "Campaign description",
                })}
              </span>
              <textarea
                value={campaignDescription}
                onChange={(event) => setCampaignDescription(event.target.value)}
                className="mt-2 min-h-20 w-full rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline))] bg-[rgb(var(--m3-surface))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] outline-none focus:ring-2 focus:ring-[rgb(var(--m3-primary))]"
              />
            </label>
            <CampaignImageInput
              value={campaignImage}
              onChange={setCampaignImage}
              file={campaignImageFile}
              onFileChange={setCampaignImageFile}
              disabled={createJar.isPending}
              source="campaign-cookie-jar-create-image"
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.tokenAddress",
                defaultMessage: "ERC20 token address",
              })}
              value={tokenAddress}
              onChange={(event) => setTokenAddress(event.target.value)}
              helperText={
                tokenSymbol
                  ? formatMessage(
                      {
                        id: "cockpit.community.cookies.tokenInfo",
                        defaultMessage: "{symbol}, {decimals} decimals",
                      },
                      { symbol: tokenSymbol, decimals: tokenDecimals }
                    )
                  : tokenDecimalsLoading
                    ? formatMessage({
                        id: "cockpit.community.cookies.tokenInfoLoading",
                        defaultMessage: "Reading token decimals...",
                      })
                    : undefined
              }
              error={
                tokenAddress && !normalizedTokenAddress
                  ? formatMessage({
                      id: "cockpit.community.cookies.invalidAddress",
                      defaultMessage: "Enter a valid Ethereum address.",
                    })
                  : tokenDecimalsError
                    ? formatMessage({
                        id: "cockpit.community.cookies.tokenDecimalsRequired",
                        defaultMessage:
                          "Token decimals could not be read. Check the ERC20 address and try again.",
                      })
                    : undefined
              }
              variant="outlined"
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.owner",
                defaultMessage: "Jar owner",
              })}
              value={jarOwner}
              onChange={(event) => setJarOwner(event.target.value)}
              error={
                jarOwner && !normalizedJarOwner
                  ? formatMessage({
                      id: "cockpit.community.cookies.invalidAddress",
                      defaultMessage: "Enter a valid Ethereum address.",
                    })
                  : undefined
              }
              variant="outlined"
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.claimAmount",
                defaultMessage: "Fixed claim amount",
              })}
              value={claimAmount}
              onChange={(event) => setClaimAmount(event.target.value)}
              variant="outlined"
              type="number"
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.cooldownDays",
                defaultMessage: "Cooldown days",
              })}
              value={withdrawalIntervalDays}
              onChange={(event) => setWithdrawalIntervalDays(event.target.value)}
              variant="outlined"
              type="number"
            />
          </div>
          <GardenSelector
            gardens={gardens}
            selectedGardenIds={selectedGardenIds}
            onToggle={toggleGarden}
            search={gardenSearch}
            setSearch={setGardenSearch}
          />
          <label className="block">
            <span className="text-label-md text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.extraAddresses",
                defaultMessage: "Extra allowlist addresses",
              })}
            </span>
            <textarea
              value={extraAddresses}
              onChange={(event) => setExtraAddresses(event.target.value)}
              placeholder={formatMessage({
                id: "cockpit.community.cookies.extraPlaceholder",
                defaultMessage: "Paste addresses separated by commas, spaces, or new lines",
              })}
              className="mt-2 min-h-24 w-full rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline))] bg-[rgb(var(--m3-surface))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] outline-none focus:ring-2 focus:ring-[rgb(var(--m3-primary))]"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <DiffStat
              label={formatMessage({
                id: "cockpit.community.cookies.selectedGardens",
                defaultMessage: "Selected gardens",
              })}
              value={aggregation.sources.length}
            />
            <DiffStat
              label={formatMessage({
                id: "cockpit.community.cookies.generatedOperators",
                defaultMessage: "Generated operators",
              })}
              value={aggregation.allowlist.length}
            />
            <DiffStat
              label={formatMessage({
                id: "cockpit.community.cookies.missingOperators",
                defaultMessage: "Missing operators",
              })}
              value={aggregation.missingOperatorGardens.length}
            />
          </div>
          {aggregation.invalidAddresses.length > 0 ? (
            <p className="text-body-sm text-[rgb(var(--m3-error))]">
              {formatMessage(
                {
                  id: "cockpit.community.cookies.invalidExtras",
                  defaultMessage: "Invalid addresses: {addresses}",
                },
                { addresses: aggregation.invalidAddresses.join(", ") }
              )}
            </p>
          ) : null}
          {createJar.error ? (
            <p className="text-body-sm text-[rgb(var(--m3-error))]">{createJar.error.message}</p>
          ) : null}
        </div>
      </AdminDialog>

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
              <label className="block md:col-span-2">
                <span className="text-label-md text-[rgb(var(--m3-on-surface))]">
                  {formatMessage({
                    id: "cockpit.community.cookies.campaignDescription",
                    defaultMessage: "Campaign description",
                  })}
                </span>
                <textarea
                  value={syncCampaignDescription}
                  onChange={(event) => setSyncCampaignDescription(event.target.value)}
                  className="mt-2 min-h-20 w-full rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline))] bg-[rgb(var(--m3-surface))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] outline-none focus:ring-2 focus:ring-[rgb(var(--m3-primary))]"
                />
              </label>
              <CampaignImageInput
                value={syncCampaignImage}
                onChange={setSyncCampaignImage}
                file={syncCampaignImageFile}
                onFileChange={setSyncCampaignImageFile}
                disabled={syncAllowlist.isPending || updateMetadata.isPending}
                source="campaign-cookie-jar-manage-image"
              />
              <AdminTextField
                label={formatMessage({
                  id: "cockpit.community.cookies.campaignExternalUrl",
                  defaultMessage: "Campaign page URL",
                })}
                value={syncCampaignExternalUrl}
                onChange={(event) => setSyncCampaignExternalUrl(event.target.value)}
                error={
                  syncCampaignExternalUrl &&
                  !isValidCampaignCookieJarMetadataUrl(syncCampaignExternalUrl)
                    ? formatMessage({
                        id: "cockpit.community.cookies.invalidMetadataUrl",
                        defaultMessage: "Use an http(s), IPFS, or site-relative URL.",
                      })
                    : undefined
                }
                variant="outlined"
              />
            </div>
            <GardenSelector
              gardens={gardens}
              selectedGardenIds={syncGardenIds}
              onToggle={toggleSyncGarden}
              search={syncGardenSearch}
              setSearch={setSyncGardenSearch}
            />
            <label className="block">
              <span className="text-label-md text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.extraAddresses",
                  defaultMessage: "Extra allowlist addresses",
                })}
              </span>
              <textarea
                value={syncExtraAddresses}
                onChange={(event) => setSyncExtraAddresses(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline))] bg-[rgb(var(--m3-surface))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] outline-none focus:ring-2 focus:ring-[rgb(var(--m3-primary))]"
              />
            </label>
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
