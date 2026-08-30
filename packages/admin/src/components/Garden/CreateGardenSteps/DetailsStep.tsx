import { FileUploadField } from "@green-goods/shared/components/FileUploadField";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import { GARDEN_NAME_MAX_LENGTH } from "@green-goods/shared/hooks/garden/useCreateGardenForm";
import { logger } from "@green-goods/shared/modules/app/logger";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { uploadFileToIPFS } from "@green-goods/shared/modules/data/ipfs/upload";
import { useCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import { DOMAIN_COLORS, Domain } from "@green-goods/shared/types/domain";
import { suggestSlug, validateSlug } from "@green-goods/shared/utils/blockchain/ens";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { imageCompressor } from "@green-goods/shared/utils/work/image-compression";
import { RiCheckLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminFieldGroup } from "../../AdminFieldGroup";
import { AdminSelectableCard } from "../../AdminSelectableCard";
import { AdminTextArea, AdminTextField } from "../../AdminTextField";

type DetailField = "name" | "slug" | "description" | "location";

const DOMAIN_OPTIONS = [
  {
    value: Domain.SOLAR,
    labelId: "app.garden.create.domain.solar",
    defaultLabel: "Solar",
    descriptionId: "app.garden.create.domain.solar.description",
    defaultDescription: "Track solar panel installations, kWh generated, and maintenance",
  },
  {
    value: Domain.AGRO,
    labelId: "app.garden.create.domain.agro",
    defaultLabel: "Agroforestry",
    descriptionId: "app.garden.create.domain.agro.description",
    defaultDescription: "Document tree planting, harvests, and land stewardship",
  },
  {
    value: Domain.EDU,
    labelId: "app.garden.create.domain.edu",
    defaultLabel: "Education",
    descriptionId: "app.garden.create.domain.edu.description",
    defaultDescription: "Record workshops, trainings, and knowledge sharing",
  },
  {
    value: Domain.WASTE,
    labelId: "app.garden.create.domain.waste",
    defaultLabel: "Waste",
    descriptionId: "app.garden.create.domain.waste.description",
    defaultDescription: "Log waste collection, recycling, and composting activities",
  },
] as const;

interface DetailsStepProps {
  showValidation: boolean;
}

export function DetailsStep({ showValidation }: DetailsStepProps) {
  const { formatMessage } = useIntl();
  const form = useCreateGardenStore((s) => s.form);
  const setField = useCreateGardenStore((s) => s.setField);
  const domains = useCreateGardenStore((s) => s.form.domains) ?? [];
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
        form.name.trim().length === 0
          ? formatMessage({
              id: "app.garden.create.nameRequired",
              defaultMessage: "Garden name is required",
            })
          : form.name.length > GARDEN_NAME_MAX_LENGTH
            ? formatMessage(
                {
                  id: "app.garden.create.nameTooLong",
                  defaultMessage: "Garden name must be {max} characters or less",
                },
                { max: GARDEN_NAME_MAX_LENGTH }
              )
            : null,
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

  const toggleDomain = (domain: Domain) => {
    const next = domains.includes(domain)
      ? domains.filter((d) => d !== domain)
      : [...domains, domain];
    if (next.length > 0) {
      setField("domains", next);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <div>
          <AdminTextField
            id="create-garden-name"
            label={formatMessage({
              id: "app.garden.create.gardenNameLabel",
              defaultMessage: "Garden name",
            })}
            required
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            onBlur={() => handleFieldBlur("name")}
            placeholder={formatMessage({
              id: "admin.details.namePlaceholder",
              defaultMessage: "e.g., Rio rainforest lab",
            })}
            error={showFieldError("name") && detailsErrors.name ? detailsErrors.name : undefined}
            helperText={" "}
            inputProps={{ maxLength: GARDEN_NAME_MAX_LENGTH }}
          />
          <p
            className={cn(
              "mt-1 text-right label-xs tabular-nums",
              form.name.length > GARDEN_NAME_MAX_LENGTH
                ? "text-error-dark"
                : form.name.length > GARDEN_NAME_MAX_LENGTH * 0.85
                  ? "text-warning-dark"
                  : "text-text-soft"
            )}
          >
            {form.name.length}/{GARDEN_NAME_MAX_LENGTH}
          </p>
        </div>
        <AdminTextField
          id="create-garden-location"
          label={formatMessage({
            id: "app.garden.create.locationLabel",
            defaultMessage: "Location",
          })}
          required
          value={form.location}
          onChange={(event) => setField("location", event.target.value)}
          onBlur={() => handleFieldBlur("location")}
          placeholder={formatMessage({
            id: "admin.details.locationPlaceholder",
            defaultMessage: "City, country or coordinates",
          })}
          error={
            showFieldError("location") && detailsErrors.location
              ? detailsErrors.location
              : undefined
          }
          helperText={" "}
        />
      </div>
      <AdminTextField
        id="create-garden-slug"
        className="font-mono"
        label={formatMessage({
          id: "app.garden.create.ensSubdomainLabel",
          defaultMessage: "ENS subdomain",
        })}
        required
        value={form.slug}
        onChange={(event) => {
          slugManuallyEdited.current = true;
          setField("slug", event.target.value.toLowerCase());
        }}
        onBlur={() => handleFieldBlur("slug")}
        placeholder={formatMessage({
          id: "admin.details.slugPlaceholder",
          defaultMessage: "e.g., rio-rainforest-lab",
        })}
        trailingIcon={
          trimmedSlug.length > 0 && slugValidation.valid
            ? isCheckingSlug
              ? SlugCheckingIcon
              : isSlugAvailable
                ? SlugAvailableIcon
                : isSlugAvailable === false
                  ? SlugTakenIcon
                  : undefined
            : undefined
        }
        error={
          showFieldError("slug") && detailsErrors.slug
            ? detailsErrors.slug
            : slugValidation.valid && isSlugAvailable === false && !isCheckingSlug
              ? formatMessage({
                  id: "app.garden.create.slugTaken",
                  defaultMessage: "This name is already taken",
                })
              : undefined
        }
        helperText={
          trimmedSlug
            ? `${trimmedSlug}.greengoods.eth`
            : formatMessage({
                id: "app.garden.create.ensHint",
                defaultMessage: "This will be your garden's ENS name on greengoods.eth",
              })
        }
        inputProps={{
          inputMode: "text",
          autoCapitalize: "none",
          autoComplete: "off",
          spellCheck: false,
        }}
      />
      <AdminTextArea
        id="create-garden-description"
        label={formatMessage({
          id: "app.garden.create.descriptionLabel",
          defaultMessage: "Description",
        })}
        required
        value={form.description}
        onChange={(event) => setField("description", event.target.value)}
        onBlur={() => handleFieldBlur("description")}
        placeholder={formatMessage({
          id: "admin.details.descriptionPlaceholder",
          defaultMessage: "Share the story, mission and unique traits of the garden.",
        })}
        rows={3}
        error={
          showFieldError("description") && detailsErrors.description
            ? detailsErrors.description
            : undefined
        }
        helperText={" "}
      />
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
      <AdminFieldGroup
        as="div"
        label={formatMessage({
          id: "app.garden.create.domains.title",
          defaultMessage: "Action domains",
        })}
        hint={formatMessage({
          id: "app.garden.create.domains.description",
          defaultMessage:
            "Select which regenerative domains this garden will focus on. Your domain selection determines which work actions are available to gardeners.",
        })}
        error={
          showValidation && domains.length === 0
            ? formatMessage({
                id: "app.garden.create.domains.required",
                defaultMessage: "Select at least one domain",
              })
            : undefined
        }
        contentClassName="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {DOMAIN_OPTIONS.map(
          ({ value, labelId, defaultLabel, descriptionId, defaultDescription }) => {
            const isSelected = domains.includes(value);
            return (
              <AdminSelectableCard
                key={value}
                onClick={() => toggleDomain(value)}
                selected={isSelected}
                title={formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                description={formatMessage({
                  id: descriptionId,
                  defaultMessage: defaultDescription,
                })}
                leadingVisual={
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: DOMAIN_COLORS[value] }}
                  />
                }
              />
            );
          }
        )}
      </AdminFieldGroup>
    </div>
  );
}

// Slug availability indicators for the ENS field's trailing slot. The slot is
// presentational (the taken state also renders as field error text).
function SlugCheckingIcon({ className }: { className?: string }) {
  return <RiLoader4Line className={cn(className, "animate-spin text-text-soft")} />;
}
function SlugAvailableIcon({ className }: { className?: string }) {
  return <RiCheckLine className={cn(className, "text-success-dark")} />;
}
function SlugTakenIcon({ className }: { className?: string }) {
  return <RiCloseLine className={cn(className, "[color:rgb(var(--m3-error))]")} />;
}
