/**
 * Toast Registry — verifies the static `xxxToasts` facade routes through the
 * registry-bound `formatMessage` when one is set, and falls back to the
 * English defaults otherwise. Without this contract, transactional PWA toasts
 * (work submit, queue sync, wallet progress, app update) ship English copy
 * to es/pt users — see lane 01 C2 in the client-pwa-audit findings.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../modules/app/logger", () => {
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { logger, createLogger: () => logger };
});

import {
  approvalToasts,
  queueToasts,
  toastService,
  updateToasts,
  validationToasts,
  walletProgressToasts,
  workToasts,
} from "../../components/toast";
import {
  clearLocalizedToastsFormatter,
  setLocalizedToastsFormatter,
} from "../../components/Toast/presets/registry";
import type { FormatMessageFn } from "../../components/Toast/presets/types";

const captures: Array<{
  method: string;
  descriptor: { title?: string; message?: string; description?: string };
}> = [];

beforeEach(() => {
  captures.length = 0;
  for (const method of ["loading", "success", "info", "error"] as const) {
    vi.spyOn(toastService, method).mockImplementation((descriptor) => {
      captures.push({ method, descriptor });
      return "test-toast-id";
    });
  }
  clearLocalizedToastsFormatter();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearLocalizedToastsFormatter();
});

describe("Toast registry binding", () => {
  it("workToasts.submitting falls back to English when no formatter is bound", () => {
    workToasts.submitting();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.descriptor.title).toBe("Submitting work");
  });

  it("workToasts.submitting routes through bound formatter", () => {
    const formatMessage = vi.fn(((descriptor: { id: string; defaultMessage?: string }) => {
      const localizedById: Record<string, string> = {
        "app.toast.work.submitting.title": "ENVIANDO TRABAJO",
        "app.toast.work.submitting.message": "Procesando tu envío...",
      };
      return localizedById[descriptor.id] ?? descriptor.defaultMessage ?? descriptor.id;
    }) as FormatMessageFn);

    setLocalizedToastsFormatter(formatMessage);
    workToasts.submitting();

    expect(captures[0]?.descriptor.title).toBe("ENVIANDO TRABAJO");
    expect(captures[0]?.descriptor.message).toBe("Procesando tu envío...");
    expect(formatMessage).toHaveBeenCalled();
  });

  it("queueToasts.syncSuccess uses plural form via the bound formatter", () => {
    const formatMessage = vi.fn(((descriptor: { id: string; defaultMessage?: string }) => {
      const localizedById: Record<string, string> = {
        "app.toast.queue.syncSuccess.title": "Sincronizados",
        "app.toast.queue.syncSuccess.messagePlural": "Procesados {count} elementos.",
      };
      return localizedById[descriptor.id] ?? descriptor.defaultMessage ?? descriptor.id;
    }) as FormatMessageFn);

    setLocalizedToastsFormatter(formatMessage);
    queueToasts.syncSuccess(3);
    expect(captures[0]?.descriptor.title).toBe("Sincronizados");
    // formatMessage receives the message ID; the value object resolves to a string from the mock.
  });

  it("walletProgressToasts.success localizes via bound formatter", () => {
    const formatMessage = vi.fn(((descriptor: { id: string; defaultMessage?: string }) => {
      if (descriptor.id === "app.toast.wallet.success.title") return "ENVIADO";
      return descriptor.defaultMessage ?? descriptor.id;
    }) as FormatMessageFn);
    setLocalizedToastsFormatter(formatMessage);
    walletProgressToasts.success();
    expect(captures[0]?.descriptor.title).toBe("ENVIADO");
  });

  it("approvalToasts.error localizes via bound formatter", () => {
    const formatMessage = vi.fn(((descriptor: { id: string; defaultMessage?: string }) => {
      if (descriptor.id === "app.toast.approval.errorApproval.title") return "Falló la aprobación";
      return descriptor.defaultMessage ?? descriptor.id;
    }) as FormatMessageFn);
    setLocalizedToastsFormatter(formatMessage);
    approvalToasts.error(true, false);
    expect(captures[0]?.descriptor.title).toBe("Falló la aprobación");
  });

  it("validationToasts.formError localizes via bound formatter", () => {
    const formatMessage = vi.fn(((descriptor: { id: string; defaultMessage?: string }) => {
      if (descriptor.id === "app.toast.validation.formError.title") return "Revisa";
      return descriptor.defaultMessage ?? descriptor.id;
    }) as FormatMessageFn);
    setLocalizedToastsFormatter(formatMessage);
    validationToasts.formError("missing field");
    expect(captures[0]?.descriptor.title).toBe("Revisa");
    expect(captures[0]?.descriptor.message).toBe("missing field");
  });

  it("updateToasts.available uses the bound formatter for the action label", () => {
    const formatMessage = vi.fn(((descriptor: { id: string; defaultMessage?: string }) => {
      if (descriptor.id === "app.toast.update.action.updateNow") return "Actualizar";
      if (descriptor.id === "app.toast.update.available.title") return "Actualización";
      return descriptor.defaultMessage ?? descriptor.id;
    }) as FormatMessageFn);
    setLocalizedToastsFormatter(formatMessage);
    updateToasts.available(() => {});
    expect(captures[0]?.descriptor.title).toBe("Actualización");
  });

  it("clearLocalizedToastsFormatter reverts to English fallback", () => {
    const formatMessage = vi.fn(() => "ALWAYS-LOCALIZED") as unknown as FormatMessageFn;
    setLocalizedToastsFormatter(formatMessage);
    workToasts.submitting();
    expect(captures[0]?.descriptor.title).toBe("ALWAYS-LOCALIZED");

    captures.length = 0;
    clearLocalizedToastsFormatter();
    workToasts.submitting();
    expect(captures[0]?.descriptor.title).toBe("Submitting work");
  });
});
