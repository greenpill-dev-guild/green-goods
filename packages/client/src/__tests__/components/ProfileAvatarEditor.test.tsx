/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
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
  createPreviewUrl: vi.fn((file: File) => `blob:${file.name}`),
  cleanupPreviewUrl: vi.fn(),
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
}));

avatarEditorMocks.editor.clear = avatarEditorMocks.clear;
avatarEditorMocks.editor.continueAfterReconnect = avatarEditorMocks.continueAfterReconnect;
avatarEditorMocks.editor.discardDraft = avatarEditorMocks.discardDraft;
avatarEditorMocks.editor.save = avatarEditorMocks.save;

vi.mock("@green-goods/shared/components/Dialog/ConfirmDialog", () => ({
  DialogShell: ({
    children,
    open,
    title,
  }: {
    children: ReactNode;
    open: boolean;
    title: string;
  }) => (open ? <section aria-label={title}>{children}</section> : null),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: {
    cleanupUrl: avatarEditorMocks.cleanupPreviewUrl,
    createUrl: avatarEditorMocks.createPreviewUrl,
  },
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

describe("ProfileAvatarEditor", () => {
  beforeEach(() => {
    avatarEditorMocks.clear.mockReset();
    avatarEditorMocks.continueAfterReconnect.mockReset();
    avatarEditorMocks.createPreviewUrl.mockClear();
    avatarEditorMocks.cleanupPreviewUrl.mockClear();
    avatarEditorMocks.discardDraft.mockReset();
    avatarEditorMocks.save.mockReset();
    avatarEditorMocks.editor.address = ADDRESS_A;
    avatarEditorMocks.editor.draft = null;
    avatarEditorMocks.editor.error = null;
    avatarEditorMocks.editor.isSaving = false;
    avatarEditorMocks.editor.stage = "idle";
    avatarEditorMocks.online.isOnline = true;
    avatarEditorMocks.resolved.source = "app";
  });

  it("opens from an accessible avatar trigger and saves an accepted image", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    const input = screen.getByLabelText(/choose photo/i) as HTMLInputElement;
    const file = new File(["image"], "profile.webp", { type: "image/webp" });
    await user.upload(input, file);

    expect(input.files).toHaveLength(0);
    expect(screen.getByText(/draft photo has not been published/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /replace photo/i }));
    expect(avatarEditorMocks.save).toHaveBeenCalledWith(file);
  });

  it("revokes a superseded preview and accepts the same file again", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    const input = screen.getByLabelText(/choose photo/i) as HTMLInputElement;
    const first = new File(["first"], "first.webp", { type: "image/webp" });
    const second = new File(["second"], "second.webp", { type: "image/webp" });

    await user.upload(input, first);
    await user.upload(input, second);

    await waitFor(() =>
      expect(avatarEditorMocks.cleanupPreviewUrl).toHaveBeenCalledWith("blob:first.webp")
    );
    await user.upload(input, second);
    expect(input.files).toHaveLength(0);
  });

  it("offers recovery controls for an offline draft", async () => {
    avatarEditorMocks.editor.stage = "offline";
    avatarEditorMocks.editor.draft = { file: null };
    avatarEditorMocks.online.isOnline = false;
    const user = userEvent.setup();
    const rendered = renderEditor();

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));

    expect(screen.getByText(/saved on this device/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /reconnect to publish/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard draft/i })).toBeVisible();
    avatarEditorMocks.online.isOnline = true;
    rendered.rerender(
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(avatarEditorMocks.continueAfterReconnect).toHaveBeenCalledTimes(1);
  });

  it("restores recovery controls for a persisted draft after reload", async () => {
    avatarEditorMocks.editor.stage = "idle";
    avatarEditorMocks.editor.draft = {
      file: new File(["draft"], "profile-avatar.webp", { type: "image/webp" }),
    };
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));

    expect(screen.getByText(/saved on this device/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(avatarEditorMocks.continueAfterReconnect).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["clear", { action: "clear", file: null }],
    [
      "set",
      {
        action: "set",
        file: new File(["old"], "old-profile-avatar.webp", { type: "image/webp" }),
      },
    ],
  ])("makes a new selection supersede a persisted %s draft", async (_action, draft) => {
    avatarEditorMocks.editor.draft = {
      ...draft,
      action: draft.action as "clear" | "set",
    };
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeVisible();

    const selectedFile = new File(["new"], "new-profile-avatar.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText(/choose photo/i), selectedFile);

    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/saved on this device/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /replace photo/i }));
    expect(avatarEditorMocks.save).toHaveBeenCalledWith(selectedFile);
    expect(avatarEditorMocks.continueAfterReconnect).not.toHaveBeenCalled();
  });

  it("connects native file-input focus to the visible picker surface", async () => {
    const user = userEvent.setup();
    renderEditor();

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
    avatarEditorMocks.editor.stage = "signing";
    avatarEditorMocks.editor.draft = {
      file: new File(["draft"], "profile-avatar.webp", { type: "image/webp" }),
    };
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard draft/i })).toBeDisabled();
  });

  it("hides removal for ENS and fallback avatars", async () => {
    avatarEditorMocks.resolved.source = "ens";
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();
  });

  it("confirms removal and lets cancellation return to the editor", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    expect(screen.getByLabelText("Remove profile photo?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Remove profile photo?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    const confirms = screen.getAllByRole("button", { name: /remove photo/i });
    await user.click(confirms[1]!);
    expect(avatarEditorMocks.clear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["normalizing", /preparing photo/i],
    ["uploading", /uploading photo/i],
    ["signing", /saving photo/i],
    ["saving", /saving photo/i],
  ])("announces the %s stage", async (stage, label) => {
    avatarEditorMocks.editor.stage = stage;
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    expect(screen.getByRole("status")).toHaveTextContent(label);
  });

  it("announces save errors", async () => {
    avatarEditorMocks.save.mockRejectedValueOnce(new Error("nope"));
    avatarEditorMocks.editor.draft = { file: new File(["draft"], "draft.webp") };
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.upload(
      screen.getByLabelText(/choose photo/i),
      new File(["image"], "new.webp", { type: "image/webp" })
    );
    await user.click(screen.getByRole("button", { name: /replace photo/i }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  it("announces shared draft restoration errors", async () => {
    avatarEditorMocks.editor.error = new Error("Unable to restore the profile photo draft.");
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/could not restore your saved/i);
  });

  it("keeps feedback space and clears the photo input's error description", async () => {
    const user = userEvent.setup();
    const rendered = renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    const input = screen.getByLabelText(/choose photo/i);
    const feedback = rendered.container.querySelector(`[id="${input.id}-error"]`);
    expect(feedback).toBeInTheDocument();
    expect(feedback).toBeEmptyDOMElement();

    avatarEditorMocks.editor.error = new Error("Draft restoration failed");
    const editor = (
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );
    rendered.rerender(editor);
    expect(screen.getByRole("alert")).toBe(feedback);
    expect(input).toHaveAccessibleDescription(/could not restore your saved profile photo draft/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(feedback).toHaveAttribute("tabindex", "0");

    avatarEditorMocks.editor.error = null;
    rendered.rerender(
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );
    expect(feedback).toBeEmptyDOMElement();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports remove, continue, and discard failures with action-specific copy", async () => {
    const user = userEvent.setup();
    avatarEditorMocks.clear.mockRejectedValueOnce(new Error("remove failed"));
    const rendered = renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    await user.click(screen.getAllByRole("button", { name: /remove photo/i })[1]!);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not remove/i);

    avatarEditorMocks.editor.draft = { action: "clear", file: null };
    avatarEditorMocks.continueAfterReconnect.mockRejectedValueOnce(new Error("publish failed"));
    rendered.rerender(
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not publish/i);

    avatarEditorMocks.discardDraft.mockRejectedValueOnce(new Error("discard failed"));
    await user.click(screen.getByRole("button", { name: /discard draft/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not discard/i);
  });

  it("drops a staged preview when the active account changes", async () => {
    const user = userEvent.setup();
    const rendered = renderEditor();
    await user.click(screen.getByRole("button", { name: /edit profile photo/i }));
    await user.upload(
      screen.getByLabelText(/choose photo/i),
      new File(["image"], "profile.webp", { type: "image/webp" })
    );
    expect(screen.getByText(/draft photo has not been published/i)).toBeVisible();

    avatarEditorMocks.editor.address = ADDRESS_B;
    rendered.rerender(
      <IntlProvider locale="en" messages={{}}>
        <ProfileAvatarEditor fallbackAvatar="/images/avatar.png" />
      </IntlProvider>
    );

    await waitFor(() =>
      expect(screen.queryByText(/draft photo has not been published/i)).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /replace photo/i })).toBeDisabled();
  });
});
