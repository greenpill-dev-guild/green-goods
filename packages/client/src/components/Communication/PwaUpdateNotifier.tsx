import { updateToasts, useApp, useServiceWorkerUpdate } from "@green-goods/shared";
import { useEffect } from "react";

function ServiceWorkerUpdateNotifier() {
  const { updateAvailable, isUpdating, updateStalled, applyUpdate, dismissUpdate } =
    useServiceWorkerUpdate();

  useEffect(() => {
    if (isUpdating) {
      updateToasts.updating();
      return;
    }
    if (updateStalled) {
      updateToasts.stalled(dismissUpdate);
      return;
    }
    if (updateAvailable) {
      updateToasts.available(applyUpdate, dismissUpdate);
    }
  }, [updateAvailable, isUpdating, updateStalled, applyUpdate, dismissUpdate]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
