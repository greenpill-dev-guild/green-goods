import {
  aggregateCampaignCookieJarOperators,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
  formatTokenAmount,
  getCampaignCookieJarPayoutAssets,
  getDefaultCampaignCookieJarPayoutAsset,
  normalizeCampaignAddress,
  type Address,
  type CampaignCookieJarPayoutAssetId,
  useCookieJarFactoryAddress,
  useCreateCampaignCookieJar,
  useCurrentChain,
  useGardens,
  useRole,
  useUser,
} from "@green-goods/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useReadContracts } from "wagmi";
import {
  buildCampaignCookieJarCreatePayload,
  canCreateCampaignCookieJar,
  getCampaignCookieJarPublicUrl,
  isUsableCampaignCookieJarTokenDecimals,
  isValidCampaignCookieJarMetadataUrl,
  resolveCampaignCookieJarCreateFollowUp,
} from "../../campaignCookieJarPanel.model";
import {
  CampaignCookieJarCreatedState,
  CampaignCookieJarSubmittedState,
} from "./CampaignCookieJarCreateStates";
import { CampaignCookieJarCreateForm } from "./CampaignCookieJarCreateForm";
import type { CampaignCookieJarCreateWorkspaceProps } from "./CampaignCookieJarCreateWorkspace.types";
import { gardensForAggregation, parseAmountInput } from "./helpers";

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
    <CampaignCookieJarCreateForm
      formatMessage={formatMessage}
      moduleConfigured={moduleConfigured}
      isDeployer={isDeployer}
      roleLoading={roleLoading}
      createError={createJar.error}
      createPending={createJar.isPending}
      gardensLoading={gardensLoading}
      factoryLoading={factoryLoading}
      payoutAssets={payoutAssets}
      defaultPayoutAsset={defaultPayoutAsset}
      selectedAssetId={selectedAssetId}
      setSelectedAssetId={setSelectedAssetId}
      campaignTitle={campaignTitle}
      setCampaignTitle={setCampaignTitle}
      campaignDescription={campaignDescription}
      setCampaignDescription={setCampaignDescription}
      campaignImage={campaignImage}
      setCampaignImage={setCampaignImage}
      campaignImageFile={campaignImageFile}
      setCampaignImageFile={setCampaignImageFile}
      publicCampaignUrl={publicCampaignUrl}
      claimAmount={claimAmount}
      setClaimAmount={setClaimAmount}
      tokenSymbol={tokenSymbol}
      gardens={gardens}
      selectedGardenIds={selectedGardenIds}
      toggleGarden={toggleGarden}
      selectGardens={selectGardens}
      clearGardens={() => setSelectedGardenIds([])}
      gardenSearch={gardenSearch}
      setGardenSearch={setGardenSearch}
      aggregation={aggregation}
      advancedOpen={advancedOpen}
      setAdvancedOpen={setAdvancedOpen}
      customTokenAddress={customTokenAddress}
      setCustomTokenAddress={setCustomTokenAddress}
      normalizedCustomTokenAddress={normalizedCustomTokenAddress}
      customTokenLoading={customTokenLoading}
      customTokenError={customTokenError}
      tokenDecimals={tokenDecimals}
      jarOwner={jarOwner}
      setJarOwner={setJarOwner}
      normalizedJarOwner={normalizedJarOwner}
      withdrawalIntervalDays={withdrawalIntervalDays}
      setWithdrawalIntervalDays={setWithdrawalIntervalDays}
      extraAddresses={extraAddresses}
      setExtraAddresses={setExtraAddresses}
      payoutLabel={payoutLabel}
      canCreate={canCreate}
      onCreate={handleCreate}
      onCancel={onCancel}
    />
  );
}
