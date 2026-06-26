import { createUpdateToasts, useApp, useServiceWorkerUpdate } from "@green-goods/shared";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";

function ServiceWorkerUpdateNotifier() {
  const { formatMessage } = useIntl();
  const { updateAvailable, isUpdating, updateStalled, applyUpdate, dismissUpdate } =
    useServiceWorkerUpdate();
  // Bind the i18n-aware update toasts so es/pt render instead of hardcoded English.
  const updateToasts = useMemo(() => createUpdateToasts(formatMessage), [formatMessage]);

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
  }, [updateAvailable, isUpdating, updateStalled, applyUpdate, dismissUpdate, updateToasts]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
