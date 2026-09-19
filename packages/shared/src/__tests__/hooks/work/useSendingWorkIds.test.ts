/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import type { Job } from "../../../types/job-queue";
import { useSendingWorkIds } from "../../../hooks/work/useSendingWorkIds";
const account = "0x1111111111111111111111111111111111111111";
const job: Job = {
  id: "work",
  kind: "work",
  userAddress: account,
  chainId: 11155111,
  createdAt: 0,
  attempts: 0,
  synced: false,
  payload: {},
};
afterEach(cleanup);
it("only reports actual processing events as sending and clears them on failure", () => {
  const { result } = renderHook(() => useSendingWorkIds(account, 11155111));
  expect(result.current.size).toBe(0);
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  expect(result.current.has(job.id)).toBe(true);
  act(() => jobQueueEventBus.emit("job:failed", { jobId: job.id, job, error: "Cancelled" }));
  expect(result.current.size).toBe(0);
});
it("does not carry a previous account's sending state across account changes", () => {
  const { result, rerender } = renderHook(({ address }) => useSendingWorkIds(address, 11155111), {
    initialProps: { address: account },
  });
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  rerender({ address: "0x2222222222222222222222222222222222222222" });
  expect(result.current.size).toBe(0);
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  expect(result.current.size).toBe(0);
});
