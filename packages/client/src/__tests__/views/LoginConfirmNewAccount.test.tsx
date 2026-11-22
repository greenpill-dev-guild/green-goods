/**
 * The question sign-in asks on a shared phone, as the Login view draws it: the typed name belongs
 * to nobody and another account is saved here. The controller that decides to ask is tested in
 * Shared; this stubs it and checks the screen itself: the words, where focus lands, and the two
 * ways on.
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

function renderQuestion(savedAccountName: string | undefined) {
  const createNamedAccount = vi.fn();
  const goTo = vi.fn();
  controller.current = {
    auth: {
      hasStoredCredential: true,
      isAuthenticated: false,
      isAuthenticating: false,
      isReady: true,
    },
    showPilotEnrollment: false,
    isNestedRoute: false,
    screen: "confirmNewAccount",
    username: "marja ",
    savedAccountName,
    loadingState: null,
    loadingMessage: undefined,
    loginError: null,
    intl,
    createNamedAccount,
    goTo,
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
  return { createNamedAccount, goTo };
}

afterEach(cleanup);

describe("Login: ask before a new account on a shared phone", () => {
  it.each([
    {
      saved: "maria",
      line: "No account is named marja. This phone has the account maria. Create a new account?",
    },
    {
      saved: undefined,
      line: "No account is named marja. Another account is saved on this phone. Create a new account?",
    },
  ])("asks about $saved, puts focus on the question, and offers both ways on", async ({
    saved,
    line,
  }) => {
    const user = userEvent.setup();
    const { createNamedAccount, goTo } = renderQuestion(saved);

    const question = screen.getByText(line);
    // The pressed Continue is gone; a screen reader reads the question instead of losing focus.
    expect(question).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Create New Account" }));
    expect(createNamedAccount).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Check the Name" }));
    expect(goTo).toHaveBeenCalledWith("username");
  });
});
