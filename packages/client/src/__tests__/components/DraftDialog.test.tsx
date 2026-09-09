import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";
import { DraftDialog } from "../../components/Dialogs/DraftDialog";

afterEach(cleanup);
function setup(extra = {}) {
  const props = {
    isOpen: true,
    onContinue: vi.fn(),
    onStartFresh: vi.fn(),
    onClose: vi.fn(),
    imageCount: 1,
    ...extra,
  };
  render(
    <IntlProvider locale="en" messages={messages}>
      <DraftDialog {...props} />
    </IntlProvider>
  );
  return props;
}
describe("draft recovery sheet", () => {
  it("dismisses without continuing or discarding", async () => {
    const props = setup();
    await userEvent.click(screen.getByTestId("pwa-sheet-close"));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onContinue).not.toHaveBeenCalled();
    expect(props.onStartFresh).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation before discarding", async () => {
    const props = setup();
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
