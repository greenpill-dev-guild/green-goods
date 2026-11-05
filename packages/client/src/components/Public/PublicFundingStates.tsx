import { useIntl } from "react-intl";

export function LoadingBody() {
  return (
    <div className="flex flex-col gap-4 py-6" aria-hidden="true">
      <div className="h-3 w-1/3 animate-pulse bg-stroke-soft-200/60" />
      <div className="h-12 w-full animate-pulse bg-editorial-warm" />
      <div className="h-3 w-1/2 animate-pulse bg-stroke-soft-200/40" />
      <div className="mt-2 h-12 w-full animate-pulse bg-stroke-soft-200/60" />
    </div>
  );
}

export function UnavailableBody({ isDonate }: { isDonate: boolean }) {
  const { formatMessage } = useIntl();
  return (
    <p className="py-6 text-sm leading-[1.6] text-text-sub-600">
      {isDonate
        ? formatMessage({
            id: "public.fund.card.unavailable.donate",
            defaultMessage: "This garden has no donation fund configured yet.",
          })
        : formatMessage({
            id: "public.fund.card.unavailable.endow",
            defaultMessage: "This garden has no endowment fund configured yet.",
          })}
    </p>
  );
}

export function InlineErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="border border-editorial-deep/15 bg-editorial-warm px-4 py-3 text-sm text-text-strong-950"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-text-sub-600">{message}</p>
    </div>
  );
}
