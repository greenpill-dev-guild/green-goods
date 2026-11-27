import { Button } from "@green-goods/shared/components/Button";
import { useIntl } from "react-intl";

/** Selection feedback stays consistent while search hides some of the picked roles. */
export function ManageRolesSelectionSummary({
  roles,
  people,
  hidden,
  onShow,
  onClear,
}: {
  roles: number;
  people: number;
  hidden: number;
  onShow: () => void;
  onClear: () => void;
}) {
  const { formatMessage } = useIntl();
  if (!roles) return formatMessage({ id: "admin.manageRoles.selectHint" });
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-text-strong">
        {formatMessage({ id: "admin.manageRoles.selection" }, { roles, people })}
      </span>
      {hidden > 0 ? (
        <>
          <span>
            {formatMessage({ id: "admin.manageRoles.selectionHidden" }, { count: hidden })}
          </span>
          <Button type="button" emphasis="tertiary" size="compact" onClick={onShow}>
            {formatMessage({ id: "admin.manageRoles.showSelected" })}
          </Button>
        </>
      ) : null}
      <Button type="button" emphasis="tertiary" size="compact" onClick={onClear}>
        {formatMessage({ id: "admin.manageRoles.clearSelection" })}
      </Button>
    </span>
  );
}
