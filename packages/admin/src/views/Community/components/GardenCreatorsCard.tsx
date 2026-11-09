import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { type GardenCreators, useGardenCreators } from "@green-goods/shared/hooks/gardener/useRole";
import { useAddressInput } from "@green-goods/shared/hooks/utils/useAddressInput";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { RiAddLine, RiDeleteBinLine, RiSeedlingLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminConfirmDialog, AdminDialog } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";

/** The Community Garden's mount point: reads through the shared hook, renders the card. */
export function GardenCreatorsPanel() {
  const creators = useGardenCreators();
  return <GardenCreatorsCard creators={creators} />;
}

/**
 * Who may create a garden, kept on the deployment registry's allowlist and managed here by the
 * Community Garden's owners and stewards. The registry decides who sees the card, so the card
 * and the contract cannot disagree. The list is the chain's answer, never the request just sent.
 */
export function GardenCreatorsCard({ creators }: { creators: GardenCreators }) {
  const { formatMessage } = useIntl();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<Address | null>(null);

  if (!creators.canManage) return null;

  const addButton = (
    <Button
      type="button"
      emphasis="secondary"
      size="sm"
      leadingIcon={<RiAddLine className="h-[18px] w-[18px]" aria-hidden="true" />}
      onClick={() => setAddOpen(true)}
      disabled={creators.isWriting}
    >
      {formatMessage({ id: "cockpit.community.gardenCreators.add" })}
    </Button>
  );

  return (
    <AdminCard
      className="@container space-y-4"
      data-component="GardenCreators"
      data-region="garden-creators"
    >
      <div className="flex flex-col items-start gap-3 @[560px]:flex-row @[560px]:justify-between">
        <div className="min-w-0">
          <AdminCardTitle>
            {formatMessage({ id: "cockpit.community.gardenCreators.title" })}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-soft">
            {formatMessage({ id: "cockpit.community.gardenCreators.description" })}
          </p>
        </div>
        {creators.creators.length > 0 ? addButton : null}
      </div>

      {creators.error ? (
        <Alert variant="error">
          {formatMessage({ id: "cockpit.community.gardenCreators.readError" })}
        </Alert>
      ) : creators.loading ? (
        <div className="h-16 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
      ) : creators.creators.length === 0 ? (
        <EmptyState
          icon={<RiSeedlingLine />}
          title={formatMessage({ id: "cockpit.community.gardenCreators.emptyTitle" })}
          description={formatMessage({ id: "cockpit.community.gardenCreators.emptyDescription" })}
          action={addButton}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2 @[560px]:grid-cols-2">
          {creators.creators.map((creator) => {
            const removeLabel = formatMessage(
              { id: "cockpit.community.gardenCreators.removeLabel" },
              { name: formatAddress(creator) }
            );
            return (
              <li key={creator}>
                <PersonRow
                  address={creator}
                  action={
                    <IconButton
                      emphasis="tertiary"
                      tone="danger"
                      size="compact"
                      onClick={() => setRemoving(creator)}
                      disabled={creators.isWriting}
                      aria-label={removeLabel}
                      title={removeLabel}
                      icon={<RiDeleteBinLine />}
                    />
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <AddGardenCreatorDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        creators={creators}
      />

      <AdminConfirmDialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        tone="community"
        variant="danger"
        title={formatMessage({ id: "cockpit.community.gardenCreators.removeDialog.title" })}
        description={formatMessage({
          id: "cockpit.community.gardenCreators.removeDialog.description",
        })}
        target={removing ? <EnsAddressText address={removing} /> : undefined}
        confirmLabel={formatMessage({
          id: "cockpit.community.gardenCreators.removeDialog.confirm",
        })}
        cancelLabel={formatMessage({ id: "app.common.cancel" })}
        isLoading={creators.isWriting}
        onConfirm={async () => {
          if (!removing) return;
          // A change that was not sent keeps the dialog and its target, so trying again is one tap.
          if (await creators.removeCreator(removing)) setRemoving(null);
        }}
      />
    </AdminCard>
  );
}

function AddGardenCreatorDialog({
  open,
  onClose,
  creators,
}: {
  open: boolean;
  onClose: () => void;
  creators: GardenCreators;
}) {
  const { formatMessage } = useIntl();
  const address = useAddressInput((resolved) => {
    if (creators.creators.some((creator) => compareAddresses(creator, resolved))) {
      return {
        success: false,
        error: formatMessage({ id: "cockpit.community.gardenCreators.alreadyCreator" }),
      };
    }
    void creators.addCreator(resolved as Address).then((sent) => {
      if (sent) onClose();
      // The field clears as the wallet opens. A failed send puts the address back to retry.
      else address.setInput(resolved);
    });
    return { success: true };
  }, formatMessage);
  const busy = creators.isWriting || (address.shouldResolveEns && address.resolvingEns);
  const formId = "admin-add-garden-creator-dialog";

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !creators.isWriting) onClose();
      }}
      size="sm"
      tone="community"
      preventClose={creators.isWriting}
      title={formatMessage({ id: "cockpit.community.gardenCreators.addDialog.title" })}
      description={formatMessage({ id: "cockpit.community.gardenCreators.addDialog.description" })}
      actions={
        <>
          <Button
            type="button"
            emphasis="tertiary"
            size="sm"
            onClick={onClose}
            disabled={creators.isWriting}
          >
            {formatMessage({ id: "app.common.cancel" })}
          </Button>
          <Button
            type="submit"
            form={formId}
            size="sm"
            loading={creators.isWriting}
            disabled={busy || !address.trimmedInput}
          >
            {formatMessage({ id: "cockpit.community.gardenCreators.add" })}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void address.handleAdd();
        }}
      >
        <AdminTextField
          id="garden-creator-address"
          label={formatMessage({ id: "app.admin.roles.addressLabel" })}
          placeholder={formatMessage({ id: "admin.addMember.placeholder" })}
          value={address.input}
          onChange={(event) => address.setInput(event.target.value)}
          error={address.error || undefined}
          disabled={creators.isWriting}
          inputProps={{ autoCapitalize: "none", autoComplete: "off", spellCheck: false }}
        />
      </form>
    </AdminDialog>
  );
}
