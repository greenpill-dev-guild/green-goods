import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";

export type SeedMoreChoice = "add" | "new";

/** Why adding to this group is closed, when it is. */
export type AddToGroupRefusal = "expired" | "not-creator";

export interface SeedMoreDialogProps {
  open: boolean;
  onClose: () => void;
  onContinue: (choice: SeedMoreChoice) => void;
  /** The group's title, as its row shows it. */
  title: string;
  /** The group's deadline, written out in full. */
  due: string;
  /** Adding keeps the group one row only before its deadline, and only for its creator. */
  addRefusal: AddToGroupRefusal | null;
}

/**
 * Seed More Like This (PRD-1022 D4, screens 26–27): one question before any
 * flow opens. Adding keeps the group's terms and deadline and asks only how
 * many; a new group starts from the same terms with everything editable.
 */
export function SeedMoreDialog({
  open,
  onClose,
  onContinue,
  title,
  due,
  addRefusal,
}: SeedMoreDialogProps) {
  const { formatMessage } = useIntl();
  const [choice, setChoice] = useState<SeedMoreChoice>(addRefusal ? "new" : "add");
  useEffect(() => {
    if (open) setChoice(addRefusal ? "new" : "add");
  }, [open, addRefusal]);

  const question = formatMessage(
    {
      id: "cockpit.garden.pool.seedMore.question",
      defaultMessage: "How should the new promises relate to {title}?",
    },
    { title: <b key="title">{title}</b> }
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      tone="garden"
      title={formatMessage({
        id: "cockpit.garden.pool.seedMore.title",
        defaultMessage: "Seed More Like This",
      })}
      actions={
        <>
          <AdminButton type="button" variant="text" onClick={onClose}>
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </AdminButton>
          <AdminButton type="button" variant="filled" onClick={() => onContinue(choice)}>
            {formatMessage({ id: "app.common.continue", defaultMessage: "Continue" })}
          </AdminButton>
        </>
      }
    >
      <div className="space-y-3" data-testid="seed-more">
        <p className="body-sm text-text-strong">{question}</p>
        <AdminChoiceGroup
          ariaLabel={formatMessage({
            id: "cockpit.garden.pool.seedMore.choice",
            defaultMessage: "Add to this group or start a new one",
          })}
          value={choice}
          onChange={(next) => setChoice(next as SeedMoreChoice)}
          columns={1}
          options={[
            {
              value: "add",
              disabled: addRefusal !== null,
              label: formatMessage({
                id: "cockpit.garden.pool.seedMore.add",
                defaultMessage: "Add to this group",
              }),
              description:
                addRefusal === "expired"
                  ? formatMessage({
                      id: "cockpit.garden.pool.seedMore.addExpired",
                      defaultMessage: "Its deadline has passed, so nothing can join it now.",
                    })
                  : addRefusal === "not-creator"
                    ? formatMessage({
                        id: "cockpit.garden.pool.seedMore.addNotCreator",
                        defaultMessage:
                          "Only the steward who created it can add to it and keep it one group.",
                      })
                    : formatMessage(
                        {
                          id: "cockpit.garden.pool.seedMore.addHint",
                          defaultMessage:
                            "Same terms and the same deadline, {due}. Only the number changes.",
                        },
                        { due }
                      ),
            },
            {
              value: "new",
              label: formatMessage({
                id: "cockpit.garden.pool.seedMore.new",
                defaultMessage: "Start a new group",
              }),
              description: formatMessage({
                id: "cockpit.garden.pool.seedMore.newHint",
                defaultMessage:
                  "Starts from these terms. You can change anything, including the deadline. It shows as its own group.",
              }),
            },
          ]}
        />
        <p className="body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.seedMore.help",
            defaultMessage:
              "Adding is possible while the group's deadline is still ahead. After that, only a new group can be started.",
          })}
        </p>
      </div>
    </AdminDialog>
  );
}
