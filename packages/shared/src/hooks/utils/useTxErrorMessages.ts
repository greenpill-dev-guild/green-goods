import { useMemo } from "react";
import { useIntl } from "react-intl";

import {
  classifyTxError,
  isMeaningfulTxErrorMessage,
  type TxErrorView,
} from "../../utils/errors/tx-error-classifier";

export interface TxErrorMessages {
  view: TxErrorView;
  title: string;
  message: string;
}

/**
 * Derives i18n-ready title and message strings from a transaction error.
 *
 * Replaces the repeated boilerplate:
 * ```ts
 * const txErrorView = useMemo(() => classifyTxError(error), [error]);
 * const txErrorTitle = formatMessage({ id: txErrorView.titleKey, ... });
 * const txErrorMessage = txErrorView.kind === "cancelled" ? ... : ...;
 * ```
 *
 * @param error - The mutation error (pass `null`/`undefined` when no error).
 * @returns `{ view, title, message }` ready for `<TxInlineFeedback>`.
 */
export function useTxErrorMessages(error: unknown): TxErrorMessages {
  const { formatMessage } = useIntl();

  const view = useMemo(() => classifyTxError(error), [error]);

  const title = formatMessage({
    id: view.titleKey,
    defaultMessage: view.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });

  const message =
    view.kind === "cancelled"
      ? formatMessage({
          id: view.messageKey,
          defaultMessage: "Transaction was cancelled. Please try again when ready.",
        })
      : isMeaningfulTxErrorMessage(view.rawMessage)
        ? view.rawMessage
        : formatMessage({
            id: view.messageKey,
            defaultMessage: "Something went wrong. Please try again.",
          });

  return { view, title, message };
}
