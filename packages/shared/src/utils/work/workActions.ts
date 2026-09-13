import { mediaResourceManager } from "../../modules/job-queue/media-resource-manager";
import { resolveIPFSUrl } from "../../modules/data/ipfs/resolve";
import { connectivityStore } from "../../stores/connectivity";
import { shareLink } from "../app/clipboard";

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

  if (!connectivityStore.getSnapshot()) {
    // A new tab on a remote origin cannot read this app's Cache Storage.
    // Materialize verified originals locally before handing them to the browser.
    const owner = `work-download-${crypto.randomUUID()}`;
    try {
      const urls = await Promise.all(
        work.media.map(async (source) => {
          if (/^(blob:|data:)/.test(source)) return source;
          const url = resolveIPFSUrl(source);
          for (const name of ["image-cache", "ipfs-cache"]) {
            const response = await (await caches.open(name)).match(url);
            if (!response?.ok || response.type === "opaque") continue;
            const blob = await response.blob();
            if (blob.size === 0) continue;
            return mediaResourceManager.createUrl(
              new File([blob], "work-media", { type: blob.type }),
              owner
            );
          }
          throw new Error("Original media is not available offline");
        })
      );
      for (const [index, url] of urls.entries()) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `work-${work.id}-media-${index + 1}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } finally {
      setTimeout(() => mediaResourceManager.cleanupUrls(owner), 1_000);
    }
    return;
  }

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
  const url = new URL(window.location.href);
  const path = `/home/${encodeURIComponent(work.gardenId)}/work/${encodeURIComponent(work.id)}`;
  // Hash-router builds keep the gateway path; HTTPS builds use the app route directly.
  if (url.hash.startsWith("#/")) {
    url.hash = path;
  } else {
    url.pathname = path;
    url.hash = "";
  }
  url.search = "";
  await shareLink({
    title: work.title || `Work ${work.id}`,
    text: work.description || work.feedback || `Check out this work from garden ${work.gardenId}`,
    url: url.toString(),
  });
}
