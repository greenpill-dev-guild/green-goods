// The photos staged on Submit Work's media step: how many against what the
// action requires, and each one as a tile that opens larger and can be removed.
// The count follows the PWA's media rule pill (amber until the requirement is
// met, then green with a tick) in the cockpit's own status badge. The tiles sit
// beside the shared FileUploadField, which keeps only its label and upload well
// here, so the four other admin forms that use it are untouched.
import { ImagePreviewDialog } from "@green-goods/shared/components/Dialog/ImagePreviewDialog";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  getWorkMediaId,
  isVideoFile,
  isWorkPhoto,
} from "@green-goods/shared/modules/work/media-processing";
import {
  RiCheckLine,
  RiCloseLine,
  RiFilmLine,
  RiImageAddLine,
  RiImageLine,
  RiZoomInLine,
} from "@remixicon/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { imagePreviewLabels } from "@/components/imagePreviewLabels";

export interface SubmitWorkPhotosProps {
  /** Media staged for this submission, in the order it was added. */
  images: File[];
  /** How many photos the action requires; 0 when photos are optional. */
  minRequired: number;
  onRemove: (index: number) => void;
}

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * 1024;

const OVERLAY_MOTION =
  "duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] motion-reduce:transition-none";

export function SubmitWorkPhotos({ images, minRequired, onRemove }: SubmitWorkPhotosProps) {
  const { formatMessage, formatNumber } = useIntl();
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const previewOpener = useRef<HTMLButtonElement | null>(null);

  // One object URL per staged photo, held for as long as the photo is staged, so
  // adding or removing one never re-decodes the others. A layout effect, so a new
  // tile paints with its picture instead of flashing the file tile first. A video,
  // or a HEIC still waiting to convert, is staged but is not a photo yet: it keeps
  // a file tile, with nothing to open.
  const liveUrls = useRef(new Map<File, string>());
  const [urls, setUrls] = useState<ReadonlyMap<File, string>>(() => new Map());
  useLayoutEffect(() => {
    const live = liveUrls.current;
    const staged = new Set(images);
    for (const [file, url] of live) {
      if (staged.has(file)) continue;
      URL.revokeObjectURL(url);
      live.delete(file);
    }
    for (const file of images) {
      if (!live.has(file) && isWorkPhoto(file)) live.set(file, URL.createObjectURL(file));
    }
    setUrls(new Map(live));
  }, [images]);
  useEffect(() => {
    const live = liveUrls.current;
    return () => {
      for (const url of live.values()) URL.revokeObjectURL(url);
      live.clear();
    };
  }, []);

  // The requirement is in photos, so only photos count: the same rule the Next
  // button and the submission check.
  const count = images.filter((file) => isWorkPhoto(file)).length;
  const met = count >= minRequired;
  const showCount = minRequired > 0 || count > 0;

  const previewable = images.filter((file) => urls.has(file));
  const previewIndex = previewFile ? previewable.indexOf(previewFile) : -1;
  const previewOpen = previewIndex >= 0;

  // Radix hands focus back to a dialog's trigger, and the shared preview has
  // none, so once it has closed return focus to the tile that opened it.
  useEffect(() => {
    if (previewOpen) return;
    previewOpener.current?.focus();
    previewOpener.current = null;
  }, [previewOpen]);

  const formatSize = (bytes: number) =>
    bytes < BYTES_PER_MEGABYTE
      ? formatNumber(Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE)), {
          style: "unit",
          unit: "kilobyte",
        })
      : formatNumber(bytes / BYTES_PER_MEGABYTE, {
          style: "unit",
          unit: "megabyte",
          maximumFractionDigits: 1,
        });

  return (
    <div className="space-y-3" data-component="SubmitWorkPhotos">
      {showCount ? (
        <StatusBadge
          variant={met ? "success" : "warning"}
          data-state={met ? "met" : "needed"}
          icon={
            met ? (
              <RiCheckLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <RiImageAddLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )
          }
        >
          {met
            ? formatMessage({ id: "app.garden.upload.mediaRule.added" }, { count })
            : formatMessage(
                { id: "app.garden.upload.mediaRule.needed" },
                { current: count, required: minRequired }
              )}
        </StatusBadge>
      ) : null}

      {images.length > 0 ? (
        <ul
          aria-label={formatMessage({ id: "app.admin.work.submit.section.photos" })}
          className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3"
        >
          {images.map((file, index) => {
            const url = urls.get(file);
            const previewLabel = formatMessage(
              { id: "app.admin.work.submit.photoPreview" },
              { filename: file.name }
            );
            return (
              <li key={getWorkMediaId(file)} className="min-w-0 space-y-1.5">
                <div className="relative">
                  {url ? (
                    <AdminButton
                      variant="text"
                      size="sm"
                      onClick={(event) => {
                        previewOpener.current = event.currentTarget;
                        setPreviewFile(file);
                      }}
                      aria-haspopup="dialog"
                      aria-label={previewLabel}
                      title={previewLabel}
                      className="group my-0 flex aspect-square h-auto w-full min-w-0 overflow-hidden rounded-lg border border-stroke-soft bg-bg-weak p-0"
                    >
                      <ImageWithFallback
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full"
                      />
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-static-black/0 transition-colors group-hover:bg-static-black/20 group-focus-visible:bg-static-black/20 ${OVERLAY_MOTION}`}
                      >
                        <RiZoomInLine
                          className={`h-6 w-6 text-static-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${OVERLAY_MOTION}`}
                        />
                      </span>
                    </AdminButton>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-lg border border-stroke-soft bg-bg-weak text-text-soft">
                      {isVideoFile(file) ? (
                        <RiFilmLine className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <RiImageLine className="h-6 w-6" aria-hidden="true" />
                      )}
                    </div>
                  )}
                  <AdminIconButton
                    variant="tonal"
                    size="sm"
                    label={formatMessage(
                      { id: "admin.fileUpload.remove" },
                      { filename: file.name }
                    )}
                    onClick={() => onRemove(index)}
                    className="absolute right-1.5 top-1.5 my-0 shadow-[var(--m3-elevation-1)]"
                  >
                    <RiCloseLine aria-hidden="true" />
                  </AdminIconButton>
                </div>
                <div className="min-w-0">
                  <p className="truncate body-xs font-medium text-text-strong" title={file.name}>
                    {file.name}
                  </p>
                  <p className="body-xs text-text-soft">{formatSize(file.size)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* The flow is itself a dialog on the modal layer, so the preview's scrim is
          lifted to that layer to cover it instead of sitting underneath. */}
      <ImagePreviewDialog
        className="!z-modal"
        labels={imagePreviewLabels(formatMessage)}
        isOpen={previewOpen}
        onClose={() => setPreviewFile(null)}
        images={previewable.map((file) => urls.get(file) ?? "")}
        initialIndex={Math.max(previewIndex, 0)}
      />
    </div>
  );
}

SubmitWorkPhotos.displayName = "SubmitWorkPhotos";
