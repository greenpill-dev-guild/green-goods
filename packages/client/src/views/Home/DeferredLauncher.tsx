import { type ReactNode, Suspense, useEffect, useState } from "react";

/**
 * Mounts a launcher's reads at an idle moment, so Home's first paint waits on none of them. The
 * placeholder is the same icon with nothing counted, so nothing moves when the reads land. A tap
 * on the placeholder before that moment asks for the launcher's sheet, so `requested` mounts the
 * launcher at once instead of leaving the tap to a later idle period.
 */
export function DeferredLauncher({
  placeholder,
  requested = false,
  children,
}: {
  placeholder: ReactNode;
  requested?: boolean;
  children: ReactNode;
}) {
  const [loadReads, setLoadReads] = useState(false);

  useEffect(() => {
    const idleCallback =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(callback, 1_000));
    const handle = idleCallback(() => setLoadReads(true));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  if (!loadReads && !requested) return <>{placeholder}</>;
  return <Suspense fallback={placeholder}>{children}</Suspense>;
}
