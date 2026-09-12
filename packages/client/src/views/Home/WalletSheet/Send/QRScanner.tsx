import type { Address } from "@green-goods/shared/types/domain";
import {
  type BarcodeScannerPort,
  browserBarcodeScanner,
} from "@green-goods/shared/modules/wallet/barcode-scanner";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";

/**
 * Whether in-browser QR scanning is available. Native `BarcodeDetector` + camera
 * access — absent on iOS Safari, where manual/paste entry remains the path.
 */
export function isQrScanSupported(
  scannerPort: BarcodeScannerPort = browserBarcodeScanner
): boolean {
  return scannerPort.isSupported();
}

interface QRScannerProps {
  onResult: (address: Address) => void;
  onClose: () => void;
  scannerPort?: BarcodeScannerPort;
}

/** Reads `0x…` or `ethereum:0x…` QR payloads and resolves them to an address. */
export function extractAddress(raw: string): Address | null {
  const value = raw
    .trim()
    .replace(/^ethereum:/i, "")
    .split(/[?@]/)[0];
  return isAddress(value) ? (value as Address) : null;
}

export function QRScanner({
  onResult,
  onClose,
  scannerPort = browserBarcodeScanner,
}: QRScannerProps) {
  const { formatMessage } = useIntl();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scannerPort.isSupported()) {
      setError(formatMessage({ id: "app.send.qr.unsupported" }));
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        if (!videoRef.current) return;
        const rawValue = await scannerPort.scan(videoRef.current, controller.signal);
        if (controller.signal.aborted) return;
        const address = extractAddress(rawValue);
        if (address) onResult(address);
      } catch {
        if (controller.signal.aborted) return;
        setError(formatMessage({ id: "app.send.qr.permissionDenied" }));
      }
    })();

    return () => controller.abort();
  }, [formatMessage, onResult, scannerPort]);

  return (
    <div className="space-y-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.send.qr.title" })}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={formatMessage({ id: "app.common.close" })}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-sub-600 hover:bg-bg-weak-50"
        >
          <RiCloseLine className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {error ? (
        <p className="text-sm text-warning-dark" role="alert">
          {error}
        </p>
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: live camera preview has no caption track
        <video
          ref={videoRef}
          aria-label={formatMessage({
            id: "app.send.qr.videoLabel",
            defaultMessage: "Live camera preview for scanning a wallet QR code",
          })}
          className={cn("aspect-square w-full rounded-md bg-bg-weak-50 object-cover")}
          muted
          playsInline
        />
      )}
    </div>
  );
}
