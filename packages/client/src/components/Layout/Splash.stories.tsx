import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, userEvent, within } from "storybook/test";
import { Splash } from "./Splash";
// Canonical flow source (renders as a Mermaid diagram on GitHub). `?raw` is
// typed via vite/client (packages/client/src/vite-env.d.ts) and inlined by Vite.
import loginFlowDiagram from "../../views/Login/login-flow.mmd?raw";

/**
 * Splash uses react-router's Link for tertiary actions.
 * We wrap with MemoryRouter in the decorator.
 */
const meta: Meta<typeof Splash> = {
  title: "Client/Layout/Splash",
  component: Splash,
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  argTypes: {
    login: {
      description: "Login callback. When undefined, no primary button is rendered.",
    },
    isLoggingIn: {
      control: "boolean",
      description: "Disables buttons while a login attempt is in progress",
    },
    isLoginDisabled: {
      control: "boolean",
      description: "Disables the login button (e.g., form validation not met)",
    },
    buttonLabel: {
      control: "text",
      description: "Label for the primary login button. Defaults to 'Login'.",
    },
    loadingState: {
      control: "select",
      options: [undefined, "welcome", "joining-garden", "default"],
      description: "Loading state that shows a spinner instead of the login button",
    },
    message: {
      control: "text",
      description: "Custom message to display. Overrides the default state message.",
    },
    errorMessage: {
      control: "text",
      description: "Error message shown in an alert banner below the action area",
    },
    usernameInput: {
      control: "object",
      description: "Configuration for the username input field (shown when no loadingState)",
    },
    secondaryAction: {
      control: "object",
      description: "Secondary (stroke) action, e.g. wallet fallback or 'Create account'",
    },
    tertiaryAction: {
      control: "object",
      description: "Tertiary text link, e.g. progressive 'Recover with username'",
    },
    infoCallout: {
      control: "text",
      description: "Short explainer shown in the reserved callout above the actions",
    },
    notice: {
      control: "text",
      description: "Small muted note below the reserved error area",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Splash>;

export const Default: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    secondaryAction: {
      label: "Login with Wallet",
      onSelect: () => {},
    },
  },
};

export const WithUsernameInput: Story = {
  args: {
    login: () => {},
    buttonLabel: "Create Account",
    usernameInput: {
      value: "gardener42",
      onChange: () => {},
      placeholder: "Choose a username",
      hint: "This username identifies your passkey on our server",
    },
    secondaryAction: {
      label: "I already have an account",
      onSelect: () => {},
    },
  },
};

export const Loading: Story = {
  args: {
    loadingState: "default",
  },
};

export const WelcomeState: Story = {
  args: {
    loadingState: "welcome",
    message: "Welcome back, gardener!",
  },
};

export const JoiningGarden: Story = {
  args: {
    loadingState: "joining-garden",
    message: "Joining Riverside Commons...",
  },
};

export const WithError: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    errorMessage: "Passkey authentication failed. Please try again or use a different method.",
    secondaryAction: {
      label: "Login with Wallet",
      onSelect: () => {},
    },
  },
};

export const WithTertiaryLink: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    secondaryAction: {
      label: "Login with Wallet",
      onSelect: () => {},
    },
    tertiaryAction: {
      label: "Learn more about Green Goods",
      href: "/about",
    },
  },
};

export const LoginDisabled: Story = {
  args: {
    login: () => {},
    buttonLabel: "Create Account",
    isLoginDisabled: true,
    usernameInput: {
      value: "",
      onChange: () => {},
      placeholder: "Choose a username",
    },
  },
};

export const DarkMode: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    secondaryAction: {
      label: "Login with Wallet",
      onSelect: () => {},
    },
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div className="w-[375px] border border-stroke-soft-200 rounded-lg overflow-hidden">
        <p className="text-xs text-text-sub-600 p-2 bg-bg-weak-50">Login (default)</p>
        <MemoryRouter>
          <Splash
            login={() => {}}
            buttonLabel="Login with Passkey"
            secondaryAction={{ label: "Login with Wallet", onSelect: () => {} }}
          />
        </MemoryRouter>
      </div>

      <div className="w-[375px] border border-stroke-soft-200 rounded-lg overflow-hidden">
        <p className="text-xs text-text-sub-600 p-2 bg-bg-weak-50">Loading state</p>
        <MemoryRouter>
          <Splash loadingState="default" />
        </MemoryRouter>
      </div>

      <div className="w-[375px] border border-stroke-soft-200 rounded-lg overflow-hidden">
        <p className="text-xs text-text-sub-600 p-2 bg-bg-weak-50">Error state</p>
        <MemoryRouter>
          <Splash
            login={() => {}}
            buttonLabel="Retry"
            errorMessage="Authentication failed."
            secondaryAction={{ label: "Try another method", onSelect: () => {} }}
          />
        </MemoryRouter>
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    secondaryAction: {
      label: "Login with Wallet",
      onSelect: () => {},
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify login button is present and clickable
    const loginButton = canvas.getByTestId("login-button");
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();

    // Verify secondary action button
    const secondaryButton = canvas.getByTestId("secondary-action-button");
    await expect(secondaryButton).toBeVisible();

    // Click the login button
    await userEvent.click(loginButton);
  },
};

export const Mobile: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    secondaryAction: {
      label: "Login with Wallet",
      onSelect: () => {},
    },
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH STATES
//
// Every story below composes the REAL Splash component (no synthetic panel) with
// the trimmed production copy from `@green-goods/shared` i18n `app.login.*`. Each
// state the passkey login must handle maps to a distinct Splash prop set, so a
// reviewer can sign off the full matrix without running the wallet/auth stack.
// ─────────────────────────────────────────────────────────────────────────────

type SplashStoryArgs = NonNullable<Story["args"]>;

/** Mirrors the trimmed English strings in packages/shared/src/i18n/en.json. */
const COPY = {
  createButton: "Create account",
  signInButton: "Sign in with passkey",
  recoverButton: "Recover with passkey",
  wallet: "Sign in with a wallet",
  recoverWithUsername: "Recover with username",
  createAccountSecondary: "Create account",
  newAccountLabel: "Display name for new account",
  newAccountPlaceholder: "e.g. alice or alice.eth",
  back: "Back",
  usernameHint: "Use this name later with a synced passkey on another device.",
  recoveryLabel: "Username or ENS handle",
  recoveryPlaceholder: "Enter your username or ENS handle",
  recoveryHint: "Use the same name you chose when setting up your passkey.",
  passkeyExplainer:
    "Passwordless sign-in. Use your username to find this passkey on another device.",
  loadingAuth: "Signing you in...",
  err: {
    noPasskey: "No passkey found for that username.",
    network: "Passkey recovery is temporarily unavailable.",
    recoveryNameTaken: "That name is already registered.",
    cancelled: "Sign in was cancelled.",
  },
} as const;

/**
 * Longest production error across ALL locales after the trim. The es/pt strings
 * run ~36% longer than English, so the worst-case wrap — and thus the reserve
 * stress test — is the Spanish `app.login.error.network`, not the English one.
 */
const LONGEST_ERROR = "La recuperación con passkey no está disponible temporalmente.";

/**
 * Deliberately over-long error (the pre-trim noPasskey copy, ~150 chars → ~4
 * lines, well over the 80px slot) to prove the fixed-height + overflow clamp on
 * the error region keeps the tertiary stable for ANY copy length, not just the
 * short strings we ship. If the clamp is ever removed, this overflows the slot
 * and the play assertion fails.
 */
const OVERFLOW_ERROR =
  "We couldn't find a passkey for that username. Retry, use a same-device fallback if you have one, or confirm before creating a separate account.";

const createArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.createButton,
  usernameInput: {
    value: "",
    onChange: () => {},
    label: COPY.newAccountLabel,
    placeholder: COPY.newAccountPlaceholder,
    hint: COPY.usernameHint,
    minLength: 3,
  },
  secondaryAction: { label: COPY.wallet, onSelect: () => {} },
  tertiaryAction: { label: COPY.recoverWithUsername, onClick: () => {} },
  // No info callout: the cross-device hint above the input already says this,
  // and the real server-mode create panel drops the redundant explainer.
};

const recoverArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.recoverButton,
  usernameInput: {
    value: "gardener.eth",
    onChange: () => {},
    label: COPY.recoveryLabel,
    placeholder: COPY.recoveryPlaceholder,
    hint: COPY.recoveryHint,
  },
  // Full-recovery focus: a clean "Back" exit, not a "Create account" nudge.
  secondaryAction: { label: COPY.back, onSelect: () => {} },
  tertiaryAction: { label: COPY.wallet, onClick: () => {} },
};

/** First install — account creation is the default, not recovery. */
export const CreateAccountDefault: Story = {
  name: "Auth · Create account (first install)",
  args: createArgs,
};

/** Returning user with a same-device passkey — one-tap sign in, no username field. */
export const ReturningPasskey: Story = {
  name: "Auth · Returning (same device)",
  args: {
    login: () => {},
    buttonLabel: COPY.signInButton,
    secondaryAction: { label: COPY.wallet, onSelect: () => {} },
    tertiaryAction: { label: COPY.recoverWithUsername, onClick: () => {} },
  },
};

/** Progressive recovery — sign in on a new device with the username + synced passkey. */
export const SignInWithUsername: Story = {
  name: "Auth · Recover with username",
  args: recoverArgs,
};

export const UsernameNotFound: Story = {
  name: "Auth · Error · username not found",
  args: { ...recoverArgs, errorMessage: COPY.err.noPasskey },
};

export const ServerUnavailable: Story = {
  name: "Auth · Error · passkey server unavailable",
  args: { ...recoverArgs, errorMessage: COPY.err.network },
};

export const UsernameTaken: Story = {
  name: "Auth · Error · name already taken",
  args: { ...createArgs, errorMessage: COPY.err.recoveryNameTaken },
};

export const PasskeyCancelled: Story = {
  name: "Auth · Error · passkey prompt cancelled",
  args: {
    login: () => {},
    buttonLabel: COPY.signInButton,
    secondaryAction: { label: COPY.wallet, onSelect: () => {} },
    tertiaryAction: { label: COPY.recoverWithUsername, onClick: () => {} },
    errorMessage: COPY.err.cancelled,
  },
};

export const LoadingPending: Story = {
  name: "Auth · Loading",
  args: { loadingState: "default", message: COPY.loadingAuth },
};

/** Wallet fallback — secondary action when passkeys are unavailable or declined. */
export const WalletFallback: Story = {
  name: "Auth · Wallet fallback",
  args: {
    login: () => {},
    buttonLabel: COPY.signInButton,
    secondaryAction: { label: COPY.wallet, onSelect: () => {} },
  },
};

/** Single-glance catalog of every auth state on the real component. */
const CATALOG: ReadonlyArray<{ label: string; args: SplashStoryArgs }> = [
  { label: "Create account (default)", args: createArgs },
  { label: "Returning · same device", args: ReturningPasskey.args as SplashStoryArgs },
  { label: "Recover with username", args: recoverArgs },
  { label: "Error · not found", args: { ...recoverArgs, errorMessage: COPY.err.noPasskey } },
  { label: "Error · server unavailable", args: { ...recoverArgs, errorMessage: COPY.err.network } },
  {
    label: "Error · name taken",
    args: { ...createArgs, errorMessage: COPY.err.recoveryNameTaken },
  },
  { label: "Error · cancelled", args: PasskeyCancelled.args as SplashStoryArgs },
  { label: "Loading", args: LoadingPending.args as SplashStoryArgs },
  { label: "Wallet fallback", args: WalletFallback.args as SplashStoryArgs },
];

export const StateCatalog: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {CATALOG.map(({ label, args }) => (
        <div key={label} className="overflow-hidden rounded-lg border border-stroke-soft-200">
          <p className="bg-bg-weak-50 p-2 text-xs font-medium text-text-sub-600">{label}</p>
          <Splash {...args} />
        </div>
      ))}
    </div>
  ),
};

/**
 * Mermaid source for the implemented passkey flow. The .mmd file is the canonical
 * artifact (renders as a diagram on GitHub); shown here as source since the repo
 * has no client-side Mermaid renderer.
 */
export const FlowDiagram: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="mx-auto max-w-4xl p-4">
      <h2 className="text-lg font-semibold text-text-strong-950">Passkey login flow</h2>
      <p className="mt-1 mb-4 text-sm text-text-sub-600">
        Create-account-first for new installs, same-device one-tap for returning users, progressive
        recovery, wallet fallback. Errors stay in each panel&apos;s reserved (fixed-height) slot.
      </p>
      <pre
        data-testid="login-flow-mermaid"
        className="overflow-auto whitespace-pre rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-4 text-xs leading-5 text-text-strong-950"
      >
        {loginFlowDiagram}
      </pre>
    </div>
  ),
};

/**
 * Layout-stability proof (CI-enforced via the storybook-ci tag). Three real Splash
 * panels — identical except for the error: none, the longest real cross-locale
 * error, and a deliberately over-long error (~4 lines). The play function asserts
 * real (non-zero) geometry, then that the logo, primary, secondary, AND tertiary
 * positions are invariant across all three: neither a normal error nor an
 * overflowing one moves anything, because the error slot is a fixed-height clamped
 * region. Offsets are measured relative to each panel's own logo, so the panels'
 * page origins (and any wrapping) don't matter.
 */
export const LayoutStability: Story = {
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  render: () => (
    // Inline width — `w-[375px]` from a client story is not always generated by
    // the shared Storybook's Tailwind scan (known gotcha), which would collapse
    // the panel and skew the geometry. Inline style pins a real 375px phone width.
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="panel-clean" style={{ width: 375 }}>
        <Splash {...recoverArgs} />
      </div>
      <div data-testid="panel-error" style={{ width: 375 }}>
        <Splash {...recoverArgs} errorMessage={LONGEST_ERROR} />
      </div>
      <div data-testid="panel-overflow" style={{ width: 375 }}>
        <Splash {...recoverArgs} errorMessage={OVERFLOW_ERROR} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const measure = (testId: string) => {
      const scope = within(canvas.getByTestId(testId));
      const logo = scope.getByRole("img").getBoundingClientRect();
      const primary = scope.getByTestId("login-button").getBoundingClientRect();
      const secondary = scope.getByTestId("secondary-action-button").getBoundingClientRect();
      const tertiary = scope.getByRole("button", { name: COPY.wallet }).getBoundingClientRect();
      return { logo, primary, secondary, tertiary };
    };

    const clean = measure("panel-clean");
    const errored = measure("panel-error");
    const overflow = measure("panel-overflow");

    // 1) Real browser geometry — guards against a vacuous (all-zero) jsdom pass.
    await expect(clean.primary.width).toBeGreaterThan(0);
    await expect(clean.primary.height).toBeGreaterThan(0);
    await expect(overflow.tertiary.height).toBeGreaterThan(0);

    // 2) Both error panels render their FULL error text (the overflow one is
    //    clamped visually but the text stays in the accessibility tree).
    await expect(within(canvas.getByTestId("panel-error")).getByRole("alert")).toHaveTextContent(
      LONGEST_ERROR
    );
    await expect(within(canvas.getByTestId("panel-overflow")).getByRole("alert")).toHaveTextContent(
      OVERFLOW_ERROR
    );

    // 3) Logo→control vertical offsets are identical across ALL three panels — no
    //    error, the longest real error, and a ~4-line overflow error all leave the
    //    header, primary, secondary, AND tertiary in the same place. The tertiary
    //    holds even for the overflow case because the error slot is a fixed-height
    //    clamped region (the long error scrolls inside it). Remove the clamp and
    //    the overflow panel's tertiary drops, failing this assertion.
    const offset = (m: ReturnType<typeof measure>, key: "primary" | "secondary" | "tertiary") =>
      m[key].top - m.logo.top;

    for (const key of ["primary", "secondary", "tertiary"] as const) {
      const base = offset(clean, key);
      await expect(Math.abs(offset(errored, key) - base)).toBeLessThanOrEqual(1);
      await expect(Math.abs(offset(overflow, key) - base)).toBeLessThanOrEqual(1);
    }
  },
};
