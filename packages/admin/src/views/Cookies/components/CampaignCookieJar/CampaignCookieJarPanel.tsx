import {
  aggregateCampaignCookieJarStewards,
  buildCampaignCookieJarMetadata,
  diffCampaignCookieJarAllowlist,
  type CampaignCookieJarCampaign,
  type Garden,
  useCampaignCookieJar,
  useCampaignCookieJarCampaigns,
  useCookieJarFactoryAddress,
  useCurrentChain,
  useGardens,
  useRole,
  useSyncCampaignCookieJarAllowlist,
  useUpdateCampaignCookieJarMetadata,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
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
    <CampaignCookieJarPanelView
      {...{
        formatMessage,
        moduleConfigured,
        isDeployer,
        roleLoading,
        campaigns,
        campaignsLoading,
        campaignsError,
        campaignSearch,
        setCampaignSearch,
        visibleCampaigns,
        gardensByAddress,
        setSelectedCampaign,
        selectedCampaign,
        selectedCampaignTitle,
        selectedCampaignPublicUrl,
        syncAllowlist,
        updateMetadata,
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
      }}
    />
  );
}
