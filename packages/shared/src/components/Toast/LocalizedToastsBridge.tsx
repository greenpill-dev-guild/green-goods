import { useEffect } from "react";
import { useIntl } from "react-intl";
import { clearLocalizedToastsFormatter, setLocalizedToastsFormatter } from "./presets/registry";

/**
 * Mount once inside `IntlProvider` so the static `xxxToasts` exports route
 * through `formatMessage`. Without this bridge, transactional PWA toasts
 * (work submit, queue sync, wallet progress, app update) render English
 * regardless of locale — see lane 01 C2 in the client-pwa-audit findings.
 *
 * Render position matters: this component must live inside `IntlProvider` so
 * `useIntl()` returns the right formatter. It returns `null` and only writes
 * to a module-level binding via the registry.
 */
export function LocalizedToastsBridge(): null {
  const intl = useIntl();
  useEffect(() => {
    setLocalizedToastsFormatter(intl.formatMessage);
    return () => {
      clearLocalizedToastsFormatter();
    };
  }, [intl.formatMessage]);
  return null;
}
