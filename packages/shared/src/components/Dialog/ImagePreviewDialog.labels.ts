/**
 * Every string the image preview renders or announces, so each surface can pass
 * its own translations. Split out of the component to keep it under the
 * file-length ceiling.
 */
export interface ImagePreviewDialogLabels {
  dialogLabel: string;
  title: string;
  description: string;
  zoomOut: string;
  resetZoom: string;
  zoomIn: string;
  downloadImage: string;
  closePreview: string;
  /** Short visible label on the editorial close pill; `closePreview` names it for assistive tech. */
  close: string;
  previousImage: string;
  nextImage: string;
  previewAlt: (index: number) => string;
  thumbnailAlt: (index: number) => string;
  goToImage: (index: number) => string;
}

export const defaultLabels: ImagePreviewDialogLabels = {
  dialogLabel: "Image preview",
  title: "Image preview",
  description: "Zoom, browse, or download this image.",
  zoomOut: "Zoom out",
  resetZoom: "Reset zoom",
  zoomIn: "Zoom in",
  downloadImage: "Download image",
  closePreview: "Close preview",
  close: "Close",
  previousImage: "Previous image",
  nextImage: "Next image",
  previewAlt: (index) => `Preview ${index}`,
  thumbnailAlt: (index) => `Thumbnail ${index}`,
  goToImage: (index) => `Go to image ${index}`,
};
