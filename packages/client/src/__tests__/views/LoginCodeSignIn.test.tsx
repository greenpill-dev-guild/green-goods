// TEST-QUALITY: allow-small-test-file - Login.test.tsx mocks Splash and runs the real controller; these screens need the real Splash for their fields and a stubbed controller, and Vitest module mocks are per file.
/**
 * Email sign-in as the Login view draws it, with the switch on: the entry's second button opens
 * the other ways, email sends a code, and the code signs in. The flow's logic is tested in
 * Shared; this stubs the controller and checks the screens and where each press goes.
 */

import en from "@green-goods/shared/i18n/en.json";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { createIntl, IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const controller = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@green-goods/shared/hooks/client-ui/auth/useLoginScreenController", () => ({
  useLoginScreenController: () => controller.current,
}));

import { Login } from "../../views/Login";

const intl = createIntl({ locale: "en", messages: en });

function renderScreen(screenName: string, codeSignIn: Record<string, unknown> = {}) {
  const goTo = vi.fn();
  const walletLogin = vi.fn();
  const code = {
    enabled: true,
    step: "email",
    email: "",
    setEmail: vi.fn(),
    code: "",
    setCode: vi.fn(),
    emailValid: false,
    sending: false,
    signingIn: false,
    error: null,
    sendCode: vi.fn(),
    signIn: vi.fn(),
    changeEmail: vi.fn(),
    reset: vi.fn(),
    ...codeSignIn,
  };
  controller.current = {
    auth: {
      hasStoredCredential: false,
      isAuthenticated: false,
      isAuthenticating: false,
      isReady: true,
    },
    showPilotEnrollment: false,
    isNestedRoute: false,
    screen: screenName,
    username: "",
    loadingState: null,
    loadingMessage: undefined,
    loginError: null,
    passkeyServerEnabled: true,
    intl,
    goTo,
    walletLogin,
    codeSignIn: code,
  };
  render(
    <IntlProvider locale="en" messages={en}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/home/login"]}>
          <Login />
        </MemoryRouter>
      </HelmetProvider>
    </IntlProvider>
  );
  return { goTo, walletLogin, code };
}

afterEach(cleanup);

describe("Login: email sign-in", () => {
  it("offers other ways from the entry, then email beside a wallet", async () => {
    const user = userEvent.setup();
    const entry = renderScreen("entry");
    await user.click(screen.getByRole("button", { name: "Other Ways to Sign In" }));
    expect(entry.goTo).toHaveBeenCalledWith("otherWays");
    cleanup();

    const ways = renderScreen("otherWays");
    expect(
      screen.getByText("Sharing this phone? Each person signs in with their own email.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in with Email" }));
    expect(ways.goTo).toHaveBeenCalledWith("code");
    await user.click(screen.getByRole("button", { name: "Sign in with a Wallet" }));
    expect(ways.walletLogin).toHaveBeenCalledOnce();
  });

  it("asks for an email with the email keyboard, and sends the code", async () => {
    const user = userEvent.setup();
    const { code } = renderScreen("code", { email: "ada@example.com", emailValid: true });
    const field = screen.getByLabelText("Email");
    expect(field).toHaveAttribute("type", "email");
    expect(field).toHaveAttribute("autocomplete", "email");
    await user.click(screen.getByRole("button", { name: "Send Code" }));
    expect(code.sendCode).toHaveBeenCalledOnce();
  });

  it("takes the code with the one-time-code keyboard, says what failed, and goes back", async () => {
    const user = userEvent.setup();
    const { code } = renderScreen("code", {
      step: "code",
      email: "ada@example.com",
      emailValid: true,
      code: "123456",
      error: "That code didn't work. Check it, or send a new one.",
    });
    const field = screen.getByLabelText("Sign-in code");
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("alert")).toHaveTextContent("That code didn't work.");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(code.signIn).toHaveBeenCalledOnce();
    await user.click(screen.getByText("Back"));
    expect(code.changeEmail).toHaveBeenCalledOnce();
  });
});
