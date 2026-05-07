import { updateToasts, useApp, useServiceWorkerUpdate } from "@green-goods/shared";
import { useEffect } from "react";

function ServiceWorkerUpdateNotifier() {
  const { updateAvailable, isUpdating, applyUpdate } = useServiceWorkerUpdate();

  useEffect(() => {
    if (updateAvailable) {
      updateToasts.available(applyUpdate);
    }
    if (isUpdating) {
      updateToasts.updating();
    }
  }, [updateAvailable, isUpdating, applyUpdate]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
