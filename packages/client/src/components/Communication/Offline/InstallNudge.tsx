import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useApp } from "@green-goods/shared/providers/App";
import { RiCloseLine, RiDownloadLine, RiUserLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/config/pwaRouting";

/** Mobile-browser install guidance, independent of connectivity state. */
export function InstallNudge() {
  const { isMobile, isInstalled } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { formatMessage } = useIntl();

  if (!isMobile || isInstalled || dismissed) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-nav flex w-full items-center justify-center gap-2 overflow-y-clip border-b border-stroke-soft-200 bg-bg-white-0/95 px-3 py-1 text-xs font-medium text-text-strong-950 shadow-sm backdrop-blur-md"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
      role="status"
      data-testid="install-nudge"
    >
      <RiDownloadLine size={10} className="text-primary" aria-hidden="true" />
      <span className="text-[10px]">
        {formatMessage({
          id: "app.offline.installPrompt",
          defaultMessage: "Install for full experience.",
        })}
      </span>
      <Button
        type="button"
        emphasis="tertiary"
        size="compact"
        onClick={() => navigate(APP_ROUTES.profile, { viewTransition: true })}
        leadingIcon={<RiUserLine className="h-3 w-3" aria-hidden="true" />}
        className="-my-2 text-[10px]"
      >
        {formatMessage({
          id: "app.offline.installPromptProfile",
          defaultMessage: "Profile",
        })}
      </Button>
      <IconButton
        size="compact"
        onClick={() => setDismissed(true)}
        className="-my-2"
        aria-label={formatMessage({
          id: "app.offline.installPromptDismiss",
          defaultMessage: "Dismiss",
        })}
        icon={<RiCloseLine aria-hidden="true" />}
      />
    </div>
  );
}
