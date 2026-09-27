import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useCreateCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import { useCookieJarFactoryAddress } from "@green-goods/shared/hooks/cookie-jar/useCookieJarFactoryAddress";
import { useRole } from "@green-goods/shared/hooks/gardener/useRole";
import {
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
} from "@green-goods/shared/utils/blockchain/abis/erc20";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import {
  aggregateCampaignCookieJarStewards,
  type CampaignCookieJarPayoutAssetId,
  getCampaignCookieJarPayoutAssets,
  getDefaultCampaignCookieJarPayoutAsset,
  normalizeCampaignAddress,
} from "@green-goods/shared/utils/cookie-jar-campaign";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useStepFocus } from "@green-goods/shared/hooks/utils/useStepFocus";
import type { Address } from "@green-goods/shared/types/domain";
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
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { isCampaignCookieJarDraftDirty } from "./campaignCookieJarDraft";
import {
  CampaignCookieJarCreatedState,
  CampaignCookieJarSubmittedState,
} from "./CampaignCookieJarCreateStates";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";
import type {
  CampaignCookieJarCreateDialogProps,
  CampaignCookieJarCreateWorkspaceProps,
} from "./CampaignCookieJarCreateWorkspace.types";
import {
  CampaignCreateFooter,
  CampaignCreateStepBody,
  campaignCreateSteps,
} from "./CampaignCookieJarCreateSteps";
import { gardensForAggregation, parseAmountInput } from "./helpers";

/**
 * Create Cookie Jar: a flow dialog like every other create (DL-046), opened
 * from the Campaign Cookie Jars card on the protocol garden's Payouts. Steps:
 * Campaign, Payout, Eligible gardens, Review (Advanced is a detour there); the
 * created and submitted states are its final state. Each opening starts a new
 * draft.
 */
export function CampaignCookieJarCreateDialog({
  open,
  ...workspace
}: CampaignCookieJarCreateDialogProps) {
  return open ? <CampaignCookieJarCreateWorkspace {...workspace} /> : null;
}

/** The flow's draft, its steps, and its final states, inside the dialog. */
export function CampaignCookieJarCreateWorkspace({
  onClose,
  initialStep = 0,
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
      aggregateCampaignCookieJarStewards({
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
  const steps = campaignCreateSteps(formatMessage);
  const [stepIndex, setStepIndex] = useState(Math.min(initialStep, steps.length - 1));
  const stepRef = useStepFocus<HTMLDivElement>(stepIndex);
  const done = Boolean(createdJarAddress || createdJarPendingHash);
  const isDirty =
    !done &&
    isCampaignCookieJarDraftDirty(
      {
        campaignTitle,
        campaignDescription,
        campaignImage,
        hasImageFile: Boolean(campaignImageFile),
        selectedAssetId,
        customTokenAddress,
        claimAmount,
        withdrawalIntervalDays,
        jarOwner,
        selectedGardenIds,
        extraAddresses,
      },
      { selectedAssetId: defaultPayoutAsset?.id ?? "usdc", jarOwner: primaryAddress ?? "" }
    );
  // Route mode: the flow closes by navigating, so the blocker is the one
  // confirm, and a pending create keeps the flow open.
  const dirtyClose = useDirtyClose({
    isDirty,
    onClose,
    blockRouteChange: true,
    preventRouteChange: createJar.isPending,
  });
  const title = formatMessage({
    id: "cockpit.community.cookies.dialogTitle",
    defaultMessage: "Create Cookie Jar",
  });
  const form: CampaignCookieJarCreateFormProps = {
    formatMessage,
    moduleConfigured,
    isDeployer,
    roleLoading,
    createError: createJar.error,
    createPending: createJar.isPending,
    gardensLoading,
    factoryLoading,
    payoutAssets,
    defaultPayoutAsset: defaultPayoutAsset ?? undefined,
    selectedAssetId,
    setSelectedAssetId,
    campaignTitle,
    setCampaignTitle,
    campaignDescription,
    setCampaignDescription,
    campaignImage,
    setCampaignImage,
    campaignImageFile,
    setCampaignImageFile,
    publicCampaignUrl,
    claimAmount,
    setClaimAmount,
    tokenSymbol,
    gardens,
    selectedGardenIds,
    toggleGarden,
    selectGardens,
    clearGardens: () => setSelectedGardenIds([]),
    gardenSearch,
    setGardenSearch,
    aggregation,
    advancedOpen,
    setAdvancedOpen,
    customTokenAddress,
    setCustomTokenAddress,
    normalizedCustomTokenAddress,
    customTokenLoading,
    customTokenError,
    tokenDecimals,
    jarOwner,
    setJarOwner,
    normalizedJarOwner,
    withdrawalIntervalDays,
    setWithdrawalIntervalDays,
    extraAddresses,
    setExtraAddresses,
    payoutLabel,
    canCreate: canCreate && !gardensLoading && !factoryLoading,
  };
  const activeStep = steps[stepIndex];

  const body = createdJarAddress ? (
    <div ref={completionRef}>
      <CampaignCookieJarCreatedState
        jarAddress={createdJarAddress}
        onBackToList={onClose}
        onCreateAnother={() => {
          resetCreateForm();
          setStepIndex(0);
        }}
      />
    </div>
  ) : createdJarPendingHash ? (
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
        onBackToList={onClose}
      />
    </div>
  ) : activeStep ? (
    <div ref={stepRef} tabIndex={-1} className="outline-none">
      <CampaignCreateStepBody step={activeStep} form={form} />
    </div>
  ) : null;

  return (
    <>
      <AdminDialog
        open
        size="lg"
        variant="flow"
        tone="community"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={dirtyClose.onOpenChange}
        preventClose={createJar.isPending}
        title={title}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <ActionFlowShell
          layout="dialog"
          title={title}
          steps={done ? undefined : steps}
          currentStep={stepIndex + 1}
          onStepClick={(step) => {
            if (!createJar.isPending) setStepIndex(step - 1);
          }}
          footer={
            done ? undefined : (
              <CampaignCreateFooter
                formatMessage={formatMessage}
                isFirstStep={stepIndex === 0}
                isLastStep={stepIndex === steps.length - 1}
                pending={createJar.isPending}
                canCreate={form.canCreate}
                onCancel={() => dirtyClose.onOpenChange(false)}
                onBack={() => setStepIndex((index) => Math.max(0, index - 1))}
                onNext={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}
                onCreate={handleCreate}
              />
            )
          }
        >
          {body}
        </ActionFlowShell>
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="community"
      />
    </>
  );
}
