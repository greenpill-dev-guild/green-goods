/** @vitest-environment happy-dom */

import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateGardenController } from "../../../hooks/admin-ui/garden/useCreateGardenController";
import { resetCreateGardenStore, useCreateGardenStore } from "../../../stores/useCreateGardenStore";
import { useAdminStore } from "../../../stores/useAdminStore";
import { Domain } from "../../../types/domain";
import { createTestWrapper } from "../../test-utils/render-helpers";

const ACCOUNT = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";
const mockCreateGarden = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const draft = vi.hoisted(() => ({
  draftKey: "garden-draft",
  loadDraft: async () => null,
  clearDraft: async () => true,
  peekDraft: async () => null,
}));

// Keep form validation, store, controller and workflow machine real. Only the
// session, persistent draft and transaction/notification boundaries are fixtures.
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => ACCOUNT,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ assertOwnership: async () => {} }),
}));
vi.mock("../../../hooks/garden/useGardenDraft", () => ({ useGardenDraft: () => draft }));
vi.mock("../../../modules/garden/create-garden-command", () => ({
  createGarden: mockCreateGarden,
  createDefaultCreateGardenPorts: () => ({}),
  estimateGardenCreation: vi.fn(),
}));
vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { error: mockToastError, success: vi.fn(), info: vi.fn() },
}));
vi.mock("../../../modules/app/analytics-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/app/analytics-events")>()),
  trackAdminGardenCreateStarted: vi.fn(),
  trackAdminGardenCreateSuccess: vi.fn(),
  trackAdminGardenCreateFailed: vi.fn(),
}));

function renderController() {
  const Providers = createTestWrapper();
  return renderHook(() => useCreateGardenController(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Providers>
        <MemoryRouter>{children}</MemoryRouter>
      </Providers>
    ),
  });
}

function fillGarden() {
  const { setField } = useCreateGardenStore.getState();
  setField("name", "Test Garden");
  setField("location", "Nairobi");
  setField("slug", "test-garden");
  setField("description", "A garden for regenerative work.");
  setField("domains", [Domain.SOLAR]);
}

describe("Create Garden one-page submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateGardenStore();
    useAdminStore.setState({ selectedChainId: 11155111 });
    onlineManager.setOnline(true);
    // Pause at the transaction boundary, before any wallet or chain interaction.
    mockCreateGarden.mockImplementation(() => new Promise(() => {}));
  });
  afterEach(cleanup);

  it("submits a valid fresh form without wizard navigation", async () => {
    const { result } = renderController();
    act(fillGarden);
    expect(result.current.currentStep).toBe(0);
    await act(() => result.current.handleSubmit());
    await waitFor(() => expect(mockCreateGarden).toHaveBeenCalledOnce());
    expect(mockCreateGarden).toHaveBeenCalledWith(
      expect.objectContaining({
        accountAddress: ACCOUNT,
        chainId: 11155111,
        params: expect.objectContaining({ name: "Test Garden", domainMask: 1 << Domain.SOLAR }),
      }),
      expect.anything()
    );
    expect(result.current.isSubmitting).toBe(true);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("keeps incomplete forms out of submission", async () => {
    const { result } = renderController();
    act(() => useCreateGardenStore.getState().setField("name", "Test Garden"));
    await act(() => result.current.handleSubmit());
    expect(mockCreateGarden).not.toHaveBeenCalled();
    expect(result.current.showValidation).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("keeps a complete form local while offline", async () => {
    onlineManager.setOnline(false);
    const { result } = renderController();
    act(fillGarden);
    await act(() => result.current.handleSubmit());
    expect(mockCreateGarden).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "You're offline" })
    );
  });

  it("does not send again when two submit clicks share a render", async () => {
    const { result } = renderController();
    act(fillGarden);
    const submit = result.current.handleSubmit;
    await act(async () => {
      await Promise.all([submit(), submit()]);
    });
    await waitFor(() => expect(mockCreateGarden).toHaveBeenCalledOnce());
    expect(result.current.isSubmitting).toBe(true);
  });
});
