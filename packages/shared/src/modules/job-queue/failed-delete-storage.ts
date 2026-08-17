const FAILED_DELETE_IDS_KEY = "gg_failed_delete_job_ids";

export function loadFailedDeleteIds(): string[] {
  try {
    const stored = localStorage.getItem(FAILED_DELETE_IDS_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveFailedDeleteIds(ids: string[]): void {
  try {
    if (ids.length === 0) localStorage.removeItem(FAILED_DELETE_IDS_KEY);
    else localStorage.setItem(FAILED_DELETE_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Cleanup retry persistence is best-effort.
  }
}
