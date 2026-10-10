interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

export interface BarcodeScannerPort {
  isSupported(): boolean;
  scan(video: HTMLVideoElement, signal: AbortSignal): Promise<string>;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    });
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(new DOMException("Scan aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

export const browserBarcodeScanner: BarcodeScannerPort = {
  isSupported: () =>
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    getBarcodeDetectorCtor() !== null,

  async scan(video, signal) {
    const Ctor = getBarcodeDetectorCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Barcode scanning is not supported");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    try {
      if (signal.aborted) throw new DOMException("Scan aborted", "AbortError");
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      const detector = new Ctor({ formats: ["qr_code"] });

      while (!signal.aborted) {
        try {
          const code = (await detector.detect(video))[0];
          if (code?.rawValue) return code.rawValue;
        } catch {
          // Native detectors can fail transiently while the camera settles.
        }
        await nextFrame(signal);
      }
      throw new DOMException("Scan aborted", "AbortError");
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  },
};
