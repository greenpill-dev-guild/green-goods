import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import type { ReactNode } from "react";
import { AdminButton } from "@/components/AdminButton";

interface CanvasGardenAccessStateProps {
  onCreateGarden: () => void;
  canCreateGarden?: boolean;
  stewardAccess?: ReactNode;
}

export function CanvasGardenAccessState({
  onCreateGarden,
  canCreateGarden = true,
  stewardAccess,
}: CanvasGardenAccessStateProps) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="flex min-h-full flex-col items-center justify-center px-6 py-16"
      data-testid="canvas-no-garden-access"
    >
      <EmptyState
        titleAs="h1"
        icon={<RiSeedlingLine />}
        title={formatMessage({
          id: "cockpit.access.noGardenTitle",
          defaultMessage: "No garden access yet",
        })}
        description={
          canCreateGarden
            ? formatMessage({
                id: "cockpit.access.noGardenDescriptionCanCreate",
                defaultMessage:
                  "This wallet is not assigned to a steward or evaluator garden yet. Create a garden to start working in the canvas.",
              })
            : formatMessage({
                id: "cockpit.access.noGardenDescription",
                defaultMessage:
                  "This wallet is not assigned to a steward or evaluator garden yet. Ask a garden owner or steward to add you before using the canvas.",
              })
        }
        action={
          stewardAccess || canCreateGarden ? (
            <div className="flex w-full max-w-md flex-col items-center gap-6">
              {stewardAccess ? <div className="w-full">{stewardAccess}</div> : null}
              {canCreateGarden && (
                <AdminButton onClick={onCreateGarden}>
                  {formatMessage({
                    id: "cockpit.workspace.createGarden",
                    defaultMessage: "Create Garden",
                  })}
                </AdminButton>
              )}
            </div>
          ) : null
        }
      />
    </section>
  );
}
