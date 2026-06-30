import { type Address, cn } from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";

// Minimal BarcodeDetector typings — not present in every TS lib.dom version.
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

/**
 * Whether in-browser QR scanning is available. Native `BarcodeDetector` + camera
 * access — absent on iOS Safari, where manual/paste entry remains the path.
 */
export function isQrScanSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    getBarcodeDetectorCtor() !== null
  );
}

interface QRScannerProps {
  onResult: (address: Address) => void;
  onClose: () => void;
}

/** Reads `0x…` or `ethereum:0x…` QR payloads and resolves them to an address. */
function extractAddress(raw: string): Address | null {
  const value = raw
    .trim()
    .replace(/^ethereum:/i, "")
    .split(/[?@]/)[0];
  return isAddress(value) ? (value as Address) : null;
}

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const { formatMessage } = useIntl();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = getBarcodeDetectorCtor();
    if (!Ctor) {
      setError(formatMessage({ id: "app.send.qr.unsupported" }));
      return;
    }

    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;
    const detector = new Ctor({ formats: ["qr_code"] });

    const tick = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        for (const code of codes) {
          const address = extractAddress(code.rawValue);
          if (address) {
            cancelled = true;
            onResult(address);
            return;
          }
        }
      } catch {
        // transient detect failures: keep scanning
      }
      frame = requestAnimationFrame(() => void tick());
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          frame = requestAnimationFrame(() => void tick());
        }
      } catch {
        setError(formatMessage({ id: "app.send.qr.permissionDenied" }));
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [formatMessage, onResult]);

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
          className={cn("aspect-square w-full rounded-md bg-bg-weak-50 object-cover")}
          muted
          playsInline
        />
      )}
    </div>
  );
}
