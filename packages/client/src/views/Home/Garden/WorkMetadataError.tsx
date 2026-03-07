import { RiErrorWarningLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

type WorkMetadataErrorProps = {
  errorMessage: string | null;
  onRetry: () => void;
};

export const WorkMetadataError: React.FC<WorkMetadataErrorProps> = ({ errorMessage, onRetry }) => {
  const intl = useIntl();

  const errorDetail = errorMessage
    ? intl.formatMessage(
        {
          id: "app.home.work.metadataFallbackNotice.detail",
          defaultMessage: "Details: {message}",
        },
        { message: errorMessage }
      )
    : null;

  return (
    <div className="mt-4 rounded-xl border border-error-light bg-error-lighter px-4 py-3 flex items-start gap-3">
      <RiErrorWarningLine className="w-5 h-5 text-error-base flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-error-dark font-medium">
          {intl.formatMessage({
            id: "app.home.work.metadataFallbackNotice",
            defaultMessage:
              "We couldn't load all work details from storage. Some fields may be unavailable.",
          })}
        </p>
        {errorDetail && <p className="mt-1 text-xs text-error-base">{errorDetail}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs font-medium text-error-dark underline underline-offset-2 hover:text-error-base"
        >
          {intl.formatMessage({
            id: "app.home.work.retryMetadataLoad",
            defaultMessage: "Retry loading details",
          })}
        </button>
      </div>
    </div>
  );
};
