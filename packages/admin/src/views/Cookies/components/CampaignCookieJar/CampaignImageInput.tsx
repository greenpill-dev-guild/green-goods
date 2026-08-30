import { FileUploadField } from "@green-goods/shared/components/FileUploadField";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { logger } from "@green-goods/shared/modules/app/logger";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { uploadFileToIPFS } from "@green-goods/shared/modules/data/ipfs/upload";
import { extractErrorMessage } from "@green-goods/shared/utils/errors/extract-message";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { isValidCampaignCookieJarMetadataUrl } from "../../campaignCookieJarPanel.model";

export function CampaignImageInput({
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
              defaultMessage: "Hide Image URL",
            })
          : formatMessage({
              id: "cockpit.community.cookies.pasteImageUrl",
              defaultMessage: "Paste image URL",
            })}
      </AdminButton>
      {showUrlFallback ? (
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.campaignImage",
            defaultMessage: "Campaign image URL",
          })}
          htmlFor={`${source}-url`}
          error={
            value && !isValidCampaignCookieJarMetadataUrl(value)
              ? formatMessage({
                  id: "cockpit.community.cookies.invalidMetadataUrl",
                  defaultMessage: "Use an http(s), IPFS, or site-relative URL.",
                })
              : undefined
          }
        >
          <TextInput
            id={`${source}-url`}
            surface="admin"
            value={value}
            onChange={(event) => {
              onFileChange(null);
              onChange(event.target.value);
            }}
          />
        </FormField>
      ) : null}
    </div>
  );
}
