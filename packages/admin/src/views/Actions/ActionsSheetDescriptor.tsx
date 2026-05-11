import {
  adminRoutes,
  localizeAction,
  useRouteBackedLeftSheetConfig,
  type Action,
  type ActionsRouteState,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { ActionDetailPanel } from "./ActionDetail";
import CreateAction from "./CreateAction";
import EditAction from "./EditAction";

interface ActionsSheetDescriptorProps {
  routeState: ActionsRouteState;
  actions: Action[];
  isLoading: boolean;
  canManageActions: boolean;
}

export function ActionsSheetDescriptor({
  routeState,
  actions,
  isLoading,
  canManageActions,
}: ActionsSheetDescriptorProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();

  const sheetDescriptor = useMemo(() => {
    if (routeState.kind === "create") {
      return {
        title: formatMessage({
          id: "admin.actions.createAction",
          defaultMessage: "Create action",
        }),
        content: <CreateAction layout="sheet" />,
        width: "wide" as const,
      };
    }

    if (routeState.kind === "detail") {
      const action = actions.find((record) => record.id === routeState.actionId);
      const displayAction = action ? localizeAction(action, intl.locale) : null;
      return {
        title:
          displayAction?.title ??
          formatMessage({
            id: "app.admin.nav.actions",
            defaultMessage: "Actions",
          }),
        content: (
          <ActionDetailPanel
            actionId={routeState.actionId}
            actions={actions}
            isLoading={isLoading}
            canManageActions={canManageActions}
            onClose={() => navigate(routeState.closeTo)}
            onEdit={() =>
              navigate(adminRoutes.actionEdit(routeState.actionId, routeState.listSearch))
            }
          />
        ),
      };
    }

    if (routeState.kind === "edit") {
      const action = actions.find((record) => record.id === routeState.actionId);
      return {
        title: action
          ? formatMessage({ id: "app.actions.edit.title" }, { name: action.title })
          : formatMessage({
              id: "app.actions.edit",
              defaultMessage: "Edit action",
            }),
        content: action ? (
          <EditAction layout="sheet" />
        ) : (
          <ActionDetailPanel
            actionId={routeState.actionId}
            actions={actions}
            isLoading={isLoading}
            canManageActions={canManageActions}
            onClose={() => navigate(routeState.closeTo)}
            onEdit={() => undefined}
          />
        ),
        width: "wide" as const,
      };
    }

    return null;
  }, [actions, canManageActions, formatMessage, intl.locale, isLoading, navigate, routeState]);

  const routeBackedSheetConfig = useMemo(
    () =>
      sheetDescriptor && routeState.contentId
        ? {
            title: sheetDescriptor.title,
            content: sheetDescriptor.content,
            closeTo: routeState.closeTo,
            width: sheetDescriptor.width,
          }
        : null,
    [routeState.closeTo, routeState.contentId, sheetDescriptor]
  );

  useRouteBackedLeftSheetConfig(routeBackedSheetConfig);

  return null;
}
