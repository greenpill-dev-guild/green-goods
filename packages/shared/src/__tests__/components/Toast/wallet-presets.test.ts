/**
 * Wallet submission progress toasts: every stage replaces the one `wallet-submission` toast, only
 * the signing stage waits indefinitely, and a failure offers a retry hint only when it is
 * recoverable.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { toastService } from "../../../components/Toast/toast.service";
import {
  createWalletProgressToasts,
  showWalletProgress,
} from "../../../components/Toast/presets/wallet";

const formatMessage = ({ defaultMessage }: { id: string; defaultMessage?: string }) =>
  defaultMessage ?? "";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wallet submission progress toasts", () => {
  const toasts = createWalletProgressToasts(formatMessage);

  it.each([
    { stage: "validating", method: "loading", persistent: undefined },
    { stage: "uploading", method: "loading", persistent: undefined },
    // Signing waits on the user, so this stage must never time out on its own.
    { stage: "confirming", method: "loading", persistent: true },
    { stage: "syncing", method: "loading", persistent: undefined },
    { stage: "success", method: "success", persistent: undefined },
    { stage: "timeout", method: "info", persistent: undefined },
  ] as const)("$stage replaces the wallet-submission toast through $method", ({
    stage,
    method,
    persistent,
  }) => {
    const show = vi.spyOn(toastService, method).mockReturnValue("wallet-submission");

    toasts[stage]();

    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0]).toMatchObject({
      id: "wallet-submission",
      context: "wallet submission",
    });
    expect(show.mock.calls[0][0].persistent).toBe(persistent);
  });

  it("adds the retry hint only to a recoverable failure", () => {
    const error = vi.spyOn(toastService, "error").mockReturnValue("wallet-submission");

    toasts.error("Gas estimate failed", true);
    toasts.error("Signature rejected");

    expect(error.mock.calls.map(([options]) => [options.message, options.description])).toEqual([
      ["Gas estimate failed", "You can try again with the same data."],
      ["Signature rejected", undefined],
    ]);
  });

  it("shows upload progress text in place of the default uploading message", () => {
    const loading = vi.spyOn(toastService, "loading").mockReturnValue("wallet-submission");

    showWalletProgress("uploading", "2 of 5 photos");
    showWalletProgress("uploading");

    expect(loading.mock.calls.map(([options]) => options.message)).toEqual([
      "2 of 5 photos",
      "Saving images to IPFS...",
    ]);
  });
});
