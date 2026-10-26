/**
 * Splash — a translated page moving between sign-in screens (PRD-1308).
 *
 * Chrome's page translation swaps every text node it translates for a pair of
 * <font> elements. React still holds its own text node, so removing that node
 * later throws "Failed to execute 'removeChild' on 'Node'". In production this
 * sent a translated session to the route error screen on every Create Account
 * tap: the slot-two button turns from the wallet action into the primary, and
 * React removed the wallet label's text node.
 */
// TEST-QUALITY: allow-small-test-file - one table for translated screen changes; Login.test.tsx mocks Splash, so it cannot render the real slots

import { cleanup, render, screen, within } from "@testing-library/react";
import { Component, type ComponentProps, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Splash } from "@/components/Layout/Splash";

type SplashProps = ComponentProps<typeof Splash>;

class RecordRenderError extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Replaces each text node the way Chrome's page translation does. */
function translatePage(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) {
      translatePage(child);
      continue;
    }
    if (!child.textContent?.trim()) continue;
    const outer = document.createElement("font");
    const inner = document.createElement("font");
    inner.textContent = child.textContent;
    outer.append(inner);
    child.replaceWith(outer);
  }
}

const entryFirstInstall: SplashProps = {
  login: vi.fn(),
  buttonLabel: "Create Account",
  secondaryAction: { label: "Sign in with a Wallet", onSelect: vi.fn() },
  tertiaryAction: { label: "Already have an account?", onClick: vi.fn() },
};

const entryReturning: SplashProps = {
  ...entryFirstInstall,
  buttonLabel: "Sign in with Passkey",
  tertiaryAction: { label: "Recover with Username", onClick: vi.fn() },
};

const passkeyInFlight: SplashProps = {
  ...entryReturning,
  isLoggingIn: true,
  loadingState: "default",
};

const form = (buttonLabel: string): SplashProps => ({
  login: vi.fn(),
  buttonLabel,
  isLoginDisabled: true,
  usernameInput: { value: "", onChange: vi.fn(), onCancel: vi.fn() },
  tertiaryAction: { label: "Back", onClick: vi.fn() },
});

describe("Splash on a translated page", () => {
  afterEach(cleanup);

  it.each([
    {
      change: "Create Account opens the form",
      from: entryFirstInstall,
      to: form("Create Account"),
      slotTwo: "Create Account",
    },
    {
      change: "Recover with Username opens the form",
      from: entryReturning,
      to: form("Sign in with Passkey"),
      slotTwo: "Sign in with Passkey",
    },
    {
      change: "a passkey sign-in starts",
      from: entryReturning,
      to: passkeyInFlight,
      slotTwo: "Sign in with a Wallet",
    },
  ])("keeps the screen when $change", ({ from, to, slotTwo }) => {
    const errors: Error[] = [];
    const renderSplash = (props: SplashProps) => (
      <IntlProvider locale="en">
        <RecordRenderError onError={(error) => errors.push(error)}>
          <Splash {...props} />
        </RecordRenderError>
      </IntlProvider>
    );

    const { container, rerender } = render(renderSplash(from));
    translatePage(container);
    rerender(renderSplash(to));

    expect(errors).toEqual([]);
    expect(screen.getByTestId("splash-slot-two").textContent).toBe(slotTwo);
    if (to.usernameInput) {
      expect(
        within(screen.getByTestId("splash-slot-one")).getByTestId("username-input")
      ).toBeInTheDocument();
    }
  });
});
