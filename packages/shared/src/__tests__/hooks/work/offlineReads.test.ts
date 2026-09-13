/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({
  works: vi.fn(),
  approvals: vi.fn(),
  jobs: vi.fn(),
  mine: vi.fn(),
  images: vi.fn(),
  preview: vi.fn((_file: File, _owner: string, _identity: string) => "blob:restored-evidence"),
}));
vi.mock("../../../modules/data/eas", () => ({
  getWorks: seams.works,
  getWorksByGardener: seams.mine,
  getRecentWorks: seams.works,
  getWorkApprovals: seams.approvals,
}));
vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { getJobs: seams.jobs },
}));
vi.mock("../../../modules/job-queue/event-bus", () => ({
  jobQueueEventBus: { onMultiple: () => () => {} },
  useJobQueueEvents: () => {},
}));
vi.mock("../../../modules/job-queue/db", () => ({
  jobQueueDB: { getImagesForJob: seams.images },
}));
vi.mock("../../../modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: { getOrCreateUrl: seams.preview, cleanupUrls: () => {} },
}));
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ user: { id: "0x1111111111111111111111111111111111111111" } }),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1111111111111111111111111111111111111111",
}));
vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 11155111 }));
import { useWorks } from "../../../hooks/work/useWorks";
import { useMyWorks } from "../../../hooks/work/useMyWorks";
import { restoreWorkFile } from "../../../modules/work/work-attachments";
import { worksKeys } from "../../../config/query-keys/work";

const garden = "0x2222222222222222222222222222222222222222";
const now = 1_800_000_000;
const cachedWork = {
  id: "indexed-work",
  title: "Previously downloaded work",
  actionUID: 1,
  gardenerAddress: "0x3333333333333333333333333333333333333333",
  gardenAddress: garden,
  feedback: "",
  metadata: "{}",
  media: [],
  createdAt: now - 3600,
  status: "pending",
};
const queuedJob = {
  id: "local-work",
  userAddress: "0x1111111111111111111111111111111111111111",
  chainId: 11155111,
  kind: "work",
  createdAt: now * 1000,
  synced: false,
  attempts: 0,
  payload: {
    gardenAddress: garden,
    actionUID: 1,
    title: "New local work",
    feedback: "",
    details: "",
    tags: [],
    timeSpentMinutes: 10,
  },
};
let client: QueryClient;
function mount() {
  return renderHook(() => useWorks(garden, { offline: true }), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  onlineManager.setOnline(false);
  client = new QueryClient({
    defaultOptions: {
      queries: { networkMode: "offlineFirst", retry: 2, retryDelay: 0, gcTime: Infinity },
    },
  });
  seams.works.mockResolvedValue([]);
  seams.approvals.mockResolvedValue([]);
  seams.jobs.mockResolvedValue([]);
  seams.mine.mockResolvedValue([]);
  seams.images.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  client.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  onlineManager.setOnline(true);
});
describe("offline work reading", () => {
  it("renders cached work without waiting for a network-only approvals read", async () => {
    onlineManager.setOnline(true);
    client.setQueryData(worksKeys.online(garden, 11155111), [cachedWork]);
    seams.approvals.mockImplementation(() => new Promise(() => {}));
    const { result } = mount();
    await waitFor(() => expect(seams.approvals).toHaveBeenCalled());
    expect(result.current.works.map((work) => work.id)).toContain("indexed-work");
  });
  it("keeps a different gardener's newly queued work visible beside an hour-old work of the same action", async () => {
    client.setQueryData(worksKeys.online(garden, 11155111), [cachedWork]);
    seams.jobs.mockResolvedValue([queuedJob]);
    const { result } = mount();
    await waitFor(() =>
      expect(result.current.works.map((work) => work.id)).toContain("indexed-work")
    );
    await waitFor(() =>
      expect(result.current.works.map((work) => work.id)).toContain("local-work")
    );
  });
  it("records the cold-cache paused state that the garden route currently labels success", async () => {
    seams.works.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = mount();
    await waitFor(() =>
      expect(client.getQueryState(worksKeys.online(garden, 11155111))?.fetchStatus).toBe("paused")
    );
    await waitFor(() => expect(result.current.availability).toBe("unavailable"));
    expect(client.getQueryData(worksKeys.online(garden, 11155111))).toBeUndefined();
    expect(result.current.works).toEqual([]);
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(seams.works).not.toHaveBeenCalled();
  });
});
it("retains distinct submissions by the same gardener and action", async () => {
  client.setQueryData(worksKeys.online(garden, 11155111), [
    {
      ...cachedWork,
      gardenerAddress: queuedJob.userAddress,
      metadata: JSON.stringify({ clientWorkId: "first" }),
    },
  ]);
  seams.jobs.mockResolvedValue([
    { ...queuedJob, payload: { ...queuedJob.payload, clientWorkId: "second" } },
  ]);
  const { result } = mount();
  await waitFor(() =>
    expect(result.current.works.map((work) => work.id)).toEqual(["local-work", "indexed-work"])
  );
});
it("only hides a local submission after its scoped identity is known from downloaded metadata", async () => {
  client.setQueryData(worksKeys.online(garden, 11155111), [
    { ...cachedWork, gardenerAddress: queuedJob.userAddress, metadata: "bafy-work" },
  ]);
  seams.jobs.mockResolvedValue([
    { ...queuedJob, payload: { ...queuedJob.payload, clientWorkId: "same" } },
  ]);
  const { result } = mount();
  await waitFor(() => expect(result.current.works).toHaveLength(2));
  client.setQueryData(worksKeys.metadata("bafy-work"), { clientWorkId: "same" });
  await waitFor(() =>
    expect(result.current.works.map((work) => work.id)).toEqual(["indexed-work"])
  );
});
it("does not expose jobs owned by another account or chain in the local garden projection", async () => {
  seams.jobs.mockResolvedValue([
    { ...queuedJob, userAddress: cachedWork.gardenerAddress },
    { ...queuedJob, id: "other-chain", chainId: 42161 },
  ]);
  const { result } = mount();
  await waitFor(() => expect(seams.jobs).toHaveBeenCalled());
  expect(result.current.works).toEqual([]);
});
it("refreshes remote approvals when existing mutation consumers invalidate the merged key", async () => {
  onlineManager.setOnline(true);
  seams.works.mockResolvedValue([cachedWork]);
  const { result } = mount();
  await waitFor(() => expect(result.current.works).toHaveLength(1));
  seams.approvals.mockResolvedValue([{ workUID: cachedWork.id, approved: true, createdAt: now }]);
  await client.invalidateQueries({ queryKey: worksKeys.merged(garden, 11155111) });
  await waitFor(() => expect(result.current.works[0].status).toBe("approved"));
});
it("uses prepared records and approval status after the ordinary browsing snapshot is missing", async () => {
  client.setQueryData(worksKeys.preparedRecent(garden, 11155111), [cachedWork]);
  client.setQueryData(worksKeys.preparedApprovals(garden, 11155111), [
    { workUID: cachedWork.id, approved: true },
  ]);
  const { result } = mount();
  expect(result.current.works[0]).toMatchObject({ id: cachedWork.id, status: "approved" });
  expect(result.current.availability).toBe("available");
  expect(seams.works).not.toHaveBeenCalled();
});

it("opens personal work offline from prepared gardens scoped to the account and chain", async () => {
  const own = { ...cachedWork, gardenerAddress: queuedJob.userAddress, status: undefined };
  client.setQueryData(
    worksKeys.preparedRecent(garden, 11155111),
    [own, { ...cachedWork, id: "other-owner" }],
    { updatedAt: 1000 }
  );
  client.setQueryData(worksKeys.preparedRecent(garden, 42161), [{ ...own, id: "other-chain" }]);
  client.setQueryData(worksKeys.preparedApprovals(garden, 11155111), [
    { workUID: own.id, approved: true },
  ]);
  client.setQueryData(worksKeys.mine(queuedJob.userAddress, 11155111, true, undefined, 50), [
    { ...own, id: "legacy-local", media: ["blob:expired"] },
  ]);
  const { result } = renderHook(() => useMyWorks({ includeOffline: true }), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });
  expect(result.current.data).toMatchObject([{ id: own.id, status: "approved" }]);
  expect(result.current.lastSuccessfulRefresh).toBe(1000);
  expect(result.current.isLoading).toBe(false);
  expect(seams.mine).not.toHaveBeenCalled();
});
it("renders queued personal work before media finishes and recreates previews from retained bytes", async () => {
  seams.jobs.mockResolvedValue([queuedJob]);
  let finishImages!: (images: Array<{ file: File; url: string }>) => void;
  seams.images.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishImages = resolve;
      })
  );
  const { result } = renderHook(() => useMyWorks({ includeOffline: true }), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });
  await waitFor(() => expect(result.current.data[0]?.id).toBe(queuedJob.id));
  expect(result.current.data[0].media).toEqual([]);
  const bytes = new TextEncoder().encode("retained-photo").buffer;
  const file = restoreWorkFile(
    { data: bytes, name: "evidence.jpg", type: "image/jpeg", lastModified: 10 },
    "evidence",
    "sha256-retained"
  );
  finishImages([{ file, url: "" }]);
  await waitFor(() => expect(result.current.data[0].media).toEqual(["blob:restored-evidence"]));
  expect(seams.preview).toHaveBeenCalledWith(file, expect.any(String), "evidence:sha256-retained");
  expect(
    client.getQueryData(worksKeys.mine(queuedJob.userAddress, 11155111, false, undefined, 50))
  ).toBeUndefined();
});
it("does not restore abandoned queue rows from legacy merged garden snapshots", async () => {
  client.setQueryData(worksKeys.merged(garden, 11155111), [
    ...["offline", "uploading", "syncing", "sync_failed"].map((status) => ({
      ...cachedWork,
      id: `legacy-${status}`,
      status,
    })),
    { ...cachedWork, id: "0xoffline_legacy", status: "pending" },
    cachedWork,
  ]);
  const { result } = mount();
  await waitFor(() => expect(result.current.works.map((work) => work.id)).toEqual([cachedWork.id]));
});
