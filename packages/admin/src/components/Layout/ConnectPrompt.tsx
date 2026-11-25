import type { ReactNode } from "react";

/**
 * The one connect surface, before and after the auth providers are available: the boot
 * screen, the signed-out Hub and the wallet-required state all draw it, so a steward sees
 * the same screen whichever way they arrive. It scrolls on a screen too short for it, and
 * centres only the room left over, so its top never sits above the screen.
 */
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
      data-tone="home"
      className="admin-m3 h-dvh overflow-y-auto bg-bg-weak"
      data-testid={testId}
      lang={lang}
    >
      <div className="flex min-h-full flex-col items-center px-6 py-6 text-center">
        <div className="my-auto flex w-full flex-col items-center">
          {icon ? (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-bg-white shadow-[var(--edge-rest),_var(--m3-elevation-1)]">
              {icon}
            </div>
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}green-goods-logo.png`}
              alt=""
              width={819}
              height={464}
              className="h-24 w-auto shrink-0 sm:h-28"
              data-testid="hub-connect-logo"
            />
          )}
          <h1 className="mt-5 type-title-lg font-semibold text-text-strong">{title}</h1>
          <p className="mb-6 mt-2 max-w-sm type-body text-text-sub">{description}</p>
          {action}
        </div>
      </div>
    </div>
  );
}
