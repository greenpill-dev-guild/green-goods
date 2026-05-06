export const queueKeys = {
  all: ["greengoods", "queue"] as const,
  stats: () => ["greengoods", "queue", "stats"] as const,
  jobs: (filter?: { kind?: string; synced?: boolean }) =>
    ["greengoods", "queue", "jobs", filter] as const,
  pendingCount: () => ["greengoods", "queue", "pendingCount"] as const,
  uploading: () => ["greengoods", "queue", "uploading"] as const,
} as const;

export const offlineKeys = {
  all: ["greengoods", "offline"] as const,
  status: () => ["greengoods", "offline", "status"] as const,
  sync: () => ["greengoods", "offline", "sync"] as const,
} as const;

export const mediaKeys = {
  all: ["greengoods", "media"] as const,
  forJob: (jobId: string) => ["greengoods", "media", "job", jobId] as const,
} as const;

export const draftsKeys = {
  all: ["greengoods", "drafts"] as const,
  list: (userAddress: string, chainId: number) =>
    ["greengoods", "drafts", "list", userAddress, chainId] as const,
  detail: (draftId: string) => ["greengoods", "drafts", "detail", draftId] as const,
  images: (draftId: string) => ["greengoods", "drafts", "images", draftId] as const,
} as const;
