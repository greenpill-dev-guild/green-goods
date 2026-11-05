import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

/**
 * The one control Home's header keeps before a garden is entered (DL-155): with no app bar on
 * screen, it keeps settings and logout within reach.
 */
export function HomeProfileButton({ onClick }: { onClick: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <IconButton
      emphasis="secondary"
      size="compact"
      onClick={onClick}
      aria-label={formatMessage({ id: "app.profile" })}
      icon={<RiUserLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
    />
  );
}
