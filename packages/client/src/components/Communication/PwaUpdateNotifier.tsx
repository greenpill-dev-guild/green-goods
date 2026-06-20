import { useApp, useServiceWorkerUpdate } from "@green-goods/shared";
import { createUpdateToasts } from "@green-goods/shared/components";
import { useEffect } from "react";
import { useIntl } from "react-intl";

function ServiceWorkerUpdateNotifier() {
  const { formatMessage } = useIntl();
  const { updateAvailable, isUpdating, applyTimedOut, applyUpdate, dismissUpdate } =
    useServiceWorkerUpdate();

  useEffect(() => {
    const updateToasts = createUpdateToasts(formatMessage);

    if (isUpdating) {
      updateToasts.updating();
      return;
    }

    if (applyTimedOut) {
      updateToasts.stalled(applyUpdate, dismissUpdate);
      return;
    }

    if (updateAvailable) {
      updateToasts.available(applyUpdate, dismissUpdate);
    }
  }, [applyTimedOut, updateAvailable, isUpdating, applyUpdate, dismissUpdate, formatMessage]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
