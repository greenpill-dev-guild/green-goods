import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { shareLink } from "@green-goods/shared/utils/app/clipboard";
import { RiShareLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";

export interface ShareGardenButtonProps {
  gardenId: string;
  name: string;
}

/** Shares the garden's in-app link, keeping the fragment route on hash-routed builds. */
export function ShareGardenButton({ gardenId, name }: ShareGardenButtonProps) {
  const intl = useIntl();

  const handleShareGarden = async () => {
    const url = new URL(window.location.href);
    const path = `/home/${encodeURIComponent(gardenId)}`;
    if (url.hash.startsWith("#/")) {
      url.hash = path;
    } else {
      url.pathname = path;
      url.hash = "";
    }
    url.search = "";
    try {
      await shareLink({ title: name, url: url.toString() });
    } catch {
      toastService.error({ title: intl.formatMessage({ id: "app.garden.shareFailed" }) });
    }
  };

  return (
    <Button
      label={intl.formatMessage({ id: "app.garden.share" })}
      leadingIcon={<RiShareLine className="w-4 h-4" />}
      variant="neutral"
      mode="stroke"
      size="small"
      onClick={handleShareGarden}
    />
  );
}
