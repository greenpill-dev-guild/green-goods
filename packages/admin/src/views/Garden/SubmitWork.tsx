import type { SubmitWorkAuthSnapshot } from "@green-goods/shared/hooks/admin-ui/garden/useSubmitWorkController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useAuthState } from "@green-goods/shared/providers/Auth";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { SubmitWorkFlow, type SubmitWorkLayout } from "./components/SubmitWorkFlow";

function parseHubContext(search: string) {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const sort = params.get("sort");
  return {
    gardenId: params.get("gardenId") ?? params.get("gardenAddress") ?? undefined,
    view: view === "work" || view === "assess" || view === "certify" ? view : undefined,
    sort: sort === "newest" || sort === "oldest" ? sort : undefined,
  } as const;
}

export interface SubmitWorkPanelProps {
  layout?: SubmitWorkLayout;
  onSuccess?: () => void;
  onCancel?: () => void;
  auth?: SubmitWorkAuthSnapshot;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function SubmitWorkPanel({ auth, ...props }: SubmitWorkPanelProps) {
  if (auth) return <SubmitWorkFlow {...props} auth={auth} />;
  return <SubmitWorkPanelWithAuth {...props} />;
}

function SubmitWorkPanelWithAuth(props: Omit<SubmitWorkPanelProps, "auth">) {
  const { isAuthenticated, authMode } = useAuthState();
  const { primaryAddress } = useUser();
  return <SubmitWorkFlow {...props} auth={{ authMode, isAuthenticated, primaryAddress }} />;
}

export default function SubmitWork() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const close = useCallback(
    () => navigate(adminRoutes.hub(parseHubContext(location.search))),
    [navigate, location.search]
  );
  const [panelDirty, setPanelDirty] = useState(false);
  const [panelBusy, setPanelBusy] = useState(false);
  const dirtyClose = useDirtyClose({
    isDirty: panelDirty,
    onClose: close,
    blockRouteChange: true,
    preventRouteChange: panelBusy,
    onDiscard: close,
  });

  return (
    <>
      <AdminDialog
        open
        size="lg"
        variant="flow"
        tone="garden"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={dirtyClose.onOpenChange}
        preventClose={panelBusy}
        title={formatMessage({ id: "app.admin.work.submit.title" })}
        description={formatMessage({ id: "app.admin.work.submit.description" })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <SubmitWorkPanel
          layout="dialog"
          onSuccess={close}
          onCancel={close}
          onDirtyChange={setPanelDirty}
          onBusyChange={setPanelBusy}
        />
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="garden"
      />
    </>
  );
}
