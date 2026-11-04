// TEST-QUALITY: allow-small-test-file - a held save is the one state this view adds, and no other file renders the editor
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditAction from "@/views/Actions/EditAction";
import { renderWithProviders, screen, userEvent } from "../../test-utils";

const editor = vi.hoisted(() => ({
  holdFeedback: null as null | Record<string, unknown>,
  submit: vi.fn(),
  checkAgain: vi.fn(),
  moveOn: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/actions/useActionEditorController", () => ({
  useActionEditorController: () => ({
    action: { id: "42161-7", title: "Plant the August beds" },
    actionDetailHref: "/actions/42161-7",
    actionsListHref: "/actions",
    actionsLoading: false,
    cancel: vi.fn(),
    form: useForm({
      defaultValues: {
        title: "Plant the August beds",
        startTime: new Date("2026-08-01T00:00:00.000Z"),
        endTime: new Date("2026-08-31T00:00:00.000Z"),
      },
    }),
    instructionConfig: {},
    isEditingInstructions: false,
    isLoading: false,
    isPendingEdit: false,
    isCheckingConfirmation: false,
    checkConfirmation: vi.fn(),
    holdFeedback: editor.holdFeedback,
    // Loading keeps the instruction editors out of a test about saving.
    isLoadingInstructions: true,
    setInstructionConfig: vi.fn(),
    setIsEditingInstructions: vi.fn(),
    setTranslations: vi.fn(),
    setTranslationsDirty: vi.fn(),
    submit: editor.submit,
    translations: {},
  }),
}));

const saveButton = () => screen.getByRole("button", { name: "Save Changes" });

describe("EditAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editor.holdFeedback = null;
  });

  it("shows a held save with Check Again and Move On, and Save waits", async () => {
    editor.holdFeedback = {
      title: "We couldn’t confirm your last save.",
      message: "It could still land, so saving waits until you check again or move on.",
      detail: "Title on chain: Plant the August beds",
      hasUnreadValues: false,
      isSettling: false,
      onCheckAgain: editor.checkAgain,
      onMoveOn: editor.moveOn,
    };
    renderWithProviders(<EditAction layout="sheet" />);

    expect(screen.getByText("We couldn’t confirm your last save.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Check Again" }));
    await userEvent.click(screen.getByRole("button", { name: "Move On" }));

    expect(editor.checkAgain).toHaveBeenCalledOnce();
    expect(editor.moveOn).toHaveBeenCalledOnce();
    expect(editor.submit).not.toHaveBeenCalled();
  });

  it("saves as before when nothing is held", async () => {
    renderWithProviders(<EditAction layout="sheet" />);

    expect(screen.queryByRole("button", { name: "Check Again" })).not.toBeInTheDocument();
    await userEvent.click(saveButton());

    expect(editor.submit).toHaveBeenCalledOnce();
  });
});
