/**
 * Public install action handler hook.
 *
 * Wraps `dispatchInstallAction` with toast plumbing so public CTAs
 * (header, hero, install section, receipt, garden detail rail) can
 * share one handler instead of reimplementing the dispatch in each.
 *
 * Each CTA is still a normal `<a href="#install">` for accessibility
 * and progressive enhancement; `onClick={handler}` calls
 * `event.preventDefault()` and routes through the dispatcher.
 */

import { type MouseEvent, useCallback } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { dispatchInstallAction } from "../../utils/app/installAction";
import type { InstallGuidance } from "./useInstallGuidance";

export function usePublicInstallHandler(
  guidance: InstallGuidance,
  promptInstall: () => void,
  options?: { onBeforeDispatch?: () => void }
): (event: MouseEvent<HTMLElement>) => Promise<void> {
  const intl = useIntl();
  const onBeforeDispatch = options?.onBeforeDispatch;

  return useCallback(
    async (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      onBeforeDispatch?.();
      await dispatchInstallAction(guidance, {
        promptInstall,
        toast: ({ titleId, defaultTitle, messageId, defaultMessage }) =>
          toastService.success({
            title: intl.formatMessage({ id: titleId, defaultMessage: defaultTitle }),
            message:
              messageId && defaultMessage
                ? intl.formatMessage({ id: messageId, defaultMessage })
                : undefined,
            context: "public.install.copy",
            suppressLogging: true,
          }),
      });
    },
    [guidance, intl, onBeforeDispatch, promptInstall]
  );
}
