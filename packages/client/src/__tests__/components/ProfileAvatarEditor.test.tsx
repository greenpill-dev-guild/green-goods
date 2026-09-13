/**
 * @vitest-environment jsdom
 */

import {
  SheetActions,
  type SheetActionsProps,
} from "@green-goods/shared/components/Dialog/SheetActions";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileAvatarEditor } from "@/components/Features/Profile/ProfileAvatarEditor";

const ADDRESS_A = "0x1111111111111111111111111111111111111111";
const ADDRESS_B = "0x2222222222222222222222222222222222222222";

const avatarEditorMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  continueAfterReconnect: vi.fn(),
  discardDraft: vi.fn(),
  save: vi.fn(),
  editor: {
    address: "0x1111111111111111111111111111111111111111",
    clear: vi.fn(),
    continueAfterReconnect: vi.fn(),
    discardDraft: vi.fn(),
    draft: null as { action?: "set" | "clear"; file: File | null } | null,
    error: null as Error | null,
    isSaving: false,
    save: vi.fn(),
    stage: "idle",
  },
  resolved: {
    avatarUri: "https://cdn.example/avatar.webp",
    isLoading: false,
    record: null,
    source: "app",
  },
  online: { isOnline: true },
  sheet: {
    dragToDismiss: true,
    onClose: null as (() => void) | null,
  },
}));

avatarEditorMocks.editor.clear = avatarEditorMocks.clear;
avatarEditorMocks.editor.continueAfterReconnect = avatarEditorMocks.continueAfterReconnect;
avatarEditorMocks.editor.discardDraft = avatarEditorMocks.discardDraft;
avatarEditorMocks.editor.save = avatarEditorMocks.save;

vi.mock("@green-goods/shared/components/Dialog/PwaSheet", () => ({
  PwaSheet: ({
    actions,
    ariaLabel,
    children,
    closeLabel,
    description,
    dragToDismiss,
    onClose,
    open,
    role = "dialog",
    testId,
    title,
  }: {
    actions?: SheetActionsProps;
    ariaLabel?: string;
    children: ReactNode;
    closeLabel?: string;
    description?: ReactNode;
    dragToDismiss?: boolean;
    onClose: () => void;
    open: boolean;
    role?: "dialog" | "alertdialog";
    testId?: string;
    title?: ReactNode;
  }) => {
    avatarEditorMocks.sheet.dragToDismiss = dragToDismiss ?? true;
    avatarEditorMocks.sheet.onClose = onClose;
    return open ? (
      <section
        role={role}
        aria-label={typeof title === "string" ? title : ariaLabel}
        data-testid={testId}
        data-drag-to-dismiss={String(dragToDismiss)}
      >
        <span data-testid={`${testId}-drag-handle`} />
        {title ? <h2>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
        {title ? (
          <button
            type="button"
            data-testid="pwa-sheet-close"
            aria-label={closeLabel}
            onClick={onClose}
          />
        ) : null}
        {children}
        {actions ? <SheetActions {...actions} /> : null}
      </section>
    ) : null;
  },
}));

vi.mock("@green-goods/shared/modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: {
    cleanupFile: vi.fn(),
    getOrCreateUrl: vi.fn(() => "blob:profile-avatar-draft"),
  },
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => avatarEditorMocks.online.isOnline,
}));

vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/hooks/profile/useProfileAvatar")>()),
  useProfileAvatarEditor: () => avatarEditorMocks.editor,
  useResolvedProfileAvatar: () => avatarEditorMocks.resolved,
}));

function renderEditor() {
  return render(
    <IntlProvider locale="en" messages={{}}>
      <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
    </IntlProvider>
  );
}

async function openEditor() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
  return user;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ProfileAvatarEditor", () => {
  beforeEach(() => {
    avatarEditorMocks.clear.mockReset();
    avatarEditorMocks.continueAfterReconnect.mockReset();
    avatarEditorMocks.discardDraft.mockReset();
    avatarEditorMocks.save.mockReset();
    avatarEditorMocks.editor.address = ADDRESS_A;
    avatarEditorMocks.editor.draft = null;
    avatarEditorMocks.editor.error = null;
    avatarEditorMocks.editor.isSaving = false;
    avatarEditorMocks.editor.stage = "idle";
    avatarEditorMocks.online.isOnline = true;
    avatarEditorMocks.resolved.avatarUri = "https://cdn.example/avatar.webp";
    avatarEditorMocks.resolved.source = "app";
    avatarEditorMocks.sheet.dragToDismiss = true;
    avatarEditorMocks.sheet.onClose = null;
  });

  it("renders a compact bottom sheet with no repeated avatar and one picker", async () => {
    avatarEditorMocks.resolved.source = "fallback";
    renderEditor();
    await openEditor();

    const sheet = screen.getByRole("dialog", { name: "Profile Photo" });
    expect(within(sheet).getByTestId("profile-photo-sheet-drag-handle")).toBeVisible();
    expect(within(sheet).getByRole("heading", { name: "Profile Photo" })).toBeVisible();
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(within(sheet).getAllByRole("button", { name: "Choose Photo" })).toHaveLength(1);
    expect(within(sheet).getAllByTestId("profile-photo-input")).toHaveLength(1);
    expect(within(sheet).queryByRole("button", { name: /save photo/i })).not.toBeInTheDocument();
  });

  it("shows only Replace Photo and Remove Photo for a saved app avatar", async () => {
    renderEditor();
    await openEditor();

    const sheet = screen.getByRole("dialog", { name: "Profile Photo" });
    expect(within(sheet).getAllByRole("button", { name: "Replace Photo" })).toHaveLength(1);
    expect(within(sheet).getByRole("button", { name: "Remove Photo" })).toBeVisible();
    expect(within(sheet).queryByText("Choose Photo")).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /save photo/i })).not.toBeInTheDocument();
  });

  it("saves immediately after file selection and closes on success", async () => {
    avatarEditorMocks.save.mockResolvedValueOnce(undefined);
    renderEditor();
    const user = await openEditor();
    const file = new File(["image"], "profile.webp", { type: "image/webp" });

    await user.upload(screen.getByTestId("profile-photo-input"), file);

    await waitFor(() => expect(avatarEditorMocks.save).toHaveBeenCalledWith(file));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profile Photo" })).not.toBeInTheDocument()
    );
  });

  it("keeps the sheet open and blocks every dismissal path while saving", async () => {
    const pending = deferred<void>();
    avatarEditorMocks.save.mockReturnValueOnce(pending.promise);
    renderEditor();
    const user = await openEditor();

    await user.upload(
      screen.getByTestId("profile-photo-input"),
      new File(["image"], "profile.webp", { type: "image/webp" })
    );

    expect(screen.getByRole("button", { name: "Saving photo…" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(avatarEditorMocks.sheet.dragToDismiss).toBe(false);
    act(() => avatarEditorMocks.sheet.onClose?.());
    expect(screen.getByRole("dialog", { name: "Profile Photo" })).toBeVisible();

    await act(async () => pending.resolve());
  });

  it.each([
    ["normalizing", /preparing photo/i],
    ["uploading", /uploading photo/i],
    ["signing", /saving photo/i],
    ["saving", /saving photo/i],
  ])("shows the %s stage in the active action row", async (stage, label) => {
    avatarEditorMocks.editor.stage = stage;
    renderEditor();
    await openEditor();
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-busy", "true");
  });

  it("retains the published avatar and offers retry, change, and discard after failure", async () => {
    avatarEditorMocks.save.mockImplementationOnce(async (file: File) => {
      avatarEditorMocks.editor.draft = { action: "set", file };
      throw new Error("save failed");
    });
    renderEditor();
    const user = await openEditor();

    await user.upload(
      screen.getByTestId("profile-photo-input"),
      new File(["image"], "new.webp", { type: "image/webp" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/please try again/i);
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Choose a Different Photo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard Draft" })).toBeEnabled();
    expect(screen.getByRole("img", { name: "Unpublished profile photo draft" })).toHaveAttribute(
      "src",
      "blob:profile-avatar-draft"
    );
    expect(screen.getByRole("img", { name: "Profile photo" })).toHaveAttribute(
      "src",
      "https://cdn.example/avatar.webp"
    );
  });

  it("explains how to recover when the active passkey is unavailable", async () => {
    avatarEditorMocks.save.mockImplementationOnce(async (file: File) => {
      avatarEditorMocks.editor.draft = { action: "set", file };
      const unavailable = new Error("No passkey is available for this request.");
      unavailable.name = "NotAllowedError";
      const wrapped = new Error("Failed to request credential.");
      (wrapped as Error & { cause?: unknown }).cause = unavailable;
      throw wrapped;
    });
    renderEditor();
    const user = await openEditor();

    await user.upload(
      screen.getByTestId("profile-photo-input"),
      new File(["image"], "new.webp", { type: "image/webp" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't find this passkey. Sign in again, then try once more."
    );
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
  });

  it("retries a durable draft and closes on success", async () => {
    avatarEditorMocks.editor.draft = {
      action: "set",
      file: new File(["draft"], "draft.webp", { type: "image/webp" }),
    };
    avatarEditorMocks.continueAfterReconnect.mockResolvedValueOnce(undefined);
    renderEditor();
    const user = await openEditor();

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    expect(avatarEditorMocks.continueAfterReconnect).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profile Photo" })).not.toBeInTheDocument()
    );
  });

  it("lets a different selection supersede a durable draft", async () => {
    avatarEditorMocks.editor.draft = {
      action: "set",
      file: new File(["draft"], "draft.webp", { type: "image/webp" }),
    };
    avatarEditorMocks.save.mockResolvedValueOnce(undefined);
    renderEditor();
    const user = await openEditor();
    const replacement = new File(["new"], "new.webp", { type: "image/webp" });

    await user.upload(screen.getByTestId("profile-photo-input"), replacement);

    expect(avatarEditorMocks.save).toHaveBeenCalledWith(replacement);
    expect(avatarEditorMocks.continueAfterReconnect).not.toHaveBeenCalled();
  });

  it("discards a durable draft and returns to the steady actions", async () => {
    avatarEditorMocks.editor.draft = { action: "clear", file: null };
    avatarEditorMocks.discardDraft.mockImplementationOnce(async () => {
      avatarEditorMocks.editor.draft = null;
    });
    const rendered = renderEditor();
    const user = await openEditor();

    await user.click(screen.getByRole("button", { name: "Discard Draft" }));
    rendered.rerender(
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );

    expect(avatarEditorMocks.discardDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Replace Photo" })).toBeEnabled();
  });

  it("keeps offline retry visible but disabled", async () => {
    avatarEditorMocks.editor.draft = { action: "set", file: null };
    avatarEditorMocks.online.isOnline = false;
    renderEditor();
    await openEditor();

    expect(screen.getByRole("button", { name: /reconnect to publish/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose a Different Photo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard Draft" })).toBeEnabled();
  });

  it("handles removal confirmation and cancellation inside the same sheet", async () => {
    renderEditor();
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Remove Photo" }));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Remove profile photo?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Remove profile photo?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep Photo" }));

    expect(screen.getByRole("dialog", { name: "Profile Photo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Photo" })).toBeVisible();
  });

  it("removes the app avatar and closes on success", async () => {
    avatarEditorMocks.clear.mockResolvedValueOnce(undefined);
    renderEditor();
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Remove Photo" }));
    await user.click(screen.getByRole("button", { name: "Remove Photo" }));

    expect(avatarEditorMocks.clear).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profile Photo" })).not.toBeInTheDocument()
    );
  });

  it("turns a failed removal into a retryable durable-draft state", async () => {
    avatarEditorMocks.clear.mockImplementationOnce(async () => {
      avatarEditorMocks.editor.draft = { action: "clear", file: null };
      throw new Error("remove failed");
    });
    renderEditor();
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Remove Photo" }));
    await user.click(screen.getByRole("button", { name: "Remove Photo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not remove/i);
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Choose a Different Photo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard Draft" })).toBeEnabled();
  });

  it("preserves the fixed feedback region and native input relationship", async () => {
    avatarEditorMocks.editor.error = new Error("Draft restoration failed");
    renderEditor();
    await openEditor();

    const input = screen.getByTestId("profile-photo-input");
    const feedback = screen.getByRole("alert");
    expect(feedback).toHaveStyle({ minBlockSize: "2lh" });
    expect(feedback).toHaveAttribute("tabindex", "0");
    const pickerButton = screen.getByRole("button", { name: "Replace Photo" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(pickerButton).toHaveAccessibleDescription(
      /could not restore your saved profile photo draft/i
    );
    expect(pickerButton).toHaveAttribute("aria-invalid", "true");
  });

  it("closes and resets transient sheet state when the active account changes", async () => {
    const rendered = renderEditor();
    await openEditor();
    avatarEditorMocks.editor.address = ADDRESS_B;

    rendered.rerender(
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profile Photo" })).not.toBeInTheDocument()
    );
  });
});
