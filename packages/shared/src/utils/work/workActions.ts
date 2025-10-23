import { copyToClipboard } from "../app/clipboard";

/**
 * Utility functions for work-related actions like download and share
 */

export interface WorkData {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: number;
  media: string[];
  metadata?: any;
  feedback?: string;
  gardenId: string;
}

/**
 * Downloads work media files as a zip (simplified - downloads each file individually)
 */
export async function downloadWorkMedia(work: WorkData): Promise<void> {
  if (!work.media || work.media.length === 0) {
    throw new Error("No media files to download");
  }

  // For multiple files, download each individually
  for (let i = 0; i < work.media.length; i++) {
    const mediaUrl = work.media[i];
    const fileName = `work-${work.id}-media-${i + 1}.jpg`;
    await downloadFile(mediaUrl, fileName);
  }
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
 * Downloads a file from URL
 */
async function downloadFile(url: string, fileName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Shares work using Web Share API or fallback to clipboard
 */
export async function shareWork(work: WorkData): Promise<void> {
  const shareData = {
    title: `Work Submission: ${work.title}`,
    text: `Check out this work submission in the garden: ${work.title}`,
    url: window.location.href,
  };

  // Check if Web Share API is supported
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    await navigator.share(shareData);
    return;
  }

  // Fallback: Copy to clipboard
  await copyToClipboard(shareData.url);
}

/**
 * Creates a shareable link for work
 */
export function getWorkShareUrl(gardenId: string, workId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/home/${gardenId}/work/${workId}`;
}
