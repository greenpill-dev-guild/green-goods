import { Spinner } from "@green-goods/shared";
import type React from "react";
import { useIntl } from "react-intl";

/**
 * Centered loader using shared Spinner component.
 * Renamed from BeatLoader for clarity - this is a simple wrapper around Spinner.
 */
export const Loader: React.FC = () => {
  const { formatMessage } = useIntl();

  return (
    <div className="flex justify-center w-full">
      <Spinner size="sm" label={formatMessage({ id: "app.common.loading" })} />
    </div>
  );
};
