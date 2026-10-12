/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - Recovery's account step and code entry are its own account-move boundary; the other ceremony pages have their own files.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FocusedShell } from "../../components/Navigation/FocusedSiteHeader";
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
  failure: null,
  savedPasskey: false,
  canFindAccount: true,
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

describe("recovery account step", () => {
  const onAccountStep = (): Props => ({ ...makeProps(), stage: "connect", account: null });
  const bar = () => screen.getByRole("region", { name: "Next step" });

  it("finds a passkey this browser does not remember by its account's name, and offers no new account", () => {
    const props = onAccountStep();
    render(view(props));
    expect(
      within(bar())
        .getAllByRole("button")
        .map((act) => act.textContent)
    ).toEqual(["Use Passkey", "Use Wallet"]);
    // The page moves an account. Nothing on it makes one.
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();

    fireEvent.click(within(bar()).getByRole("button", { name: "Use Passkey" }));
    expect(props.connectPasskey).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find Your Account");
    fireEvent.change(screen.getByRole("textbox", { name: /Account name/ }), {
      target: { value: " cleo " },
    });
    fireEvent.click(within(bar()).getByRole("button", { name: "Find Account" }));
    expect(props.connectPasskey).toHaveBeenCalledWith("cleo");
  });

  it("asks a remembered passkey at once, and still reaches another account by name", () => {
    const props = { ...onAccountStep(), savedPasskey: true };
    render(view(props));
    fireEvent.click(within(bar()).getByRole("button", { name: "Use Passkey" }));
    expect(props.connectPasskey).toHaveBeenCalledWith();
    fireEvent.click(screen.getByRole("button", { name: "Another account? Find it by name" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find Your Account");
  });

  it("says why connecting failed, and what to do next, in the heading card", () => {
    render(
      view({
        ...onAccountStep(),
        savedPasskey: true,
        failure: { reason: "prompt_closed", spoken: "Sign in was cancelled." },
      })
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passkey prompt closed. Try again, or use another way in."
    );
    expect(within(bar()).queryByRole("alert")).not.toBeInTheDocument();
  });
});

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

  it("moves focus to the next step's title when that step reuses the pressed button", async () => {
    // In the focused shell, as the route draws the page. Confirm Code and Move My Account are
    // the same act in the same place, so the button's node stays and only its name changes.
    const shelled = (props: Props) => (
      <MemoryRouter>
        <IntlProvider locale="en" messages={{}}>
          <HelmetProvider>
            <FocusedShell>
              <RecoveryView {...props} />
            </FocusedShell>
          </HelmetProvider>
        </IntlProvider>
      </MemoryRouter>
    );
    const props = makeProps();
    const { rerender } = render(shelled(props));
    fireEvent.change(screen.getByRole("textbox", { name: /6-digit code/ }), {
      target: { value: "123456" },
    });
    const pressed = screen.getByRole("button", { name: "Confirm Code" });
    pressed.focus();
    fireEvent.click(pressed);
    rerender(shelled({ ...props, stage: "confirm" }));

    expect(screen.getByRole("button", { name: "Move My Account" })).toBe(pressed);
    const title = screen.getByRole("heading", { level: 1 });
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveTextContent("Move This Account?");
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
