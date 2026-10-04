import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";
import { DraftSheet } from "../../components/Sheets/DraftSheet";

afterEach(cleanup);
function setup(extra = {}) {
  const props = {
    isOpen: true,
    onContinue: vi.fn(),
    onStartFresh: vi.fn(),
    onManage: vi.fn(),
    onClose: vi.fn(),
    imageCount: 1,
    ...extra,
  };
  const sheet = (isOpen: boolean) => (
    <IntlProvider locale="en" messages={messages}>
      <DraftSheet {...props} isOpen={isOpen} />
    </IntlProvider>
  );
  const { rerender } = render(sheet(props.isOpen));
  return { ...props, setOpen: (isOpen: boolean) => rerender(sheet(isOpen)) };
}
describe("draft recovery sheet", () => {
  it("dismisses without continuing or discarding", async () => {
    const props = setup();
    await userEvent.click(screen.getByTestId("pwa-sheet-close"));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onContinue).not.toHaveBeenCalled();
    expect(props.onStartFresh).not.toHaveBeenCalled();
  });
  it("starts fresh at once, because the saved draft stays in Your Work", async () => {
    const props = setup();
    expect(screen.getByText(messages["app.garden.draft.resumeDescription"])).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.startFresh"] })
    );
    expect(props.onStartFresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: messages["app.garden.draft.discard"] })).toBeNull();
  });
  it("says every draft slot is taken and points to Manage drafts", async () => {
    const props = setup({ onStartFresh: vi.fn().mockRejectedValue(new Error("draft-limit")) });
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.startFresh"] })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(messages["app.garden.draft.limit"]);
    expect(
      screen.queryByRole("button", { name: messages["app.garden.draft.startFresh"] })
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.manage"] })
    );
    expect(props.onManage).toHaveBeenCalledOnce();
    expect(props.onContinue).not.toHaveBeenCalled();
  });
  it("keeps Start Fresh on offer when it fails for another reason", async () => {
    setup({ onStartFresh: vi.fn().mockRejectedValue(new Error("quota")) });
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.startFresh"] })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(messages["app.garden.draft.failed"]);
    expect(
      screen.getByRole("button", { name: messages["app.garden.draft.startFresh"] })
    ).toBeVisible();
  });
  it("starts clean after the prompt is closed from outside and opened again", async () => {
    const props = setup({ onStartFresh: vi.fn().mockRejectedValue(new Error("draft-limit")) });
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.startFresh"] })
    );
    await screen.findByRole("alert");
    props.setOpen(false);
    props.setOpen(true);
    expect(
      await screen.findByRole("button", { name: messages["app.garden.draft.startFresh"] })
    ).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("still asks before discarding photos saved without an account", async () => {
    const props = setup({ legacyRecovery: true });
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.startFresh"] })
    );
    expect(props.onStartFresh).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.discard"] })
    );
    expect(props.onStartFresh).toHaveBeenCalledOnce();
  });
  it("retains the sheet and offers retry after failed recovery", async () => {
    const onContinue = vi
      .fn()
      .mockRejectedValueOnce(new Error("storage"))
      .mockResolvedValue(undefined);
    setup({ legacyRecovery: true, onContinue });
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.recover"] })
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: messages["app.garden.draft.recover"] })
    );
    expect(onContinue).toHaveBeenCalledTimes(2);
  });
});
