import { Button, adminRoutes, type GardenDetailTab } from "@green-goods/shared";
import { RiFileList3Line, RiUploadCloudLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

interface TabActionsProps {
  gardenId: string;
  activeTab: GardenDetailTab;
  canManage: boolean;
  canReview: boolean;
  canManageRoles: boolean;
  onManageProfile: () => void;
  onManageRoles: () => void;
  openSection: (tab: GardenDetailTab, section: string) => void;
}

export function TabActions({
  gardenId,
  activeTab,
  canManage,
  canReview,
  canManageRoles,
  onManageProfile,
  onManageRoles,
  openSection,
}: TabActionsProps) {
  const { formatMessage } = useIntl();

  const tabActions: Record<GardenDetailTab, React.ReactNode> = {
    overview: canManage ? (
      <Button size="sm" onClick={onManageProfile}>
        {formatMessage({ id: "app.garden.detail.action.manageProfile" })}
      </Button>
    ) : null,
    impact: canReview ? (
      <Button size="sm" asChild>
        <Link to={adminRoutes.gardenAssessmentsCreate()}>
          <RiFileList3Line className="h-4 w-4" />
          {formatMessage({ id: "app.garden.admin.newAssessment" })}
        </Link>
      </Button>
    ) : (
      <Button size="sm" variant="secondary" asChild>
        <Link to={adminRoutes.garden({ view: "impact", section: "assessments" })}>
          {formatMessage({ id: "app.garden.admin.viewAssessments" })}
        </Link>
      </Button>
    ),
    work: (
      <div className="flex flex-wrap items-center gap-1.5">
        {canManage && (
          <Button size="sm" asChild>
            <Link to={adminRoutes.workSubmit()}>
              <RiUploadCloudLine className="h-4 w-4" />
              {formatMessage({ id: "app.admin.work.submitWork" })}
            </Link>
          </Button>
        )}
        <Button
          size="sm"
          variant={canManage ? "secondary" : "primary"}
          onClick={() => openSection("work", "work")}
        >
          {formatMessage({ id: "app.garden.detail.action.reviewPending" })}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => openSection("work", "decisions")}>
          {formatMessage({ id: "app.garden.detail.action.openDecisions" })}
        </Button>
      </div>
    ),
    community: (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" asChild>
          <Link to={adminRoutes.communityVault()}>
            {formatMessage({ id: "app.treasury.manageVault" })}
          </Link>
        </Button>
        {canManageRoles ? (
          <Button size="sm" variant="secondary" onClick={onManageRoles}>
            {formatMessage({ id: "app.garden.detail.action.manageRoles" })}
          </Button>
        ) : null}
      </div>
    ),
  };

  const actions = tabActions[activeTab];
  if (!actions) return null;

  return <div className="flex flex-wrap items-center gap-1.5 pt-3 pb-1">{actions}</div>;
}
