import { Alert, useCreateHypercertController } from "@green-goods/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { HypercertWizard } from "@/components/Hypercerts/HypercertWizard";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";

// Create Hypercert is a create/commit flow rendered as a centered 2xl AdminDialog
// (bottom-sheet on mobile), same as Submit Work and Create Assessment. The wizard
// owns its own ActionFlowShell chrome (header + scrolling steps + pinned actions);
// the AdminDialog close button is the exit (→ controller handleCancel).
export default function CreateHypercert() {
  const { formatMessage } = useIntl();
  const createHypercert = useCreateHypercertController();

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
    <AdminDialog
      open
      size="2xl"
      variant="flow"
      tone="hub"
      className="min-h-[90dvh] sm:min-h-0 sm:!max-w-3xl lg:!max-w-5xl"
      onOpenChange={(next) => {
        if (!next) createHypercert.handleCancel();
      }}
      title={title}
      description={description}
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      {body}
    </AdminDialog>
  );
}
