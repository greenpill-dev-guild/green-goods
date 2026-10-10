import type { ImagePreviewDialogLabels } from "@green-goods/shared/components/Dialog/ImagePreviewDialog";
import type { IntlShape } from "react-intl";

/**
 * The shared image preview's labels in the steward's language. The dialog falls
 * back to English for any it is not given, so a cockpit surface that opens it
 * passes these.
 */
export function imagePreviewLabels(
  formatMessage: IntlShape["formatMessage"]
): ImagePreviewDialogLabels {
  const title = formatMessage({ id: "app.imagePreview.title" });
  return {
    dialogLabel: title,
    title,
    description: formatMessage({ id: "app.imagePreview.description" }),
    zoomOut: formatMessage({ id: "app.imagePreview.zoomOut" }),
    resetZoom: formatMessage({ id: "app.imagePreview.resetZoom" }),
    zoomIn: formatMessage({ id: "app.imagePreview.zoomIn" }),
    downloadImage: formatMessage({ id: "app.imagePreview.download" }),
    closePreview: formatMessage({ id: "app.admin.work.closePreview" }),
    close: formatMessage({ id: "app.common.close" }),
    previousImage: formatMessage({ id: "app.imagePreview.previous" }),
    nextImage: formatMessage({ id: "app.imagePreview.next" }),
    previewAlt: (n) => formatMessage({ id: "app.imagePreview.alt" }, { n }),
    thumbnailAlt: (n) => formatMessage({ id: "app.imagePreview.thumbnailAlt" }, { n }),
    goToImage: (n) => formatMessage({ id: "app.imagePreview.goTo" }, { n }),
  };
}
