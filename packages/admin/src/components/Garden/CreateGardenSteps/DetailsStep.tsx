import {
  cn,
  imageCompressor,
  logger,
  resolveIPFSUrl,
  suggestSlug,
  toastService,
  uploadFileToIPFS,
  useCreateGardenStore,
  useSlugAvailability,
  validateSlug,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { FileUploadField } from "../../FileUploadField";

type DetailField = "name" | "slug" | "description" | "location";

interface DetailsStepProps {
  showValidation: boolean;
}

export function DetailsStep({ showValidation }: DetailsStepProps) {
  const { formatMessage } = useIntl();
  const form = useCreateGardenStore((s) => s.form);
  const setField = useCreateGardenStore((s) => s.setField);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState(0);
  const [touchedFields, setTouchedFields] = useState<Record<DetailField, boolean>>({
    name: false,
    slug: false,
    description: false,
    location: false,
  });

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
      name:
        form.name.trim().length > 0
          ? null
          : formatMessage({
              id: "app.garden.create.nameRequired",
              defaultMessage: "Garden name is required",
            }),
      slug:
        trimmedSlug.length === 0
          ? formatMessage({
              id: "app.garden.create.slugRequired",
              defaultMessage: "ENS slug is required",
            })
          : slugValidation.valid
            ? null
            : slugValidation.error,
      description:
        form.description.trim().length > 0
          ? null
          : formatMessage({
              id: "app.garden.create.descriptionRequired",
              defaultMessage: "Description is required",
            }),
      location:
        form.location.trim().length > 0
          ? null
          : formatMessage({
              id: "app.garden.create.locationRequired",
              defaultMessage: "Location is required",
            }),
    }),
    [form.name, trimmedSlug, slugValidation, form.description, form.location, formatMessage]
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
      setBannerUploadProgress(50);

      const uploadResult = await uploadFileToIPFS(file);
      const ipfsUrl = resolveIPFSUrl(uploadResult.cid);

      setField("bannerImage", ipfsUrl);
      setBannerFile(file);
      setBannerUploadProgress(100);

      toastService.success({
        title: formatMessage({
          id: "app.garden.create.bannerUploaded",
          defaultMessage: "Banner uploaded",
        }),
        message: formatMessage({
          id: "app.garden.create.bannerUploadedMessage",
          defaultMessage: "Image uploaded successfully to IPFS",
        }),
        context: "banner upload",
        suppressLogging: true,
      });
    } catch (error) {
      logger.error("Banner upload failed", { error });
      toastService.error({
        title: formatMessage({
          id: "app.garden.create.uploadFailed",
          defaultMessage: "Upload failed",
        }),
        message: formatMessage({
          id: "app.garden.create.uploadFailedMessage",
          defaultMessage: "Could not upload banner image. Please try again.",
        }),
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

  const handleFieldBlur = (field: DetailField) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const showFieldError = (field: DetailField) => showValidation || touchedFields[field];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-text-strong">
            {formatMessage({
              id: "app.garden.create.gardenNameLabel",
              defaultMessage: "Garden name *",
            })}
          </span>
          <input
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            onBlur={() => handleFieldBlur("name")}
            placeholder={formatMessage({
              id: "admin.details.namePlaceholder",
              defaultMessage: "eg. Rio rainforest lab",
            })}
            aria-required="true"
            aria-invalid={showFieldError("name") && !!detailsErrors.name}
            aria-describedby="name-error"
            className={cn(
              "w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
              showFieldError("name") &&
                detailsErrors.name &&
                "border-error-base focus:border-error-base focus:ring-error-lighter"
            )}
          />
          <span
            id="name-error"
            role="alert"
            className="block min-h-[1.25rem] text-xs text-error-base"
          >
            {showFieldError("name") && detailsErrors.name ? detailsErrors.name : "\u00A0"}
          </span>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-text-strong">
            {formatMessage({ id: "app.garden.create.locationLabel", defaultMessage: "Location *" })}
          </span>
          <input
            value={form.location}
            onChange={(event) => setField("location", event.target.value)}
            onBlur={() => handleFieldBlur("location")}
            placeholder={formatMessage({
              id: "admin.details.locationPlaceholder",
              defaultMessage: "City, country or coordinates",
            })}
            aria-required="true"
            aria-invalid={showFieldError("location") && !!detailsErrors.location}
            aria-describedby="location-error"
            className={cn(
              "w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
              showFieldError("location") &&
                detailsErrors.location &&
                "border-error-base focus:border-error-base focus:ring-error-lighter"
            )}
          />
          <span
            id="location-error"
            role="alert"
            className="block min-h-[1.25rem] text-xs text-error-base"
          >
            {showFieldError("location") && detailsErrors.location
              ? detailsErrors.location
              : "\u00A0"}
          </span>
        </label>
      </div>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium text-text-strong">
          {formatMessage({
            id: "app.garden.create.ensSubdomainLabel",
            defaultMessage: "ENS subdomain *",
          })}
        </span>
        <div className="relative">
          <input
            value={form.slug}
            onChange={(event) => {
              slugManuallyEdited.current = true;
              setField("slug", event.target.value.toLowerCase());
            }}
            onBlur={() => handleFieldBlur("slug")}
            placeholder={formatMessage({
              id: "admin.details.slugPlaceholder",
              defaultMessage: "eg. rio-rainforest-lab",
            })}
            inputMode="text"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-required="true"
            aria-invalid={showFieldError("slug") && !!detailsErrors.slug}
            aria-describedby="slug-error"
            className={cn(
              "w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 pr-10 text-sm font-mono text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
              showFieldError("slug") &&
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
                <RiCheckLine className="h-4 w-4 text-primary-base" aria-label="Name available" />
              ) : isSlugAvailable === false ? (
                <RiCloseLine className="h-4 w-4 text-error-base" aria-label="Name taken" />
              ) : null}
            </span>
          )}
        </div>
        <span className="text-xs text-text-soft">
          {trimmedSlug
            ? `${trimmedSlug}.greengoods.eth`
            : formatMessage({
                id: "app.garden.create.ensHint",
                defaultMessage: "This will be your garden's ENS name on greengoods.eth",
              })}
        </span>
        {slugValidation.valid && isSlugAvailable === false && !isCheckingSlug && (
          <span className="block text-xs text-error-base">
            {formatMessage({
              id: "app.garden.create.slugTaken",
              defaultMessage: "This name is already taken",
            })}
          </span>
        )}
        <span
          id="slug-error"
          role="alert"
          className="block min-h-[1.25rem] text-xs text-error-base"
        >
          {showFieldError("slug") && detailsErrors.slug ? detailsErrors.slug : "\u00A0"}
        </span>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium text-text-strong">
          {formatMessage({
            id: "app.garden.create.descriptionLabel",
            defaultMessage: "Description *",
          })}
        </span>
        <textarea
          value={form.description}
          onChange={(event) => setField("description", event.target.value)}
          onBlur={() => handleFieldBlur("description")}
          placeholder={formatMessage({
            id: "admin.details.descriptionPlaceholder",
            defaultMessage: "Share the story, mission and unique traits of the garden.",
          })}
          rows={3}
          aria-required="true"
          aria-invalid={showFieldError("description") && !!detailsErrors.description}
          aria-describedby="description-error"
          className={cn(
            "w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
            showFieldError("description") &&
              detailsErrors.description &&
              "border-error-base focus:border-error-base focus:ring-error-lighter"
          )}
        />
        <span
          id="description-error"
          role="alert"
          className="block min-h-[1.25rem] text-xs text-error-base"
        >
          {showFieldError("description") && detailsErrors.description
            ? detailsErrors.description
            : "\u00A0"}
        </span>
      </label>
      <div className="space-y-1.5 text-sm">
        <FileUploadField
          label={formatMessage({
            id: "app.garden.create.bannerImageLabel",
            defaultMessage: "Banner image",
          })}
          helpText={formatMessage({
            id: "app.garden.create.bannerImageHelp",
            defaultMessage: "Upload a hero image showcasing the garden (optional)",
          })}
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
            <span>
              {formatMessage(
                { id: "app.garden.create.uploading", defaultMessage: "Uploading... {progress}%" },
                { progress: Math.round(bannerUploadProgress) }
              )}
            </span>
          </div>
        )}
        {form.bannerImage && !bannerFile && (
          <div className="mt-2">
            <img src={form.bannerImage} alt="" className="h-24 w-full rounded-lg object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
