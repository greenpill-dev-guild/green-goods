import {
  cn,
  formatAddress,
  imageCompressor,
  isValidAddressFormat,
  logger,
  resolveIPFSUrl,
  suggestSlug,
  toastService,
  uploadFileToIPFS,
  useCreateGardenStore,
  useEnsAddress,
  useSlugAvailability,
  validateSlug,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { FileUploadField } from "../../FileUploadField";

interface DetailsStepProps {
  showValidation: boolean;
}

export function DetailsStep({ showValidation }: DetailsStepProps) {
  const form = useCreateGardenStore((s) => s.form);
  const setField = useCreateGardenStore((s) => s.setField);
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

  // Auto-suggest slug from garden name (only if slug hasn't been manually edited)
  const slugManuallyEdited = useRef(false);
  useEffect(() => {
    if (slugManuallyEdited.current || !form.name) return;
    setField("slug", suggestSlug(form.name));
  }, [form.name, setField]);

  // Slug availability check (tier 2: debounced RPC)
  const trimmedSlug = form.slug.trim();
  const slugValidation = useMemo(() => validateSlug(trimmedSlug), [trimmedSlug]);
  const { data: isSlugAvailable, isFetching: isCheckingSlug } = useSlugAvailability(
    slugValidation.valid ? trimmedSlug : undefined
  );

  const detailsErrors = useMemo(
    () => ({
      name: form.name.trim().length > 0 ? null : "Garden name is required",
      slug:
        trimmedSlug.length === 0
          ? "ENS slug is required"
          : slugValidation.valid
            ? null
            : slugValidation.error,
      description: form.description.trim().length > 0 ? null : "Description is required",
      location: form.location.trim().length > 0 ? null : "Location is required",
      communityToken:
        isValidAddressFormat(form.communityToken.trim()) || resolvedCommunityTokenAddress
          ? null
          : form.communityToken.trim().length === 0
            ? "Community token address is required"
            : resolvingCommunityTokenEns
              ? null // Don't show error while resolving
              : "Enter a valid wallet address or ENS name",
    }),
    [
      form.name,
      trimmedSlug,
      slugValidation,
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
      logger.error("Banner upload failed", { error });
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
        <span className="font-medium text-text-sub">ENS subdomain *</span>
        <div className="rounded-lg bg-bg-weak p-2">
          <div className="relative">
            <input
              value={form.slug}
              onChange={(event) => {
                slugManuallyEdited.current = true;
                setField("slug", event.target.value.toLowerCase());
              }}
              placeholder="eg. rio-rainforest-lab"
              inputMode="text"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "w-full rounded-md border border-stroke-soft bg-inherit px-3 py-2 pr-10 text-sm font-mono text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                showDetailsErrors &&
                  detailsErrors.slug &&
                  "border-error-base focus:border-error-base focus:ring-error-lighter",
                slugValidation.valid &&
                  isSlugAvailable === false &&
                  !isCheckingSlug &&
                  "border-error-base"
              )}
            />
            {/* Availability indicator */}
            {trimmedSlug.length > 0 && slugValidation.valid && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingSlug ? (
                  <RiLoader4Line
                    className="h-4 w-4 animate-spin text-text-soft"
                    aria-label="Checking availability"
                  />
                ) : isSlugAvailable ? (
                  <RiCheckLine className="h-4 w-4 text-green-500" aria-label="Name available" />
                ) : isSlugAvailable === false ? (
                  <RiCloseLine className="h-4 w-4 text-error-base" aria-label="Name taken" />
                ) : null}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-text-soft">
          {trimmedSlug
            ? `${trimmedSlug}.greengoods.eth`
            : "This will be your garden's ENS name on greengoods.eth"}
        </span>
        {slugValidation.valid && isSlugAvailable === false && !isCheckingSlug && (
          <span className="block text-xs text-error-base">This name is already taken</span>
        )}
        {/* Always render to reserve space and prevent layout shift */}
        <span className="block min-h-[1.25rem] text-xs text-error-base">
          {showDetailsErrors && detailsErrors.slug ? detailsErrors.slug : "\u00A0"}
        </span>
      </label>
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
