import { RiSeedlingLine } from "@remixicon/react";
import type { ReactNode } from "react";

/** The same connect surface before and after the auth providers are available. */
export function ConnectPrompt({
  title,
  description,
  action,
  icon,
  testId = "connect-shell",
  lang,
}: {
  title: string;
  description: string;
  action: ReactNode;
  icon?: ReactNode;
  testId?: string;
  lang?: string;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-bg-weak px-6 text-center"
      data-testid={testId}
      lang={lang}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-white shadow-[var(--edge-rest),_var(--m3-elevation-1)]">
        {icon ?? (
          <RiSeedlingLine
            className="h-7 w-7 text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
            aria-hidden="true"
          />
        )}
      </div>
      <h1 className="mt-5 text-title-lg font-semibold leading-[var(--type-title-lg-lh)] text-text-strong">
        {title}
      </h1>
      <p className="mb-6 mt-2 max-w-sm body-sm text-text-sub">{description}</p>
      {action}
    </div>
  );
}
