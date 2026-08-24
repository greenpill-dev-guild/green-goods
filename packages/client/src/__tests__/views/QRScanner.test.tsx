/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BarcodeScannerPort } from "@green-goods/shared/modules/wallet/barcode-scanner";
import { renderWithProviders as render } from "../test-utils";
import { QRScanner } from "../../views/Home/WalletDrawer/Send/QRScanner";

describe("QRScanner", () => {
  it("reads a wallet address through an injected scanner port", async () => {
    const onResult = vi.fn();
    const scannerPort: BarcodeScannerPort = {
      isSupported: () => true,
      scan: vi.fn().mockResolvedValue("ethereum:0x1111111111111111111111111111111111111111@42161"),
    };

    render(<QRScanner scannerPort={scannerPort} onResult={onResult} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith("0x1111111111111111111111111111111111111111")
    );
    expect(scannerPort.scan).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement),
      expect.any(AbortSignal)
    );
  });
});
