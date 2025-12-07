/**
 * Utility functions for work-related actions like download
 */

export interface WorkData {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: number;
  media: string[];
  metadata?: unknown;
  feedback?: string;
  gardenId: string;
}

/**
 * Downloads work metadata as JSON
 */
export function downloadWorkData(work: WorkData): void {
  const workData = {
    id: work.id,
    title: work.title,
    description: work.description,
    status: work.status,
    createdAt: new Date(work.createdAt).toISOString(),
    feedback: work.feedback,
    gardenId: work.gardenId,
    metadata: work.metadata,
    mediaCount: work.media?.length || 0,
  };

  const blob = new Blob([JSON.stringify(workData, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `work-${work.id}-data.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads work media files as a zip or individually
 */
export async function downloadWorkMedia(work: WorkData): Promise<void> {
  if (!work.media || work.media.length === 0) return;

  // For single file, download directly
  if (work.media.length === 1) {
    const url = work.media[0];
    const link = document.createElement("a");
    link.href = url;
    link.download = `work-${work.id}-media`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // For multiple files, download each one
  for (let i = 0; i < work.media.length; i++) {
    const url = work.media[i];
    const link = document.createElement("a");
    link.href = url;
    link.download = `work-${work.id}-media-${i + 1}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Shares work using the Web Share API or copies to clipboard
 */
export async function shareWork(work: WorkData): Promise<void> {
  const shareData = {
    title: work.title || `Work ${work.id}`,
    text: work.description || work.feedback || `Check out this work from garden ${work.gardenId}`,
    url: typeof window !== "undefined" ? window.location.href : "",
  };

  // Try Web Share API first
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // User cancelled or share failed, fall back to clipboard
      if ((err as Error).name === "AbortError") {
        return; // User cancelled
      }
    }
  }

  // Fall back to copying URL to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(shareData.url);
  }
}
