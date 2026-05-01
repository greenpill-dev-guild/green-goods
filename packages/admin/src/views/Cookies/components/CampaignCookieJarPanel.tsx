import {
  aggregateCampaignCookieJarOperators,
  buildCampaignCookieJarMetadata,
  diffCampaignCookieJarAllowlist,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
  formatAddress,
  normalizeCampaignAddress,
  type Address,
  type Garden,
  useCampaignCookieJar,
  useCookieJarFactoryAddress,
  useCreateCampaignCookieJar,
  useCurrentChain,
  useGardens,
  useRole,
  useSyncCampaignCookieJarAllowlist,
  useUpdateCampaignCookieJarMetadata,
  useUser,
} from "@green-goods/shared";
import { RiAddLine, RiRefreshLine } from "@remixicon/react";
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
  canSyncCampaignCookieJarAllowlist,
  filterCampaignCookieJarGardens,
  resolveCampaignCookieJarCreateFollowUp,
} from "../campaignCookieJarPanel.model";

const PUBLIC_COOKIE_BASE_URL = "https://greengoods.app/cookies";

function slugifyCampaignTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

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

function gardensForAggregation(gardens: readonly Garden[]) {
  return gardens.map((garden) => ({
    id: garden.id,
    name: garden.name,
    operators: garden.operators,
  }));
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
                      "{count, plural, one {# operator} other {# operators}} · {address}",
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

interface CampaignCookieJarPanelProps {
  initialCreateOpen?: boolean;
}

export function CampaignCookieJarPanel({ initialCreateOpen = false }: CampaignCookieJarPanelProps) {
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
  const syncAllowlist = useSyncCampaignCookieJarAllowlist({ errorMode: "inline" });
  const updateMetadata = useUpdateCampaignCookieJarMetadata({ errorMode: "inline" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignSlug, setCampaignSlug] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [variableMode, setVariableMode] = useState(false);
  const [maxClaimAmount, setMaxClaimAmount] = useState("");
  const [withdrawalIntervalDays, setWithdrawalIntervalDays] = useState("0");
  const [strictPurpose, setStrictPurpose] = useState(false);
  const [oneTimeClaim, setOneTimeClaim] = useState(true);
  const [jarOwner, setJarOwner] = useState("");
  const [selectedGardenIds, setSelectedGardenIds] = useState<string[]>([]);
  const [gardenSearch, setGardenSearch] = useState("");
  const [extraAddresses, setExtraAddresses] = useState("");
  const [createdJarAddress, setCreatedJarAddress] = useState<Address | null>(null);
  const [createdJarPendingHash, setCreatedJarPendingHash] = useState<string | null>(null);
  const [createdJarManualInput, setCreatedJarManualInput] = useState("");

  const [syncJarAddressInput, setSyncJarAddressInput] = useState("");
  const [syncGardenIds, setSyncGardenIds] = useState<string[]>([]);
  const [syncGardenSearch, setSyncGardenSearch] = useState("");
  const [syncExtraAddresses, setSyncExtraAddresses] = useState("");
  const syncJarAddress = normalizeCampaignAddress(syncJarAddressInput) ?? undefined;
  const syncJar = useCampaignCookieJar(syncJarAddress, { enabled: Boolean(syncJarAddress) });

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
    if (!campaignTitle || campaignSlug) return;
    setCampaignSlug(slugifyCampaignTitle(campaignTitle));
  }, [campaignSlug, campaignTitle]);

  useEffect(() => {
    if (!syncJar.jar?.metadata) return;
    setSyncGardenIds(syncJar.jar.metadata.sourceGardens);
    setSyncExtraAddresses(syncJar.jar.metadata.extraAllowlist.join("\n"));
  }, [syncJar.jar?.metadata]);

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
  const tokenDecimals = (tokenInfoQuery.data?.[0]?.result as number | undefined) ?? 18;
  const tokenSymbol = (tokenInfoQuery.data?.[1]?.result as string | undefined) ?? "";

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
    if (!syncJar.jar) return false;
    if (!syncJar.jar.metadata) return true;

    return (
      !haveSameAddressSet(syncJar.jar.metadata.sourceGardens, syncSourceGardens) ||
      !haveSameAddressSet(syncJar.jar.metadata.extraAllowlist, syncAggregation.extraAllowlist)
    );
  }, [syncAggregation.extraAllowlist, syncJar.jar, syncSourceGardens]);
  const syncMetadataPayload = useMemo(() => {
    if (!syncJar.jar || !factoryAddress || !syncMetadataChanged) return null;

    return JSON.stringify(
      buildCampaignCookieJarMetadata({
        title:
          syncJar.jar.metadata?.title ??
          formatMessage({
            id: "cockpit.community.cookies.untitledCampaign",
            defaultMessage: "Campaign cookie jar",
          }),
        slug: syncJar.jar.metadata?.slug ?? "campaign-cookie-jar",
        sourceGardens: syncSourceGardens,
        extraAllowlist: syncAggregation.extraAllowlist,
        chainId,
        createdAt: syncJar.jar.metadata?.createdAt,
      })
    );
  }, [
    chainId,
    factoryAddress,
    formatMessage,
    syncAggregation.extraAllowlist,
    syncJar.jar,
    syncMetadataChanged,
    syncSourceGardens,
  ]);

  const parsedClaimAmount = parseAmountInput(claimAmount, tokenDecimals);
  const parsedMaxClaimAmount = variableMode
    ? parseAmountInput(maxClaimAmount, tokenDecimals)
    : parsedClaimAmount;
  const normalizedJarOwner = normalizeCampaignAddress(jarOwner);
  const createdJarManualAddress = normalizeCampaignAddress(createdJarManualInput);
  const hasValidClaimConfig = variableMode
    ? Boolean(parsedMaxClaimAmount)
    : Boolean(parsedClaimAmount);
  const canCreate =
    Boolean(
      factoryAddress &&
        normalizedTokenAddress &&
        normalizedJarOwner &&
        campaignTitle.trim() &&
        campaignSlug.trim() &&
        hasValidClaimConfig &&
        aggregation.allowlist.length > 0 &&
        isDeployer
    ) && aggregation.invalidAddresses.length === 0;

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

  const applyCreatedJarAddress = (jarAddress: Address) => {
    setCreatedJarAddress(jarAddress);
    setCreatedJarPendingHash(null);
    setCreatedJarManualInput("");
    setSyncJarAddressInput(jarAddress);
    setSyncGardenIds(selectedGardenIds);
    setSyncExtraAddresses(extraAddresses);
  };

  const handleCreate = () => {
    if (!canCreate || !factoryAddress || !normalizedTokenAddress || !normalizedJarOwner) return;
    const intervalDays = Number(withdrawalIntervalDays);
    createJar.mutate(
      {
        factoryAddress,
        title: campaignTitle,
        slug: campaignSlug,
        tokenAddress: normalizedTokenAddress,
        jarOwner: normalizedJarOwner,
        allowlist: aggregation.allowlist,
        sourceGardens: aggregation.sources.map((source) => source.gardenAddress),
        extraAllowlist: aggregation.extraAllowlist,
        fixedAmount: variableMode ? 0n : parsedClaimAmount!,
        maxWithdrawal: parsedMaxClaimAmount!,
        withdrawalInterval:
          Number.isFinite(intervalDays) && intervalDays > 0
            ? BigInt(Math.floor(intervalDays * 86400))
            : 0n,
        minDeposit: 0n,
        oneTimeWithdrawal: oneTimeClaim,
        strictPurpose,
        withdrawalType: variableMode ? "variable" : "fixed",
      },
      {
        onSuccess: (result) => {
          const followUp = resolveCampaignCookieJarCreateFollowUp(result);
          if (followUp.kind === "ready") {
            applyCreatedJarAddress(followUp.jarAddress);
          } else {
            setCreatedJarAddress(null);
            setCreatedJarPendingHash(followUp.hash);
          }
          setDialogOpen(false);
        },
      }
    );
  };

  const canSync = canSyncCampaignCookieJarAllowlist({
    jarAddress: syncJarAddress,
    isJarOwner: Boolean(syncJar.jar?.isOwner),
    invalidAddressCount: syncAggregation.invalidAddresses.length,
    grantCount: syncDiff.grant.length,
    revokeCount: syncDiff.revoke.length,
    metadataChanged: syncMetadataChanged,
    canUpdateMetadata: Boolean(factoryAddress),
  });

  const handleSync = () => {
    if (!syncJarAddress || !canSync) return;
    const hasAllowlistDiff = syncDiff.grant.length > 0 || syncDiff.revoke.length > 0;
    if (!hasAllowlistDiff) {
      if (!factoryAddress || !syncMetadataPayload) return;
      updateMetadata.mutate({
        factoryAddress,
        jarAddress: syncJarAddress,
        metadata: syncMetadataPayload,
      });
      return;
    }

    syncAllowlist.mutate(
      {
        jarAddress: syncJarAddress,
        grant: syncDiff.grant,
        revoke: syncDiff.revoke,
      },
      {
        onSuccess: () => {
          if (!factoryAddress || !syncMetadataPayload) return;
          updateMetadata.mutate({
            factoryAddress,
            jarAddress: syncJarAddress,
            metadata: syncMetadataPayload,
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title-lg font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.title",
              defaultMessage: "Campaign cookie jars",
            })}
          </h2>
          <p className="mt-1 max-w-2xl text-body-md text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({
              id: "cockpit.community.cookies.description",
              defaultMessage:
                "Create one shared Cookie Jar for a campaign and allow selected garden operators to claim from it.",
            })}
          </p>
        </div>
        <AdminButton
          type="button"
          leadingIcon={<RiAddLine />}
          onClick={() => setDialogOpen(true)}
          disabled={!isDeployer || !factoryAddress || factoryLoading || roleLoading}
        >
          {formatMessage({
            id: "cockpit.community.cookies.create",
            defaultMessage: "Create cookie jar",
          })}
        </AdminButton>
      </div>

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
              "This surface is intended for deployer and ops wallets. Connect a deployer wallet to create jars, or the jar owner to sync an existing jar.",
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
            className="text-label-md text-[rgb(var(--m3-primary))] underline-offset-4 hover:underline"
          >
            {publicJarLink(createdJarAddress)}
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
                  "The wallet returned a submitted transaction without a final jar address. Once the transaction is executed, paste the created jar address to generate the public link and seed the sync form.",
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

      <AdminCard variant="outlined" className="space-y-5">
        <div>
          <h3 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.syncTitle",
              defaultMessage: "Refresh allowlist",
            })}
          </h3>
          <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({
              id: "cockpit.community.cookies.syncDescription",
              defaultMessage:
                "Allowlists are snapshots. Recompute operators from the selected gardens, review the diff, then grant and revoke jar access.",
            })}
          </p>
        </div>
        <AdminTextField
          label={formatMessage({
            id: "cockpit.community.cookies.jarAddress",
            defaultMessage: "Jar address",
          })}
          value={syncJarAddressInput}
          onChange={(event) => setSyncJarAddressInput(event.target.value)}
          error={
            syncJarAddressInput && !syncJarAddress
              ? formatMessage({
                  id: "cockpit.community.cookies.invalidAddress",
                  defaultMessage: "Enter a valid Ethereum address.",
                })
              : undefined
          }
          variant="outlined"
        />
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
        {syncJarAddress && syncJar.jar && !syncJar.jar.isOwner ? (
          <p className="text-body-sm text-[rgb(var(--m3-error))]">
            {formatMessage({
              id: "cockpit.community.cookies.jarOwnerRequired",
              defaultMessage:
                "Connect the jar owner or ops Safe to grant, revoke, and update campaign metadata.",
            })}
          </p>
        ) : null}
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
      </AdminCard>

      <AdminDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={formatMessage({
          id: "cockpit.community.cookies.dialogTitle",
          defaultMessage: "Create cookie jar",
        })}
        description={formatMessage({
          id: "cockpit.community.cookies.dialogDescription",
          defaultMessage:
            "Create a campaign jar from the deployed factory. Jar ownership defaults to this wallet; production should use the ops Safe.",
        })}
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl"
        actions={
          <>
            <AdminButton type="button" variant="text" onClick={() => setDialogOpen(false)}>
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
              id: "cockpit.community.cookies.campaignSlug",
              defaultMessage: "Campaign slug",
            })}
            value={campaignSlug}
            onChange={(event) => setCampaignSlug(slugifyCampaignTitle(event.target.value))}
            variant="outlined"
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
                : undefined
            }
            error={
              tokenAddress && !normalizedTokenAddress
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
          {variableMode ? (
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.cookies.maxClaim",
                defaultMessage: "Max variable claim",
              })}
              value={maxClaimAmount}
              onChange={(event) => setMaxClaimAmount(event.target.value)}
              variant="outlined"
              type="number"
            />
          ) : (
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
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <AdminCheckbox
            checked={oneTimeClaim}
            onChange={(event) => setOneTimeClaim(event.target.checked)}
            label={formatMessage({
              id: "cockpit.community.cookies.oneTimeClaim",
              defaultMessage: "One-time claim",
            })}
          />
          <AdminCheckbox
            checked={strictPurpose}
            onChange={(event) => setStrictPurpose(event.target.checked)}
            label={formatMessage({
              id: "cockpit.community.cookies.strictPurpose",
              defaultMessage: "Require purpose",
            })}
          />
          <AdminCheckbox
            checked={variableMode}
            onChange={(event) => setVariableMode(event.target.checked)}
            label={formatMessage({
              id: "cockpit.community.cookies.variableClaims",
              defaultMessage: "Variable claims",
            })}
          />
        </div>
        {variableMode ? (
          <div className="mt-4">
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
        ) : null}
        <div className="mt-5">
          <GardenSelector
            gardens={gardens}
            selectedGardenIds={selectedGardenIds}
            onToggle={toggleGarden}
            search={gardenSearch}
            setSearch={setGardenSearch}
          />
        </div>
        <label className="mt-5 block">
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
        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
          <p className="mt-3 text-body-sm text-[rgb(var(--m3-error))]">
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
          <p className="mt-3 text-body-sm text-[rgb(var(--m3-error))]">{createJar.error.message}</p>
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
