import { imageCompressor, toastService } from "@green-goods/shared";
import { useEnsAddress } from "@green-goods/shared/hooks";
import { type CreateGardenFormState, isValidAddress } from "@green-goods/shared/stores";
import { cn, formatAddress } from "@green-goods/shared/utils";
import { uploadFileToIPFS, resolveIPFSUrl } from "@green-goods/shared/modules";
import { RiLoader4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { FileUploadField } from "../../FileUploadField";

interface DetailsStepProps {
  form: {
    name: string;
    description: string;
    location: string;
    communityToken: string;
    bannerImage: string;
  };
  setField: <K extends keyof CreateGardenFormState>(
    field: K,
    value: CreateGardenFormState[K]
  ) => void;
  showValidation: boolean;
}

export function DetailsStep({ form, setField, showValidation }: DetailsStepProps) {
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState(0);

  // ENS resolution for community token
  const trimmedCommunityToken = form.communityToken.trim();
  const isCommunityTokenHexAddress = useMemo(
    () => (trimmedCommunityToken ? isAddress(trimmedCommunityToken) : false),
    [trimmedCommunityToken]
  );
  const shouldResolveCommunityTokenEns =
    trimmedCommunityToken.length > 2 && !isCommunityTokenHexAddress;
  const { data: resolvedCommunityTokenAddress, isFetching: resolvingCommunityTokenEns } =
    useEnsAddress(shouldResolveCommunityTokenEns ? trimmedCommunityToken : null, {
      enabled: shouldResolveCommunityTokenEns,
    });

  // Auto-update form field when ENS resolves
  useEffect(() => {
    if (resolvedCommunityTokenAddress && shouldResolveCommunityTokenEns) {
      setField("communityToken", resolvedCommunityTokenAddress);
    }
  }, [resolvedCommunityTokenAddress, shouldResolveCommunityTokenEns, setField]);

  const detailsErrors = useMemo(
    () => ({
      name: form.name.trim().length > 0 ? null : "Garden name is required",
      description: form.description.trim().length > 0 ? null : "Description is required",
      location: form.location.trim().length > 0 ? null : "Location is required",
      communityToken:
        isValidAddress(form.communityToken.trim()) || resolvedCommunityTokenAddress
          ? null
          : form.communityToken.trim().length === 0
            ? "Community token address is required"
            : resolvingCommunityTokenEns
              ? null // Don't show error while resolving
              : "Enter a valid wallet address or ENS name",
    }),
    [
      form.name,
      form.description,
      form.location,
      form.communityToken,
      resolvedCommunityTokenAddress,
      resolvingCommunityTokenEns,
    ]
  );

  const handleBannerUpload = async (files: File[]) => {
    let file = files[0];
    if (!file) return;

    setIsUploadingBanner(true);
    setBannerUploadProgress(0);

    try {
      // Compress if needed (files over 1MB)
      const shouldCompress = imageCompressor.shouldCompress(file, 1024);
      if (shouldCompress) {
        const result = await imageCompressor.compressImage(
          file,
          { maxSizeMB: 0.8, maxWidthOrHeight: 2048 },
          (progress) => setBannerUploadProgress(progress * 0.5)
        );
        file = result.file;
      } else {
        // Skip to 50% if no compression needed
        setBannerUploadProgress(50);
      }

      // Upload to IPFS (remaining 50%)
      const uploadStartProgress = shouldCompress ? 50 : 50;
      setBannerUploadProgress(uploadStartProgress);

      const uploadResult = await uploadFileToIPFS(file);
      const ipfsUrl = resolveIPFSUrl(uploadResult.cid);

      setField("bannerImage", ipfsUrl);
      setBannerFile(file);
      setBannerUploadProgress(100);

      toastService.success({
        title: "Banner uploaded",
        message: "Image uploaded successfully to IPFS",
        context: "banner upload",
        suppressLogging: true,
      });
    } catch (error) {
      console.error("Banner upload failed:", error);
      toastService.error({
        title: "Upload failed",
        message: "Could not upload banner image. Please try again.",
        context: "banner upload",
        error,
      });
    } finally {
      setIsUploadingBanner(false);
      setBannerUploadProgress(0);
    }
  };

  const handleRemoveBanner = () => {
    setBannerFile(null);
    setField("bannerImage", "");
  };

  const showDetailsErrors = showValidation;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
        <label className="space-y-0.5 text-sm">
          <span className="font-medium text-text-sub">Garden name *</span>
          <div className="rounded-lg bg-bg-weak p-2">
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="eg. Rio rainforest lab"
              className={cn(
                "w-full rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                showDetailsErrors &&
                  detailsErrors.name &&
                  "border-error-base focus:border-error-base focus:ring-error-lighter"
              )}
            />
          </div>
          {/* Always render to reserve space and prevent layout shift */}
          <span className="block min-h-[1.25rem] text-xs text-error-base">
            {showDetailsErrors && detailsErrors.name ? detailsErrors.name : "\u00A0"}
          </span>
        </label>
        <label className="space-y-0.5 text-sm">
          <span className="font-medium text-text-sub">Location *</span>
          <div className="rounded-lg bg-bg-weak p-2">
            <input
              value={form.location}
              onChange={(event) => setField("location", event.target.value)}
              placeholder="City, country or coordinates"
              className={cn(
                "w-full rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                showDetailsErrors &&
                  detailsErrors.location &&
                  "border-error-base focus:border-error-base focus:ring-error-lighter"
              )}
            />
          </div>
          {/* Always render to reserve space and prevent layout shift */}
          <span className="block min-h-[1.25rem] text-xs text-error-base">
            {showDetailsErrors && detailsErrors.location ? detailsErrors.location : "\u00A0"}
          </span>
        </label>
      </div>
      <label className="space-y-0.5 text-sm">
        <span className="font-medium text-text-sub">Description *</span>
        <div className="rounded-lg bg-bg-weak p-2">
          <textarea
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            placeholder="Share the story, mission and unique traits of the garden."
            rows={3}
            className={cn(
              "w-full rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
              showDetailsErrors &&
                detailsErrors.description &&
                "border-error-base focus:border-error-base focus:ring-error-lighter"
            )}
          />
        </div>
        {/* Always render to reserve space and prevent layout shift */}
        <span className="block min-h-[1.25rem] text-xs text-error-base">
          {showDetailsErrors && detailsErrors.description ? detailsErrors.description : "\u00A0"}
        </span>
      </label>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
        <label className="space-y-0.5 text-sm">
          <span className="font-medium text-text-sub">Community token address *</span>
          <div className="rounded-lg bg-bg-weak p-2">
            <input
              value={form.communityToken}
              onChange={(event) => setField("communityToken", event.target.value)}
              placeholder="0x... or token.eth"
              className={cn(
                "w-full rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm font-mono text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                showDetailsErrors &&
                  detailsErrors.communityToken &&
                  "border-error-base focus:border-error-base focus:ring-error-lighter"
              )}
            />
          </div>
          <span className="text-xs text-text-soft">
            Must match the ERC-20 token powering the community.
          </span>
          {shouldResolveCommunityTokenEns && (
            <span className="text-xs text-text-soft">
              {resolvingCommunityTokenEns
                ? "Resolving ENS name..."
                : resolvedCommunityTokenAddress
                  ? `Resolves to ${formatAddress(resolvedCommunityTokenAddress)}`
                  : "Enter a valid ENS name or 0x address."}
            </span>
          )}
          {/* Always render to reserve space and prevent layout shift */}
          <span className="block min-h-[1.25rem] text-xs text-error-base">
            {showDetailsErrors && detailsErrors.communityToken
              ? detailsErrors.communityToken
              : "\u00A0"}
          </span>
        </label>
        <div className="space-y-0.5 text-sm">
          <FileUploadField
            label="Banner image"
            helpText="Upload a hero image showcasing the garden (optional)"
            accept="image/*"
            multiple={false}
            compress={true}
            showPreview={true}
            disabled={isUploadingBanner}
            onFilesChange={handleBannerUpload}
            currentFiles={bannerFile ? [bannerFile] : []}
            onRemoveFile={handleRemoveBanner}
          />
          {isUploadingBanner && (
            <div className="flex items-center gap-2 text-xs text-text-sub">
              <RiLoader4Line className="h-4 w-4 animate-spin" />
              <span>Uploading... {Math.round(bannerUploadProgress)}%</span>
            </div>
          )}
          {form.bannerImage && !bannerFile && (
            <div className="mt-2">
              <p className="text-xs text-text-soft">Current URL:</p>
              <p className="mt-1 break-all text-xs font-mono text-text-sub">{form.bannerImage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
