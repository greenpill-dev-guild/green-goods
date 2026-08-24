import { createUpdateToasts } from "@green-goods/shared/components/Toast/presets/update";
import { useApp } from "@green-goods/shared/providers/App";
import { useServiceWorkerUpdate } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";

function ServiceWorkerUpdateNotifier() {
  const { formatMessage } = useIntl();
  const { phase, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();
  // Bind the i18n-aware update toasts so es/pt render instead of hardcoded English.
  const updateToasts = useMemo(() => createUpdateToasts(formatMessage), [formatMessage]);

  useEffect(() => {
    switch (phase) {
      case "downloading":
        updateToasts.downloading();
        return;
      case "ready":
        updateToasts.ready(applyUpdate, dismissUpdate);
        return;
      case "applying":
        updateToasts.applying();
        return;
      case "stalled":
        updateToasts.stalled(dismissUpdate);
        return;
      default:
        return;
    }
  }, [phase, applyUpdate, dismissUpdate, updateToasts]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
