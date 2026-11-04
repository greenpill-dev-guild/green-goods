import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import {
  type CampaignJarSync,
  useCampaignCookieJar,
  useCampaignCookieJarSync,
} from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import { useCampaignCookieJarCampaigns } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJarCampaigns";
import { useCookieJarFactoryAddress } from "@green-goods/shared/hooks/cookie-jar/useCookieJarFactoryAddress";
import { useRole } from "@green-goods/shared/hooks/gardener/useRole";
import { useTxErrorMessages } from "@green-goods/shared/hooks/utils/useTxErrorMessages";
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import {
  aggregateCampaignCookieJarStewards,
  buildCampaignCookieJarMetadata,
  CAMPAIGN_DESCRIPTION_MAX_LENGTH,
  diffCampaignCookieJarAllowlist,
} from "@green-goods/shared/utils/cookie-jar-campaign";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  canSyncCampaignCookieJarAllowlist,
  filterCampaignCookieJarCampaigns,
  getCampaignCookieJarPublicUrl,
  isValidCampaignCookieJarMetadataUrl,
  resolveCampaignCookieJarManageDraft,
} from "../../campaignCookieJarPanel.model";
import { CampaignCookieJarPanelView } from "./CampaignCookieJarPanelView";
import {
  gardensForAggregation,
  haveSameAddressSet,
  normalizeMetadataField,
  PUBLIC_COOKIE_BASE_URL,
} from "./helpers";

export interface CampaignCookieJarPanelProps {
  /** An action for the list's header, such as Create Cookie Jar. */
  headerAction?: ReactNode;
}

/** The campaign cookie jars list and its manage dialog. */
export function CampaignCookieJarPanel({ headerAction }: CampaignCookieJarPanelProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { isProtocolTeam, loading: roleLoading } = useRole();
  const { data: gardens = [] } = useGardens(chainId);
  const {
    campaigns,
    isLoading: campaignsLoading,
    error: campaignsError,
  } = useCampaignCookieJarCampaigns();
  const { factoryAddress, moduleConfigured } = useCookieJarFactoryAddress();

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
  const sync = useCampaignCookieJarSync(selectedJarAddress);
  const syncTxError = useTxErrorMessages(sync.error);

  useEffect(() => {
    if (!selectedCampaign) return;
    const draft = resolveCampaignCookieJarManageDraft(selectedCampaign, syncJar.jar?.metadata);
    setSyncGardenIds(draft.selectedGardenIds);
    setSyncExtraAddresses(draft.extraAddresses);
    setSyncCampaignDescription(draft.description);
    setSyncCampaignImage(draft.image);
    setSyncCampaignImageFile(null);
  }, [selectedCampaign, syncJar.jar?.metadata]);

  const visibleCampaigns = useMemo(
    () => filterCampaignCookieJarCampaigns(campaigns, campaignSearch),
    [campaignSearch, campaigns]
  );

  const syncMetadataUrlsValid = isValidCampaignCookieJarMetadataUrl(syncCampaignImage);
  const syncAggregation = useMemo(
    () =>
      aggregateCampaignCookieJarStewards({
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
  // The builder refuses a description past the limit, and it runs during
  // render here, so a description that does not fit is never handed to it.
  const syncDescriptionFits = syncCampaignDescription.length <= CAMPAIGN_DESCRIPTION_MAX_LENGTH;
  const syncMetadataPayload = useMemo(() => {
    if (
      !selectedCampaign ||
      !syncJar.jar ||
      !factoryAddress ||
      !syncMetadataChanged ||
      !syncDescriptionFits
    ) {
      return null;
    }
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
    syncDescriptionFits,
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
    metadataDescriptionFits: syncDescriptionFits,
    earlierSyncInDoubt: sync.isHeld || sync.isSettlingHold,
  });
  // One sync carries the allowlist change and the metadata that describes it.
  const pendingSync: CampaignJarSync | null =
    selectedJarAddress && canSync
      ? {
          jarAddress: selectedJarAddress,
          grant: syncDiff.grant,
          revoke: syncDiff.revoke,
          metadata:
            factoryAddress && syncMetadataPayload
              ? { factoryAddress, value: syncMetadataPayload }
              : null,
        }
      : null;
  const syncSignatures = pendingSync ? sync.signaturesFor(pendingSync) : null;

  const handleSync = () => {
    if (pendingSync) sync.send(pendingSync);
  };
  // An outcome stays on screen until this jar's dialog closes, so it is never read against
  // another jar.
  const selectCampaign = (campaign: CampaignCookieJarCampaign | null) => {
    if (!sync.isPending) sync.reset();
    setSelectedCampaign(campaign);
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
    <CampaignCookieJarPanelView
      {...{
        formatMessage,
        moduleConfigured,
        isProtocolTeam,
        roleLoading,
        campaigns,
        campaignsLoading,
        campaignsError,
        campaignSearch,
        setCampaignSearch,
        visibleCampaigns,
        setSelectedCampaign: selectCampaign,
        selectedCampaign,
        selectedCampaignTitle,
        selectedCampaignPublicUrl,
        syncPending: sync.isPending,
        syncSignatureLine:
          syncSignatures === null
            ? null
            : formatMessage(
                { id: "cockpit.community.cookies.signatureCount" },
                { count: syncSignatures }
              ),
        syncHold: sync.holdFeedback,
        // On a listed rail an unknown outcome is held, so the hold says it, not an error line.
        syncError:
          sync.error && !(sync.isHeld && syncTxError.view.kind === "unconfirmed")
            ? {
                severity: syncTxError.view.severity,
                title: syncTxError.title,
                message: syncTxError.message,
              }
            : null,
        canSync,
        handleSync,
        syncCampaignDescription,
        setSyncCampaignDescription,
        syncCampaignImage,
        setSyncCampaignImage,
        syncCampaignImageFile,
        setSyncCampaignImageFile,
        gardens,
        syncGardenIds,
        setSyncGardenIds,
        toggleSyncGarden,
        selectSyncGardens,
        syncGardenSearch,
        setSyncGardenSearch,
        syncExtraAddresses,
        setSyncExtraAddresses,
        syncAggregation,
        syncDiff,
        selectedJarAddress: selectedJarAddress ?? null,
        syncJar,
        headerAction,
      }}
    />
  );
}
