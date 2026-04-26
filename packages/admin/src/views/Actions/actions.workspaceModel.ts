import { adminRoutes } from "@green-goods/shared";
import {
  ACTION_CREATE_CONTENT_ID,
  decodePathSegment,
  toActionDetailContentId,
  toActionEditContentId,
} from "@/routes/sheetRegistry";
import { getActionsListSearch } from "./actions.utils";

export type ActionsRouteState =
  | {
      kind: "list";
      actionId: null;
      contentId: null;
      closeTo: string;
      listSearch: Record<string, string>;
    }
  | {
      kind: "create";
      actionId: null;
      contentId: typeof ACTION_CREATE_CONTENT_ID;
      closeTo: string;
      listSearch: Record<string, string>;
    }
  | {
      kind: "detail" | "edit";
      actionId: string;
      contentId: string;
      closeTo: string;
      listSearch: Record<string, string>;
    };

export function resolveActionsRouteState(
  pathname: string,
  searchParams: URLSearchParams
): ActionsRouteState {
  const listSearch = getActionsListSearch(searchParams);
  const closeTo = adminRoutes.actions(listSearch);
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 2 && segments[0] === "actions" && segments[1] === "create") {
    return {
      kind: "create",
      actionId: null,
      contentId: ACTION_CREATE_CONTENT_ID,
      closeTo,
      listSearch,
    };
  }

  if (segments.length === 3 && segments[0] === "actions" && segments[2] === "edit") {
    const actionId = decodePathSegment(segments[1]);
    return {
      kind: "edit",
      actionId,
      contentId: toActionEditContentId(actionId),
      closeTo,
      listSearch,
    };
  }

  if (segments.length === 2 && segments[0] === "actions") {
    const actionId = decodePathSegment(segments[1]);
    return {
      kind: "detail",
      actionId,
      contentId: toActionDetailContentId(actionId),
      closeTo,
      listSearch,
    };
  }

  return {
    kind: "list",
    actionId: null,
    contentId: null,
    closeTo,
    listSearch,
  };
}
