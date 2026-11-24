import { Button } from "@green-goods/shared/components/Button";
import { useIntl } from "react-intl";

/** When the page last read a booking or a request's rewards, and how to read them again. */
export function ServiceReadStatus({
  access,
  isOnline,
  isPending,
}: {
  access: {
    refetch: () => unknown;
    isFetching?: boolean;
    isError?: boolean;
    dataUpdatedAt?: number;
  };
  isOnline: boolean;
  isPending: boolean;
}) {
  const { formatMessage, formatTime } = useIntl();
  const text = (id: string) => formatMessage({ id: `app.voucher.wait.${id}` });
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-sub-600">
      <p role="status">
        {!isOnline
          ? text("offline")
          : access.isError
            ? text("readFailed")
            : access.dataUpdatedAt
              ? formatMessage(
                  { id: "app.voucher.wait.checked" },
                  { time: formatTime(access.dataUpdatedAt, { hour: "numeric", minute: "2-digit" }) }
                )
              : text("auto")}
      </p>
      <Button
        type="button"
        emphasis="secondary"
        disabled={!isOnline || access.isFetching || isPending}
        onClick={() => void access.refetch()}
      >
        {text(access.isFetching ? "checking" : "check")}
      </Button>
    </div>
  );
}
