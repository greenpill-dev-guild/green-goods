/** @vitest-environment jsdom */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountProfileAvatarEditor } from "@/components/Layout/AccountProfileAvatarEditor";
import { render, screen, waitFor } from "../test-utils";

const ADDRESS_A = "0x1111111111111111111111111111111111111111";
const ADDRESS_B = "0x2222222222222222222222222222222222222222";

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  continue: vi.fn(),
  createPreviewUrl: vi.fn((file: File) => `blob:${file.name}`),
  cleanupPreviewUrl: vi.fn(),
  discard: vi.fn(),
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
  online: { isOnline: true },
  resolved: {
    avatarUri: "https://cdn.example/avatar.webp",
    error: null,
    isLoading: false,
    record: null,
    source: "app",
  },
}));
mocks.editor.clear = mocks.clear;
mocks.editor.continueAfterReconnect = mocks.continue;
mocks.editor.discardDraft = mocks.discard;
mocks.editor.save = mocks.save;

vi.mock("@green-goods/shared/modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: {
    cleanupUrl: mocks.cleanupPreviewUrl,
    createUrl: mocks.createPreviewUrl,
  },
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.online.isOnline,
}));
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useProfileAvatarEditor: () => mocks.editor,
  useResolvedProfileAvatar: () => mocks.resolved,
}));
vi.mock("@/components/AdminDialog", () => ({
  AdminDialog: ({ open, title, children, actions }: any) =>
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
        {actions}
      </section>
    ) : null,
  AdminConfirmDialog: ({ isOpen, title, onClose, onConfirm, confirmLabel, cancelLabel }: any) =>
    isOpen ? (
      <section role="alertdialog" aria-label={title}>
        <button type="button" onClick={onClose}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </section>
    ) : null,
}));

describe("AccountProfileAvatarEditor", () => {
  beforeEach(() => {
    mocks.clear.mockReset();
    mocks.continue.mockReset();
    mocks.createPreviewUrl.mockClear();
    mocks.cleanupPreviewUrl.mockClear();
    mocks.discard.mockReset();
    mocks.save.mockReset();
    mocks.editor.address = ADDRESS_A;
    mocks.editor.error = null;
    mocks.editor.stage = "idle";
    mocks.editor.draft = null;
    mocks.editor.isSaving = false;
    mocks.online.isOnline = true;
    mocks.resolved.source = "app";
  });
  it("edits a published avatar and confirms removal", async () => {
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByRole("button", { name: /remove photo/i })).toHaveAttribute(
      "data-component",
      "AdminButton"
    );
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    expect(screen.getByRole("alertdialog", { name: "Remove profile photo?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("alertdialog", { name: "Remove profile photo?" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    await user.click(screen.getAllByRole("button", { name: /remove photo/i })[1]!);
    expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
  it("stages and publishes a replacement through the admin button surface", async () => {
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    const file = new File(["image"], "profile.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText(/choose photo/i), file);

    expect((screen.getByLabelText(/choose photo/i) as HTMLInputElement).files).toHaveLength(0);
    expect(screen.getByText(/draft photo has not been published/i)).toBeVisible();
    const replace = screen.getByRole("button", { name: /replace photo/i });
    expect(replace).toHaveAttribute("data-component", "AdminButton");
    await user.click(replace);

    expect(mocks.save).toHaveBeenCalledWith(file);
  });
  it("revokes superseded previews while the editor remains open", async () => {
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    const input = screen.getByLabelText(/choose photo/i) as HTMLInputElement;
    await user.upload(input, new File(["first"], "first.webp", { type: "image/webp" }));
    await user.upload(input, new File(["second"], "second.webp", { type: "image/webp" }));

    await waitFor(() => expect(mocks.cleanupPreviewUrl).toHaveBeenCalledWith("blob:first.webp"));
    expect(input.files).toHaveLength(0);
  });
  it("announces save errors in the dialog", async () => {
    mocks.save.mockRejectedValueOnce(new Error("unavailable"));
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.upload(
      screen.getByLabelText(/choose photo/i),
      new File(["image"], "profile.webp", { type: "image/webp" })
    );
    await user.click(screen.getByRole("button", { name: /replace photo/i }));

    expect(await screen.findByRole("alert")).toBeVisible();
  });
  it("announces shared draft restoration errors in the dialog", async () => {
    mocks.editor.error = new Error("Unable to restore the profile photo draft.");
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/could not restore your saved/i);
  });
  it("reports remove, continue, and discard failures with action-specific copy", async () => {
    const user = userEvent.setup();
    mocks.clear.mockRejectedValueOnce(new Error("remove failed"));
    const rendered = render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    await user.click(screen.getAllByRole("button", { name: /remove photo/i })[1]!);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not remove/i);

    mocks.editor.draft = { action: "clear", file: null };
    mocks.continue.mockRejectedValueOnce(new Error("publish failed"));
    rendered.rerender(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not publish/i);

    mocks.discard.mockRejectedValueOnce(new Error("discard failed"));
    await user.click(screen.getByRole("button", { name: /discard draft/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not discard/i);
  });
  it("drops a staged preview when the active account changes", async () => {
    const user = userEvent.setup();
    const rendered = render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.upload(
      screen.getByLabelText(/choose photo/i),
      new File(["image"], "profile.webp", { type: "image/webp" })
    );
    expect(screen.getByText(/draft photo has not been published/i)).toBeVisible();

    mocks.editor.address = ADDRESS_B;
    rendered.rerender(<AccountProfileAvatarEditor fallbackInitials="GG" />);

    await waitFor(() =>
      expect(screen.queryByText(/draft photo has not been published/i)).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /replace photo/i })).toBeDisabled();
  });
  it("hides removal for ENS and exposes offline recovery without auto-signing", async () => {
    mocks.resolved.source = "ens";
    mocks.editor.stage = "offline";
    mocks.editor.draft = { file: null };
    mocks.online.isOnline = false;
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reconnect to publish/i })).toBeDisabled();
    expect(mocks.continue).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /discard draft/i }));
    expect(mocks.discard).toHaveBeenCalledTimes(1);
  });
  it("restores recovery controls for a persisted clear draft after reload", async () => {
    mocks.editor.stage = "idle";
    mocks.editor.draft = { action: "clear", file: null };
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByText(/saved on this device/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(mocks.continue).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["clear", { action: "clear" as const, file: null }],
    [
      "set",
      {
        action: "set" as const,
        file: new File(["old"], "old-profile-avatar.webp", { type: "image/webp" }),
      },
    ],
  ])("makes a new selection supersede a persisted %s draft", async (_action, draft) => {
    mocks.editor.draft = draft;
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeVisible();

    const selectedFile = new File(["new"], "new-profile-avatar.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText(/choose photo/i), selectedFile);

    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/saved on this device/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /replace photo/i }));
    expect(mocks.save).toHaveBeenCalledWith(selectedFile);
    expect(mocks.continue).not.toHaveBeenCalled();
  });
  it("connects native file-input focus to the visible picker surface", async () => {
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    const input = screen.getByLabelText(/choose photo/i);
    const visiblePicker = input.closest("label");

    expect(visiblePicker).not.toBeNull();
    expect(visiblePicker).toContainElement(input);
    expect(visiblePicker).toHaveClass("focus-within:ring-2");
    input.focus();
    expect(input).toHaveFocus();
  });
  it("locks restored draft controls while publishing", async () => {
    mocks.editor.stage = "saving";
    mocks.editor.draft = { action: "clear", file: null };
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard draft/i })).toBeDisabled();
  });
  it.each([
    ["normalizing", /preparing photo/i],
    ["uploading", /uploading photo/i],
    ["signing", /saving photo/i],
    ["saving", /saving photo/i],
  ])("announces %s", async (stage, text) => {
    mocks.editor.stage = stage;
    const user = userEvent.setup();
    render(<AccountProfileAvatarEditor fallbackInitials="GG" />);
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByRole("status")).toHaveTextContent(text);
  });
});
