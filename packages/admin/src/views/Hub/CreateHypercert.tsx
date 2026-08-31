import { Alert } from "@green-goods/shared/components/Alert";
import { useCreateHypercertController } from "@green-goods/shared/hooks/admin-ui/hub/useCreateHypercertController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import {
  isHypercertMintingInProgress,
  useHypercertWizardStore,
} from "@green-goods/shared/stores/useHypercertWizardStore";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { HypercertWizard } from "@/components/Hypercerts/HypercertWizard";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";

function PendingHypercertRouteGuard({ active }: { active: boolean }) {
  useDirtyClose({
    isDirty: false,
    onClose: () => undefined,
    blockRouteChange: true,
    preventRouteChange: active,
  });

  return null;
}

// Create Hypercert is a create/commit flow rendered as a centered flow AdminDialog
// (full-width bottom-sheet on mobile, width from ADMIN_FLOW_DIALOG_CLASS), same as Submit Work
// and Create Assessment. The wizard owns its own ActionFlowShell chrome (header +
// scrolling steps + pinned actions); the AdminDialog close button is the exit
// (→ controller handleCancel).
export default function CreateHypercert() {
  const { formatMessage } = useIntl();
  const createHypercert = useCreateHypercertController();
  const isMintingInProgress = useHypercertWizardStore((state) =>
    isHypercertMintingInProgress(state.mintingState.status)
  );
  const preventClose = isMintingInProgress;
  const wizardMounted = Boolean(createHypercert.garden && createHypercert.canManage);

  const title = formatMessage({ id: "app.hypercerts.create.title" });

  let body: ReactNode;
  let description: string;
  if (!createHypercert.garden) {
    description = formatMessage({ id: "app.hypercerts.create.notFound" });
    body = (
      <ActionFlowShell layout="dialog" title={title}>
        <Alert variant="error">{description}</Alert>
      </ActionFlowShell>
    );
  } else if (!createHypercert.canManage) {
    description = formatMessage({ id: "app.hypercerts.create.unauthorized" });
    body = (
      <ActionFlowShell layout="dialog" title={title} context={createHypercert.garden.name}>
        <Alert variant="warning">{description}</Alert>
      </ActionFlowShell>
    );
  } else {
    description = formatMessage(
      { id: "app.hypercerts.create.description" },
      { gardenName: createHypercert.garden.name }
    );
    body = (
      <HypercertWizard
        gardenId={createHypercert.garden.id}
        gardenName={createHypercert.garden.name}
        onCancel={createHypercert.handleCancel}
        onComplete={createHypercert.handleComplete}
      />
    );
  }

  return (
    <>
      {wizardMounted ? null : <PendingHypercertRouteGuard active={isMintingInProgress} />}
      <AdminDialog
        open
        size="lg"
        variant="flow"
        tone="hub"
        className={ADMIN_FLOW_DIALOG_CLASS}
        // No local dirty-close prompt here (unlike Submit Work / Create Assessment's
        // useDirtyClose in "state" mode). HypercertWizard owns the route blocker once
        // it mounts; the shell guard above covers restored pending state before
        // garden/permission data resolves.
        onOpenChange={(next) => {
          if (!next) createHypercert.handleCancel();
        }}
        preventClose={preventClose}
        title={title}
        description={description}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        {body}
      </AdminDialog>
    </>
  );
}
