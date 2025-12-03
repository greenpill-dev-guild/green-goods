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
