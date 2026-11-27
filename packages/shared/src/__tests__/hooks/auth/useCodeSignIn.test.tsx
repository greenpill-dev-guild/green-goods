/** @vitest-environment happy-dom */
/**
 * The email flow a sign-in screen drives: what counts as an address, the two steps,
 * how a failed code reads, and that leaving the flow forgets what was typed.
 */

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../i18n/en.json";

const config = vi.hoisted(() => ({ enabled: true }));
vi.mock("../../../config/openfort", () => ({
  isOpenfortSignInEnabled: () => config.enabled,
}));

import {
  isEmailAddress,
  type CodeSignInAuth,
  useCodeSignIn,
} from "../../../hooks/auth/useCodeSignIn";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(IntlProvider, { locale: "en", messages: en }, children);

function auth(overrides: Partial<CodeSignInAuth> = {}): CodeSignInAuth {
  return {
    isAuthenticating: false,
    error: null,
    openfortMethod: null,
    requestSignInCode: vi.fn(async () => {}),
    loginWithCode: vi.fn(async () => {}),
    ...overrides,
  };
}

afterEach(() => {
  config.enabled = true;
});

describe("useCodeSignIn", () => {
  it("knows an email address, and nothing else, as an address", () => {
    expect(isEmailAddress(" ada@example.com ")).toBe(true);
    expect(isEmailAddress("+27 82 555 0199")).toBe(false);
    expect(isEmailAddress("ada@")).toBe(false);
  });

  it("is off without the switch, so no screen offers it", () => {
    config.enabled = false;
    const { result } = renderHook(() => useCodeSignIn(auth()), { wrapper });
    expect(result.current.enabled).toBe(false);
  });

  it("sends a code, moves to the code step, and signs in with what was typed", async () => {
    const actions = auth();
    const { result } = renderHook(() => useCodeSignIn(actions), { wrapper });
    act(() => result.current.setEmail("ada@example.com"));
    await act(() => result.current.sendCode());
    expect(actions.requestSignInCode).toHaveBeenCalledWith("ada@example.com");
    expect(result.current.step).toBe("code");

    act(() => result.current.setCode("12 34 56"));
    await act(() => result.current.signIn());
    expect(actions.loginWithCode).toHaveBeenCalledWith("ada@example.com", "123456");
  });

  it("says a code was refused in plain words, and forgets everything on reset", async () => {
    const actions = auth();
    const { result, rerender } = renderHook(({ state }) => useCodeSignIn(state), {
      wrapper,
      initialProps: { state: actions },
    });
    act(() => result.current.setEmail("ada@example.com"));
    await act(() => result.current.sendCode());
    act(() => result.current.setCode("000000"));
    await act(() => result.current.signIn());
    rerender({ state: { ...actions, error: new Error("Invalid OTP"), openfortMethod: "email" } });
    expect(result.current.error).toBe("That code didn't work. Check it, or send a new one.");

    act(() => result.current.reset());
    expect(result.current).toMatchObject({
      step: "email",
      email: "",
      code: "",
      error: null,
    });
  });

  it("keeps the address screen when no code could be sent", async () => {
    const actions = auth({
      requestSignInCode: vi.fn(async () => Promise.reject(new Error("bad"))),
    });
    const { result } = renderHook(() => useCodeSignIn(actions), { wrapper });
    act(() => result.current.setEmail("ada@example.com"));
    await act(() => result.current.sendCode());
    expect(result.current.step).toBe("email");
    expect(result.current.error).toBe("We couldn't send a code. Check the address and try again.");
  });
});
