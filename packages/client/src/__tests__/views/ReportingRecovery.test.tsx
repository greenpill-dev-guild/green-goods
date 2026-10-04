/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - Recovery code entry is its own account-move boundary; the other ceremony pages have their own files.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RecoveryView } from "../../views/Public/AgentReporting/RecoveryView";

type Props = Parameters<typeof RecoveryView>[0];
const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const makeProps = (): Props => ({
  stage: "code",
  channelLabel: "Telegram",
  recoveredAccount: ACCOUNT,
  error: null,
  account: ACCOUNT,
  connecting: false,
  connectWallet: vi.fn(),
  connectPasskey: vi.fn(async () => {}),
  start: vi.fn(async () => {}),
  prove: vi.fn(async () => {}),
  confirmCode: vi.fn(async () => {}),
  apply: vi.fn(async () => {}),
});
const view = (props: Props) => (
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <HelmetProvider>
        <RecoveryView {...props} />
      </HelmetProvider>
    </IntlProvider>
  </MemoryRouter>
);

describe("recovery code", () => {
  it("confirms the code from the action bar once all six digits are in", async () => {
    const props = makeProps();
    render(view(props));
    const bar = screen.getByRole("region", { name: "Next step" });
    const confirm = within(bar).getByRole("button", { name: "Confirm Code" });
    expect(confirm).toBeDisabled();
    // Why it waits is said where the code is typed, and the act carries it as its description.
    expect(confirm).toHaveAccessibleDescription("Enter all 6 digits to continue.");
    expect(bar).toHaveTextContent(/^Confirm Code$/);

    fireEvent.change(screen.getByRole("textbox", { name: /6-digit code/ }), {
      target: { value: "12 34-56" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(props.confirmCode).toHaveBeenCalledWith("123456"));
    expect(props.confirmCode).toHaveBeenCalledTimes(1);
  });

  it("keeps a wrong code on its field rather than beside the act", () => {
    render(view({ ...makeProps(), error: "wrong_code" }));
    expect(screen.getByRole("textbox", { name: /6-digit code/ })).toHaveAccessibleDescription(
      /didn't match/
    );
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(within(bar).queryByRole("alert")).not.toBeInTheDocument();
  });
});
