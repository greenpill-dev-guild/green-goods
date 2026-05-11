import { updateToasts, useApp, useServiceWorkerUpdate } from "@green-goods/shared";
import { useEffect } from "react";

function ServiceWorkerUpdateNotifier() {
  const { updateAvailable, isUpdating, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();

  useEffect(() => {
    if (updateAvailable) {
      updateToasts.available(applyUpdate, dismissUpdate);
    }
    if (isUpdating) {
      updateToasts.updating();
    }
  }, [updateAvailable, isUpdating, applyUpdate, dismissUpdate]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
