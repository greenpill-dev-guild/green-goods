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
    buttonTitle: {
      control: "text",
      description:
        "Full untruncated primary label (hover/tooltip) when the pill truncates a long username",
    },
    loadingState: {
      control: "select",
      options: [undefined, "welcome", "joining-garden", "default"],
      description:
        "In-flight state: shows a spinner inside the primary button and swaps the title to the loading message",
    },
    message: {
      control: "text",
      description: "Custom message to display. Overrides the default state message.",
    },
    errorMessage: {
      control: "text",
      description: "Error shown in the shared message zone. Always wins over infoMessage.",
    },
    infoMessage: {
      control: "text",
      description:
        "Info/helper copy for the shared message zone (input hints, explainers, warnings)",
    },
    usernameInput: {
      control: "object",
      description:
        "Form-screen input. When set, slot 1 holds the input and the primary moves to slot 2. Label is screen-reader-only; the visible instruction is the infoMessage.",
    },
    secondaryAction: {
      control: "object",
      description:
        "Entry-screen secondary (slot 2), e.g. wallet fallback. Ignored on form screens.",
    },
    tertiaryAction: {
      control: "object",
      description: "Tertiary text link — 'Recover with username' on entry, 'Back' on forms",
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
    },
    infoMessage: "This username identifies your passkey on our server",
    tertiaryAction: { label: "Back", onClick: () => {} },
  },
};

export const Loading: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    loadingState: "default",
  },
};

export const WelcomeState: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
    loadingState: "welcome",
    message: "Welcome back, gardener!",
  },
};

export const JoiningGarden: Story = {
  args: {
    login: () => {},
    buttonLabel: "Login with Passkey",
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
    tertiaryAction: { label: "Back", onClick: () => {} },
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
          <Splash login={() => {}} buttonLabel="Login with Passkey" loadingState="default" />
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
// the trimmed production copy from `@green-goods/shared` i18n `app.login.*`.
//
// Slot model recap: two control slots on one scaffold. ENTRY screens put the
// primary in slot 1 and the wallet secondary in slot 2; FORM screens (create /
// recover) put the input in slot 1 and the primary in slot 2. The message zone
// shows error XOR info; the tertiary is "Recover with username" on entry and
// "Back" on forms. Recovery is flat — no separate-account fork.
// ─────────────────────────────────────────────────────────────────────────────

type SplashStoryArgs = NonNullable<Story["args"]>;

/** Mirrors the trimmed English strings in packages/shared/src/i18n/en.json. */
const COPY = {
  createButton: "Create account",
  signInButton: "Sign in with passkey",
  continueAs: "Continue as gardener.eth",
  recoverButton: "Recover with passkey",
  wallet: "Sign in with a wallet",
  recoverWithUsername: "Recover with username",
  newAccountLabel: "Display name for new account",
  newAccountPlaceholder: "e.g. alice or alice.eth",
  back: "Back",
  usernameHint: "Use this name later with a synced passkey on another device.",
  recoveryLabel: "Username or ENS handle",
  recoveryPlaceholder: "Enter your username or ENS handle",
  recoveryInfo:
    "Synced passkeys recover on supported providers. Local-only passkeys work on this device.",
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
 * run ~36% longer than English, so the worst-case wrap — and thus the message-zone
 * stress test — is the Spanish `app.login.error.network`, not the English one.
 */
const LONGEST_ERROR = "La recuperación con passkey no está disponible temporalmente.";

/**
 * Deliberately over-long error (the pre-trim noPasskey copy, ~150 chars → ~4
 * lines, well over the 80px zone) to prove the fixed-height + overflow clamp on
 * the message zone keeps the tertiary stable for ANY copy length, not just the
 * short strings we ship. If the clamp is ever removed, this overflows the zone
 * and the play assertion fails.
 */
const OVERFLOW_ERROR =
  "We couldn't find a passkey for that username. Retry, use a same-device fallback if you have one, or go back and create a fresh account.";

/**
 * Longest info string that can occupy the message zone, across locales (the
 * Spanish local-passkey explainer, ~36% longer than English). The zone must hold
 * it WITHOUT overflowing — the LayoutStability play test asserts no overflow, so a
 * too-small zone fails CI rather than silently clipping in es/pt.
 */
const LONGEST_INFO =
  "Mantiene el acceso en el mismo dispositivo. Puede requerir reinscripción si se borra el almacenamiento del navegador.";

/** Entry, first install: Create account (slot 1) · wallet (slot 2) · Recover link. */
const entryNewArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.createButton,
  secondaryAction: { label: COPY.wallet, onSelect: () => {} },
  tertiaryAction: { label: COPY.recoverWithUsername, onClick: () => {} },
};

/** Entry, returning: personalized one-tap (slot 1) · wallet (slot 2) · Recover link. */
const entryReturningArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.continueAs,
  buttonTitle: COPY.continueAs,
  secondaryAction: { label: COPY.wallet, onSelect: () => {} },
  tertiaryAction: { label: COPY.recoverWithUsername, onClick: () => {} },
};

/** Create form: input (slot 1) · Create account (slot 2) · Back link. */
const createFormArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.createButton,
  usernameInput: {
    value: "",
    onChange: () => {},
    label: COPY.newAccountLabel,
    placeholder: COPY.newAccountPlaceholder,
    minLength: 3,
  },
  infoMessage: COPY.usernameHint,
  tertiaryAction: { label: COPY.back, onClick: () => {} },
};

/** Recover form: input (slot 1) · Recover with passkey (slot 2) · Back link. */
const recoverFormArgs: SplashStoryArgs = {
  login: () => {},
  buttonLabel: COPY.recoverButton,
  usernameInput: {
    value: "gardener.eth",
    onChange: () => {},
    label: COPY.recoveryLabel,
    placeholder: COPY.recoveryPlaceholder,
  },
  infoMessage: COPY.recoveryInfo,
  tertiaryAction: { label: COPY.back, onClick: () => {} },
};

/** First install — entry screen; Create account navigates to the create form. */
export const EntryFirstInstall: Story = {
  name: "Auth · Entry (first install)",
  args: entryNewArgs,
};

/** Returning user — personalized one-tap sign in on the entry screen. */
export const EntryReturning: Story = {
  name: "Auth · Entry (returning)",
  args: entryReturningArgs,
};

/** Create form — reached from the entry screen's Create account. */
export const CreateAccountForm: Story = {
  name: "Auth · Create account form",
  args: createFormArgs,
};

/** Recover form — flat flow: recover, or Back to entry. */
export const RecoverForm: Story = {
  name: "Auth · Recover with username",
  args: recoverFormArgs,
};

export const UsernameNotFound: Story = {
  name: "Auth · Error · username not found",
  args: { ...recoverFormArgs, errorMessage: COPY.err.noPasskey },
};

export const ServerUnavailable: Story = {
  name: "Auth · Error · passkey server unavailable",
  args: { ...recoverFormArgs, errorMessage: COPY.err.network },
};

export const UsernameTaken: Story = {
  name: "Auth · Error · name already taken",
  args: { ...createFormArgs, errorMessage: COPY.err.recoveryNameTaken },
};

export const PasskeyCancelled: Story = {
  name: "Auth · Error · passkey prompt cancelled",
  args: { ...entryReturningArgs, errorMessage: COPY.err.cancelled },
};

/** In-flight auth attempt — spinner INSIDE the primary, title carries the message. */
export const LoadingPending: Story = {
  name: "Auth · Loading",
  args: {
    login: () => {},
    buttonLabel: COPY.signInButton,
    loadingState: "default",
    message: COPY.loadingAuth,
  },
};

/** Wallet fallback — slot 2 secondary on the entry screens. */
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
  { label: "Entry · first install", args: entryNewArgs },
  { label: "Entry · returning", args: entryReturningArgs },
  { label: "Create account form", args: createFormArgs },
  { label: "Recover with username", args: recoverFormArgs },
  { label: "Error · not found", args: { ...recoverFormArgs, errorMessage: COPY.err.noPasskey } },
  {
    label: "Error · server unavailable",
    args: { ...recoverFormArgs, errorMessage: COPY.err.network },
  },
  {
    label: "Error · name taken",
    args: { ...createFormArgs, errorMessage: COPY.err.recoveryNameTaken },
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
        Two-step create (entry → form), personalized one-tap for returning users, flat recovery
        (recover or go Back — no separate-account fork), wallet on the entry screens. Errors and
        helper copy share one reserved (fixed-height) message zone per screen.
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
 * component in every screen shape that must agree — both entry variants, the
 * create form, the recover form (with the worst-case localized info), the
 * longest real error, a deliberately over-long (~4-line) error, an in-flight
 * form attempt (spinner INSIDE the primary), and the boot LoadingSplash — each
 * pinned to a real 375px phone width. The play function asserts, with real
 * (non-zero) browser geometry:
 *
 *   1. the LOGO sits at the same Y in EVERY state, including the boot swap;
 *   2. BOTH SLOT ZONES sit at the same Y in every state — the skeleton never
 *      moves; the primary lives in slot 1 on entry screens and slot 2 on form
 *      screens, pinned within each cluster, and the entry→form move is EXACTLY
 *      one slot (the slot-zone delta);
 *   3. the USERNAME INPUT (slot 1 on form screens) sits at the same Y wherever
 *      it renders, including mid-attempt;
 *   4. the shared MESSAGE ZONE holds the longest localized info string and the
 *      longest real error without overflowing (es/pt-proof), the error always
 *      wins the zone over info, and over-long copy scrolls INSIDE while the
 *      Back tertiary stays pinned;
 *   5. the full error text stays in the accessibility tree.
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
      <div data-testid="panel-entry-new" style={{ width: 375 }}>
        <Splash {...entryNewArgs} />
      </div>
      <div data-testid="panel-entry-returning" style={{ width: 375 }}>
        <Splash {...entryReturningArgs} />
      </div>
      <div data-testid="panel-create" style={{ width: 375 }}>
        <Splash {...createFormArgs} />
      </div>
      <div data-testid="panel-recover" style={{ width: 375 }}>
        <Splash {...recoverFormArgs} infoMessage={LONGEST_INFO} />
      </div>
      <div data-testid="panel-error" style={{ width: 375 }}>
        <Splash {...recoverFormArgs} infoMessage={LONGEST_INFO} errorMessage={LONGEST_ERROR} />
      </div>
      <div data-testid="panel-overflow" style={{ width: 375 }}>
        <Splash {...recoverFormArgs} infoMessage={LONGEST_INFO} errorMessage={OVERFLOW_ERROR} />
      </div>
      <div data-testid="panel-loading" style={{ width: 375 }}>
        <Splash
          {...recoverFormArgs}
          infoMessage={LONGEST_INFO}
          loadingState="welcome"
          message={COPY.loadingAuth}
        />
      </div>
      <div data-testid="panel-boot" style={{ width: 375 }}>
        <LoadingSplash loadingState="welcome" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scope = (id: string) => within(canvas.getByTestId(id));
    const panelTop = (id: string) => canvas.getByTestId(id).getBoundingClientRect().top;
    const logoOffset = (id: string) =>
      scope(id).getByRole("img").getBoundingClientRect().top - panelTop(id);
    const slotOneOffset = (id: string) =>
      scope(id).getByTestId("splash-slot-one").getBoundingClientRect().top - panelTop(id);
    const slotTwoOffset = (id: string) =>
      scope(id).getByTestId("splash-slot-two").getBoundingClientRect().top - panelTop(id);
    const primaryOffset = (id: string) =>
      scope(id).getByTestId("login-button").getBoundingClientRect().top - panelTop(id);
    const inputOffset = (id: string) =>
      scope(id).getByTestId("username-input").getBoundingClientRect().top - panelTop(id);

    const allPanels = [
      "panel-entry-new",
      "panel-entry-returning",
      "panel-create",
      "panel-recover",
      "panel-error",
      "panel-overflow",
      "panel-loading",
      "panel-boot",
    ];
    const entryPanels = ["panel-entry-new", "panel-entry-returning"];
    const formPanels = [
      "panel-create",
      "panel-recover",
      "panel-error",
      "panel-overflow",
      "panel-loading",
    ];

    // 1) Real browser geometry — guards against a vacuous (all-zero) jsdom pass.
    const entryLogo = scope("panel-entry-new").getByRole("img").getBoundingClientRect();
    const entryPrimary = scope("panel-entry-new")
      .getByTestId("login-button")
      .getBoundingClientRect();
    await expect(entryLogo.height).toBeGreaterThan(0);
    await expect(entryPrimary.height).toBeGreaterThan(0);

    // 2) Logo Y is identical across EVERY state, including the boot swap.
    const logoBase = logoOffset("panel-entry-new");
    for (const id of allPanels) {
      await expect(Math.abs(logoOffset(id) - logoBase)).toBeLessThanOrEqual(1);
    }

    // 3) Both slot ZONES are identical across every state — the skeleton never
    //    moves, whatever occupies it.
    const slotOneBase = slotOneOffset("panel-entry-new");
    const slotTwoBase = slotTwoOffset("panel-entry-new");
    for (const id of allPanels) {
      await expect(Math.abs(slotOneOffset(id) - slotOneBase)).toBeLessThanOrEqual(1);
      await expect(Math.abs(slotTwoOffset(id) - slotTwoBase)).toBeLessThanOrEqual(1);
    }

    // 4) Primary pin per cluster: slot 1 on entry screens, slot 2 on form
    //    screens (including mid-attempt, where the spinner lives INSIDE the
    //    button), and the entry→form move is exactly the slot delta.
    const entryPrimaryBase = primaryOffset("panel-entry-new");
    for (const id of entryPanels) {
      await expect(Math.abs(primaryOffset(id) - entryPrimaryBase)).toBeLessThanOrEqual(1);
    }
    const formPrimaryBase = primaryOffset("panel-create");
    for (const id of formPanels) {
      await expect(Math.abs(primaryOffset(id) - formPrimaryBase)).toBeLessThanOrEqual(1);
    }
    const slotDelta = slotTwoBase - slotOneBase;
    await expect(Math.abs(formPrimaryBase - entryPrimaryBase - slotDelta)).toBeLessThanOrEqual(2);

    // 5) Slot 1 on form screens: the username input sits at the same Y wherever
    //    it renders, including mid-attempt.
    const inputBase = inputOffset("panel-create");
    for (const id of formPanels) {
      await expect(Math.abs(inputOffset(id) - inputBase)).toBeLessThanOrEqual(1);
    }

    // 6) The message zone holds the longest localized INFO and the longest real
    //    ERROR without overflowing — proves the zone fits es/pt, not just en.
    const infoZone = scope("panel-recover").getByTestId("splash-message-zone");
    await expect(infoZone.scrollHeight).toBeLessThanOrEqual(infoZone.clientHeight + 1);
    const errorZone = scope("panel-error").getByTestId("splash-message-zone");
    await expect(errorZone.scrollHeight).toBeLessThanOrEqual(errorZone.clientHeight + 1);

    // 7) Error wins the zone: when an error shows, the info node is not rendered.
    await expect(scope("panel-error").queryByTestId("info-message")).toBeNull();
    await expect(scope("panel-recover").queryByTestId("info-message")).not.toBeNull();

    // 8) The zone is a fixed-height clamp: the Back tertiary (shared by the
    //    form family) holds across the longest real error and a ~4-line
    //    overflow error, and the full error text stays in the accessibility tree.
    const tertiaryOffset = (id: string) =>
      scope(id).getByRole("button", { name: COPY.back }).getBoundingClientRect().top - panelTop(id);
    const tertiaryBase = tertiaryOffset("panel-recover");
    for (const id of ["panel-error", "panel-overflow"] as const) {
      await expect(Math.abs(tertiaryOffset(id) - tertiaryBase)).toBeLessThanOrEqual(1);
    }
    await expect(scope("panel-error").getByRole("alert")).toHaveTextContent(LONGEST_ERROR);
    await expect(scope("panel-overflow").getByRole("alert")).toHaveTextContent(OVERFLOW_ERROR);
  },
};
