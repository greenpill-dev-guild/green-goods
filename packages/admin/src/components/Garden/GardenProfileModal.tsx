import { DialogShell, type Address } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { GardenMetadata } from "./GardenMetadata";
import { GardenSettingsEditor } from "./GardenSettingsEditor";

interface GardenProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  garden: {
    id: string;
    name: string;
    description: string;
    location: string;
    bannerImage: string;
    openJoining?: boolean;
    maxGardeners?: number;
    tokenAddress: string;
    tokenID: string;
    chainId: number;
  };
  canManage: boolean;
  isOwner: boolean;
}

export function GardenProfileModal({
  isOpen,
  onClose,
  gardenAddress,
  garden,
  canManage,
  isOwner,
}: GardenProfileModalProps) {
  const { formatMessage } = useIntl();

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={formatMessage({
        id: "app.garden.profile.modal.title",
        defaultMessage: "Garden Profile",
      })}
      description={formatMessage({
        id: "app.garden.profile.modal.description",
        defaultMessage: "Update settings, metadata, and on-chain identifiers",
      })}
      bodyClassName="max-h-[calc(90vh-80px)] space-y-4 overflow-y-auto p-4 sm:p-6"
    >
      <GardenSettingsEditor
        gardenAddress={gardenAddress}
        garden={garden}
        canManage={canManage}
        isOwner={isOwner}
      />
      <GardenMetadata
        gardenId={garden.id as Address}
        tokenAddress={garden.tokenAddress as Address}
        tokenId={garden.tokenID}
        chainId={garden.chainId}
      />
    </DialogShell>
  );
}
