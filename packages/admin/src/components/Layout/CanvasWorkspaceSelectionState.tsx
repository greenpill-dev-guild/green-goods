import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiArrowRightSLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminCard, AdminCardBody, AdminCardHeader } from "../AdminCard";

// Paradigm: Ritual — single-purpose garden selection, focused attention.

interface WorkspaceGarden {
  id: string;
  name: string;
  location?: string;
}

interface CanvasWorkspaceSelectionStateProps {
  workspaceLabel: string;
  gardens: WorkspaceGarden[];
  onSelectGarden: (garden: WorkspaceGarden) => void;
}

export function CanvasWorkspaceSelectionState({
  workspaceLabel,
  gardens,
  onSelectGarden,
}: CanvasWorkspaceSelectionStateProps) {
  const { formatMessage } = useIntl();

  if (gardens.length === 0) {
    return (
      <div className="py-8">
        <AdminCard density="none" className="mx-auto max-w-xl">
          <AdminCardBody>
            <EmptyState
              titleAs="h2"
              icon={<RiSeedlingLine />}
              title={formatMessage({
                id: "cockpit.workspace.noGardens",
                defaultMessage: "No gardens yet",
              })}
              description={formatMessage({
                id: "cockpit.workspace.noGardensDescription",
                defaultMessage: "Create your first garden to start using the canvas workspaces.",
              })}
              action={
                <AdminButton asChild>
                  <Link to={adminRoutes.gardenCreate()}>
                    {formatMessage({
                      id: "cockpit.workspace.createGarden",
                      defaultMessage: "Create Garden",
                    })}
                  </Link>
                </AdminButton>
              }
            />
          </AdminCardBody>
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="py-8 min-[600px]:px-4 sm:px-6">
      <AdminCard density="none" className="mx-auto max-w-3xl">
        <AdminCardHeader>
          <div>
            <AdminCardTitle as="h2">
              {formatMessage({
                id: "cockpit.workspace.chooseGardenTitle",
                defaultMessage: "Choose a Garden",
              })}
            </AdminCardTitle>
            <p className="mt-1 type-body text-text-sub">
              {formatMessage(
                {
                  id: "cockpit.workspace.chooseGardenDescription",
                  defaultMessage: "Select a garden to open the {workspace} workspace.",
                },
                { workspace: workspaceLabel }
              )}
            </p>
          </div>
        </AdminCardHeader>
        <AdminCardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {gardens.map((garden) => (
              <button
                key={garden.id}
                type="button"
                onClick={() => onSelectGarden(garden)}
                className="flex items-center justify-between gap-3 rounded-xl border border-stroke-soft bg-bg-white px-4 py-3 text-left transition hover:bg-[rgb(var(--text-strong-950)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))]"
                aria-label={formatMessage(
                  {
                    id: "cockpit.workspace.openGarden",
                    defaultMessage: "Open {garden}",
                  },
                  { garden: garden.name }
                )}
              >
                <div className="min-w-0">
                  <p className="truncate type-label-sm font-medium text-text-strong">
                    {garden.name}
                  </p>
                  {garden.location ? (
                    <p className="mt-0.5 truncate type-meta text-text-soft">{garden.location}</p>
                  ) : null}
                </div>
                <RiArrowRightSLine className="h-4 w-4 flex-shrink-0 text-text-soft" />
              </button>
            ))}
          </div>
        </AdminCardBody>
      </AdminCard>
    </div>
  );
}
