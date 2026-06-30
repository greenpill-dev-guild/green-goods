import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, userEvent, within } from "storybook/test";
import { Splash } from "./Splash";
import { LoadingSplash } from "../../views/Login/components/LoadingSplash";
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
  recoveryInfo:
    "Synced passkeys recover on supported providers. Local-only passkeys work on this device.",
  createSeparateButton: "Create separate account",
  backToRecovery: "Back to recovery",
  separateHint: "This creates a different address. Use recovery if you already made a passkey.",
  addressContinuity: "Creating a separate account gives you a different address.",
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

/**
 * Longest callout that co-occurs with the username field, across locales (the
 * Spanish local-passkey explainer, ~36% longer than English). The content
 * viewport must hold `username + this callout` WITHOUT pushing the primary button
 * down — the LayoutStability play test asserts the viewport doesn't overflow, so a
 * too-small reserve fails CI rather than silently clipping in es/pt.
 */
const LONGEST_CALLOUT =
  "Mantiene el acceso en el mismo dispositivo. Puede requerir reinscripción si se borra el almacenamiento del navegador.";

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

/** Returning user with a same-device passkey — one-tap sign in, no username field. */
const returningArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.signInButton,
  secondaryAction: { label: COPY.wallet, onSelect: () => {} },
  tertiaryAction: { label: COPY.recoverWithUsername, onClick: () => {} },
};

/**
 * Recovery as it renders in production: the username field AND the recovery
 * callout together. The bare `recoverArgs` omits the callout; this is the
 * production-faithful pair. (The LayoutStability test overrides the callout with
 * the longest LOCALIZED string to stress the content-viewport reserve.)
 */
const recoverWithCalloutArgs: SplashStoryArgs = {
  ...recoverArgs,
  infoCallout: COPY.recoveryInfo,
};

/** Separate-account creation after a failed recovery — username + continuity notice. */
const separateCreateArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.createSeparateButton,
  usernameInput: {
    value: "",
    onChange: () => {},
    label: COPY.newAccountLabel,
    placeholder: COPY.newAccountPlaceholder,
    hint: COPY.separateHint,
    minLength: 3,
  },
  secondaryAction: { label: COPY.backToRecovery, onSelect: () => {} },
  notice: COPY.addressContinuity,
};

/** First install — account creation is the default, not recovery. */
export const CreateAccountDefault: Story = {
  name: "Auth · Create account (first install)",
  args: createArgs,
};

/** Returning user with a same-device passkey — one-tap sign in, no username field. */
export const ReturningPasskey: Story = {
  name: "Auth · Returning (same device)",
  args: returningArgs,
};

/** Progressive recovery — sign in on a new device with the username + synced passkey. */
export const SignInWithUsername: Story = {
  name: "Auth · Recover with username",
  args: recoverWithCalloutArgs,
};

/** Separate-account creation after a failed recovery (username + continuity notice). */
export const SeparateAccountCreate: Story = {
  name: "Auth · Separate account (after recovery)",
  args: separateCreateArgs,
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
  { label: "Returning · same device", args: returningArgs },
  { label: "Recover with username", args: recoverWithCalloutArgs },
  { label: "Separate account", args: separateCreateArgs },
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
 * Layout-stability proof (CI-enforced via the storybook-ci tag). Renders the REAL
 * component in every state that must agree — create, returning, recover (with the
 * worst-case localized callout), the longest real error, a deliberately over-long
 * (~4-line) error, and the separate LoadingSplash spinner — each pinned to a real
 * 375px phone width. The play function asserts, with real (non-zero) browser
 * geometry:
 *
 *   1. the LOGO sits at the same Y in EVERY state, including the LoadingSplash swap
 *      (the header never jumps — the original trigger for this work);
 *   2. the PRIMARY BUTTON sits at the same Y across every Splash state — create has
 *      a username field, returning does not, yet the reserved content viewport keeps
 *      the button pinned (the create↔returning parity that forces the reserve);
 *   3. the content viewport HOLDS username + the longest localized callout without
 *      overflowing, so the reserve fits es/pt and not just en;
 *   4. the error slot stays a fixed-height clamp — the longest real error and a
 *      ~4-line overflow error both leave the tertiary in place, and the full error
 *      text stays in the accessibility tree.
 *
 * Offsets are measured relative to each panel's own top, so the panels' page
 * origins (and any wrapping) don't matter.
 */
export const LayoutStability: Story = {
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  render: () => (
    // Inline width — `w-[375px]` from a client story is not always generated by
    // the shared Storybook's Tailwind scan (known gotcha), which would collapse
    // the panel and skew the geometry. Inline style pins a real 375px phone width.
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="panel-create" style={{ width: 375 }}>
        <Splash {...createArgs} />
      </div>
      <div data-testid="panel-returning" style={{ width: 375 }}>
        <Splash {...returningArgs} />
      </div>
      <div data-testid="panel-recover" style={{ width: 375 }}>
        <Splash {...recoverWithCalloutArgs} infoCallout={LONGEST_CALLOUT} />
      </div>
      <div data-testid="panel-error" style={{ width: 375 }}>
        <Splash
          {...recoverWithCalloutArgs}
          infoCallout={LONGEST_CALLOUT}
          errorMessage={LONGEST_ERROR}
        />
      </div>
      <div data-testid="panel-overflow" style={{ width: 375 }}>
        <Splash
          {...recoverWithCalloutArgs}
          infoCallout={LONGEST_CALLOUT}
          errorMessage={OVERFLOW_ERROR}
        />
      </div>
      <div data-testid="panel-loading" style={{ width: 375 }}>
        <LoadingSplash loadingState="welcome" message={COPY.loadingAuth} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scope = (id: string) => within(canvas.getByTestId(id));
    const panelTop = (id: string) => canvas.getByTestId(id).getBoundingClientRect().top;
    const logoOffset = (id: string) =>
      scope(id).getByRole("img").getBoundingClientRect().top - panelTop(id);
    const primaryOffset = (id: string) =>
      scope(id).getByTestId("login-button").getBoundingClientRect().top - panelTop(id);

    // Every panel renders a logo (incl. the loading swap); every Splash panel also
    // renders the primary button (the loading panel shows a spinner instead).
    const allPanels = [
      "panel-create",
      "panel-returning",
      "panel-recover",
      "panel-error",
      "panel-overflow",
      "panel-loading",
    ];
    const splashPanels = allPanels.filter((id) => id !== "panel-loading");

    // 1) Real browser geometry — guards against a vacuous (all-zero) jsdom pass.
    const createLogo = scope("panel-create").getByRole("img").getBoundingClientRect();
    const createPrimary = scope("panel-create").getByTestId("login-button").getBoundingClientRect();
    await expect(createLogo.height).toBeGreaterThan(0);
    await expect(createPrimary.height).toBeGreaterThan(0);

    // 2) Logo Y is identical across EVERY state, including the LoadingSplash swap.
    const logoBase = logoOffset("panel-create");
    for (const id of allPanels) {
      await expect(Math.abs(logoOffset(id) - logoBase)).toBeLessThanOrEqual(1);
    }

    // 3) Primary button Y is identical across every Splash state — username field
    //    present (create/recover) or not (returning) — because the reserved content
    //    viewport keeps the same height regardless.
    const primaryBase = primaryOffset("panel-create");
    for (const id of splashPanels) {
      await expect(Math.abs(primaryOffset(id) - primaryBase)).toBeLessThanOrEqual(1);
    }

    // 4) The content viewport holds username + the longest localized callout WITHOUT
    //    overflowing — proves the reserve fits es/pt, not just en. If it overflowed,
    //    the callout would scroll/clip inside, signalling the reserve is too small.
    const viewport = scope("panel-recover").getByTestId("splash-content-viewport");
    await expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight + 1);

    // 5) Error slot is a fixed-height clamp: the tertiary (the wallet link, shared by
    //    the recover family) holds across the longest real error and a ~4-line
    //    overflow error, and the full error text stays in the accessibility tree.
    const tertiaryOffset = (id: string) =>
      scope(id).getByRole("button", { name: COPY.wallet }).getBoundingClientRect().top -
      panelTop(id);
    const tertiaryBase = tertiaryOffset("panel-recover");
    for (const id of ["panel-error", "panel-overflow"] as const) {
      await expect(Math.abs(tertiaryOffset(id) - tertiaryBase)).toBeLessThanOrEqual(1);
    }
    await expect(scope("panel-error").getByRole("alert")).toHaveTextContent(LONGEST_ERROR);
    await expect(scope("panel-overflow").getByRole("alert")).toHaveTextContent(OVERFLOW_ERROR);
  },
};
