import { RiErrorWarningLine, RiLoader4Line, RiUploadCloudLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

import { Button } from "@/components/Actions";

type WorkRetryFooterProps = {
  isRetrying: boolean;
  onRetry: () => void;
};

export const WorkRetryFooter: React.FC<WorkRetryFooterProps> = ({ isRetrying, onRetry }) => {
  const intl = useIntl();

  return (
    <div className="fixed left-0 right-0 bottom-0 bg-warning-lighter border-t border-warning-light p-4 pb-6 z-[100]">
      <div className="max-w-screen-sm mx-auto">
        <p className="text-sm text-warning-dark mb-3 flex items-center gap-2">
          <RiErrorWarningLine className="w-4 h-4 flex-shrink-0" />
          {intl.formatMessage({
            id: "app.home.work.pendingUpload",
            defaultMessage: "This work is pending upload to the blockchain.",
          })}
        </p>
        <Button
          onClick={onRetry}
          disabled={isRetrying || !navigator.onLine}
          label={
            isRetrying
              ? intl.formatMessage({
                  id: "app.home.work.uploading",
                  defaultMessage: "Uploading...",
                })
              : intl.formatMessage({
                  id: "app.home.work.uploadNow",
                  defaultMessage: "Upload Now",
                })
          }
          className="w-full"
          variant="primary"
          mode="filled"
          shape="pilled"
          leadingIcon={
            isRetrying ? (
              <RiLoader4Line className="w-5 h-5 animate-spin" />
            ) : (
              <RiUploadCloudLine className="w-5 h-5" />
            )
          }
        />
        {!navigator.onLine && (
          <p className="text-xs text-warning-base mt-2 text-center">
            {intl.formatMessage({
              id: "app.home.work.offlineNotice",
              defaultMessage: "You're offline. Connect to upload.",
            })}
          </p>
        )}
      </div>
    </div>
  );
};
