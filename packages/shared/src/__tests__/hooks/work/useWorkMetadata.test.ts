/** @vitest-environment jsdom */
import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
  onlineManager,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { worksKeys } from "../../../config/query-keys/work";
const request = vi.hoisted(() => vi.fn());
vi.mock("../../../modules/data/ipfs/resolve", () => ({ getFileByHash: request }));
import { useWorkMetadata } from "../../../hooks/work/useWorkMetadata";
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  request.mockReset();
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
});

it("renders inline and double-encoded draft details without a network request", () => {
  const { result } = renderHook(
    () =>
      useWorkMetadata(JSON.stringify(JSON.stringify({ clientWorkId: "local", title: "Saved" }))),
    { wrapper }
  );
  expect(result.current.metadata).toMatchObject({ clientWorkId: "local" });
  expect(result.current.status).toBe("success");
  expect(request).not.toHaveBeenCalled();
});
it("restores downloaded metadata while offline without fetching", () => {
  client.setQueryData(worksKeys.metadata("bafy-work"), { clientWorkId: "saved", title: "Saved" });
  const snapshot = dehydrate(client);
  client.clear();
  hydrate(client, snapshot);
  onlineManager.setOnline(false);
  const { result } = renderHook(() => useWorkMetadata("bafy-work"), { wrapper });
  expect(result.current.metadata).toMatchObject({ clientWorkId: "saved" });
  expect(result.current.status).toBe("success");
  expect(request).not.toHaveBeenCalled();
});
it("shows missing details offline and resolves them automatically on reconnect", async () => {
  onlineManager.setOnline(false);
  request.mockResolvedValue({ data: JSON.stringify({ title: "Recovered" }) });
  const { result } = renderHook(() => useWorkMetadata("bafy-work"), { wrapper });
  expect(result.current.status).toBe("unavailable");
  expect(request).not.toHaveBeenCalled();
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(result.current.metadata).toMatchObject({ title: "Recovered" }));
});
it("recovers a failed metadata request on reconnect without changing the selected work", async () => {
  request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const { result } = renderHook(() => useWorkMetadata("bafy-work"), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("error"));
  act(() => onlineManager.setOnline(false));
  request.mockResolvedValue({ data: JSON.stringify({ title: "Recovered" }) });
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(result.current.metadata).toMatchObject({ title: "Recovered" }));
});
