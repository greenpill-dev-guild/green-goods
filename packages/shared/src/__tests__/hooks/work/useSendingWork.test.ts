/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import type { Job } from "../../../types/job-queue";
import { useSendingWork } from "../../../hooks/work/useSendingWork";
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
  const { result } = renderHook(() => useSendingWork(account, 11155111));
  expect(result.current.size).toBe(0);
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  expect(result.current.has(job.id)).toBe(true);
  act(() => jobQueueEventBus.emit("job:failed", { jobId: job.id, job, error: "Cancelled" }));
  expect(result.current.size).toBe(0);
});
it("does not carry a previous account's sending state across account changes", () => {
  const { result, rerender } = renderHook(({ address }) => useSendingWork(address, 11155111), {
    initialProps: { address: account },
  });
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  rerender({ address: "0x2222222222222222222222222222222222222222" });
  expect(result.current.size).toBe(0);
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  expect(result.current.size).toBe(0);
});
it("follows each send's stage, Upload all's too, and lets go once the send stops", () => {
  const { result } = renderHook(() => useSendingWork(account, 11155111));
  // Upload all sends outside the processor: its first word on a job is a stage.
  act(() => jobQueueEventBus.emit("job:stage", { jobId: job.id, job, stage: "wallet" }));
  expect(result.current.get(job.id)).toBe("wallet");
  act(() => jobQueueEventBus.emit("job:stage", { jobId: job.id, job, stage: "confirming" }));
  expect(result.current.get(job.id)).toBe("confirming");
  act(() => jobQueueEventBus.emit("job:stage", { jobId: job.id, job, stage: null }));
  expect(result.current.has(job.id)).toBe(false);
});
it("keeps the stage of a work Upload all sent while the queue finishes it", () => {
  const { result } = renderHook(() => useSendingWork(account, 11155111));
  act(() => jobQueueEventBus.emit("job:stage", { jobId: job.id, job, stage: "confirming" }));
  act(() => jobQueueEventBus.emit("job:processing", { jobId: job.id, job }));
  expect(result.current.get(job.id)).toBe("confirming");
  act(() => jobQueueEventBus.emit("job:completed", { jobId: job.id, job, txHash: "0x1" }));
  expect(result.current.has(job.id)).toBe(false);
});
