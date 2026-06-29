import {
  RiArrowRightLine,
  RiErrorWarningLine,
  RiFingerprintLine,
  RiKey2Line,
  RiLoader4Line,
  RiShieldCheckLine,
  RiUserAddLine,
  RiWallet3Line,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useId, type ComponentType, type ReactNode } from "react";
import { expect, within } from "storybook/test";
import { withClientAppRuntime, withInstalledPwa } from "../../../shared/.storybook/decorators";
import { Button } from "../components/Actions";
import loginFlowDiagram from "./Login/login-flow.mmd?raw";

type LoginFlowScenario =
  | "create"
  | "createTaken"
  | "localSignIn"
  | "usernameSignIn"
  | "usernameNotFound"
  | "serverUnavailable"
  | "loading"
  | "newAccountConfirmation";

type StatusTone = "neutral" | "success" | "warning" | "error" | "pending";

type LoginScenarioConfig = {
  title: string;
  subtitle: string;
  activeMode: "create" | "signin";
  icon: ComponentType<{ className?: string }>;
  form:
    | {
        kind: "username";
        label: string;
        value: string;
        placeholder: string;
        help: string;
      }
    | {
        kind: "passkey";
        title: string;
        body: string;
      }
    | {
        kind: "confirmation";
        title: string;
        body: string;
      };
  status: {
    tone: StatusTone;
    title: string;
    body: string;
  };
  primaryLabel: string;
  secondaryLabel: string;
  footerLabel: string;
  loading?: boolean;
};

const scenarios: Record<LoginFlowScenario, LoginScenarioConfig> = {
  create: {
    title: "Create your Green Goods account",
    subtitle: "Choose a username, then save a passkey on this device.",
    activeMode: "create",
    icon: RiUserAddLine,
    form: {
      kind: "username",
      label: "Username",
      value: "",
      placeholder: "alex",
      help: "You can use this username to sign in on another device.",
    },
    status: {
      tone: "neutral",
      title: "Ready to save a passkey",
      body: "Your device will ask before the passkey is created.",
    },
    primaryLabel: "Create account",
    secondaryLabel: "I already have an account",
    footerLabel: "Use wallet instead",
  },
  createTaken: {
    title: "Create your Green Goods account",
    subtitle: "Choose a username, then save a passkey on this device.",
    activeMode: "create",
    icon: RiUserAddLine,
    form: {
      kind: "username",
      label: "Username",
      value: "alex",
      placeholder: "alex",
      help: "Usernames are shared across devices.",
    },
    status: {
      tone: "error",
      title: "That username is already taken",
      body: "Try a different username or sign in if this is your account.",
    },
    primaryLabel: "Try another username",
    secondaryLabel: "Sign in instead",
    footerLabel: "Use wallet instead",
  },
  localSignIn: {
    title: "Welcome back",
    subtitle: "Use the passkey saved on this device.",
    activeMode: "signin",
    icon: RiFingerprintLine,
    form: {
      kind: "passkey",
      title: "Same-device passkey",
      body: "No username needed when this device already has your passkey.",
    },
    status: {
      tone: "success",
      title: "Passkey available",
      body: "Continue with the secure prompt from your device.",
    },
    primaryLabel: "Sign in with passkey",
    secondaryLabel: "Use a username",
    footerLabel: "Use wallet instead",
  },
  usernameSignIn: {
    title: "Sign in with your username",
    subtitle: "Use the username you created on any device.",
    activeMode: "signin",
    icon: RiKey2Line,
    form: {
      kind: "username",
      label: "Username",
      value: "alex",
      placeholder: "alex",
      help: "We will find your saved passkey before asking your device.",
    },
    status: {
      tone: "neutral",
      title: "Ready to find your passkey",
      body: "This keeps recovery behind one clear sign in step.",
    },
    primaryLabel: "Continue",
    secondaryLabel: "Create a new account",
    footerLabel: "Use wallet instead",
  },
  usernameNotFound: {
    title: "Sign in with your username",
    subtitle: "Use the username you created on any device.",
    activeMode: "signin",
    icon: RiKey2Line,
    form: {
      kind: "username",
      label: "Username",
      value: "alex",
      placeholder: "alex",
      help: "Check spelling or create a new account.",
    },
    status: {
      tone: "error",
      title: "No passkey found for alex",
      body: "Try another username or create a new account.",
    },
    primaryLabel: "Try again",
    secondaryLabel: "Create new account",
    footerLabel: "Use wallet instead",
  },
  serverUnavailable: {
    title: "Sign in with your username",
    subtitle: "Use the username you created on any device.",
    activeMode: "signin",
    icon: RiErrorWarningLine,
    form: {
      kind: "username",
      label: "Username",
      value: "alex",
      placeholder: "alex",
      help: "Your username is kept in place while the service recovers.",
    },
    status: {
      tone: "error",
      title: "Passkey service is unavailable",
      body: "Retry in a moment or use a same-device passkey.",
    },
    primaryLabel: "Retry",
    secondaryLabel: "Use same-device passkey",
    footerLabel: "Use wallet instead",
  },
  loading: {
    title: "Creating your account",
    subtitle: "Your device may ask you to save a passkey.",
    activeMode: "create",
    icon: RiLoader4Line,
    form: {
      kind: "username",
      label: "Username",
      value: "alex",
      placeholder: "alex",
      help: "Keep this screen open while the passkey prompt appears.",
    },
    status: {
      tone: "pending",
      title: "Waiting for device prompt",
      body: "No extra choices appear while the request is in progress.",
    },
    primaryLabel: "Creating account",
    secondaryLabel: "Cancel",
    footerLabel: "Use wallet instead",
    loading: true,
  },
  newAccountConfirmation: {
    title: "Create a new account?",
    subtitle: "This username does not match a saved passkey.",
    activeMode: "signin",
    icon: RiUserAddLine,
    form: {
      kind: "confirmation",
      title: "This starts a separate account",
      body: "Use this only if alex is not your existing Green Goods account.",
    },
    status: {
      tone: "warning",
      title: "New account warning",
      body: "Creating again gives you a different account address.",
    },
    primaryLabel: "Create new account",
    secondaryLabel: "Go back",
    footerLabel: "Use wallet instead",
  },
};

const catalogOrder: LoginFlowScenario[] = [
  "create",
  "localSignIn",
  "usernameSignIn",
  "loading",
  "usernameNotFound",
  "serverUnavailable",
  "createTaken",
  "newAccountConfirmation",
];

const errorOrder: LoginFlowScenario[] = ["usernameNotFound", "serverUnavailable", "createTaken"];

const statusToneClasses: Record<StatusTone, string> = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50 text-text-sub-600",
  success: "border-primary/25 bg-primary/10 text-text-strong-950",
  warning: "border-warning-light bg-warning-lighter text-warning-dark",
  error: "border-error-light bg-error-lighter text-error-dark",
  pending: "border-primary/25 bg-primary/10 text-text-strong-950",
};

const statusIcons: Record<StatusTone, ReactNode> = {
  neutral: <RiShieldCheckLine className="h-4 w-4" />,
  success: <RiShieldCheckLine className="h-4 w-4 text-primary" />,
  warning: <RiErrorWarningLine className="h-4 w-4 text-warning-base" />,
  error: <RiErrorWarningLine className="h-4 w-4 text-error-base" />,
  pending: <RiLoader4Line className="h-4 w-4 animate-spin text-primary" />,
};

function ModeSwitch({ activeMode }: { activeMode: LoginScenarioConfig["activeMode"] }) {
  return (
    <div
      aria-label="Authentication mode"
      className="grid h-11 shrink-0 grid-cols-2 rounded-lg bg-bg-soft-200 p-1 text-sm font-medium"
      role="group"
    >
      {(["create", "signin"] as const).map((mode) => {
        const active = activeMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            className={
              active
                ? "rounded-md bg-bg-white-0 text-text-strong-950 shadow-sm"
                : "rounded-md text-text-sub-600"
            }
          >
            {mode === "create" ? "Create" : "Sign in"}
          </button>
        );
      })}
    </div>
  );
}

function FormSlot({ form }: { form: LoginScenarioConfig["form"] }) {
  const usernameId = useId();

  if (form.kind === "username") {
    return (
      <div
        data-testid="login-form-slot"
        className="flex h-[124px] shrink-0 flex-col justify-center rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3"
      >
        <label className="text-xs font-medium text-text-sub-600" htmlFor={usernameId}>
          {form.label}
        </label>
        <input
          id={usernameId}
          value={form.value}
          readOnly
          placeholder={form.placeholder}
          className="mt-2 h-11 rounded-lg border border-stroke-soft-200 bg-bg-weak-50 px-3 text-base font-medium text-text-strong-950 outline-none"
        />
        <p className="mt-2 min-h-4 text-xs leading-4 text-text-sub-600">{form.help}</p>
      </div>
    );
  }

  const Icon = form.kind === "passkey" ? RiFingerprintLine : RiUserAddLine;

  return (
    <div
      data-testid="login-form-slot"
      className="flex h-[124px] shrink-0 items-center gap-3 rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-strong-950">{form.title}</p>
        <p className="mt-1 text-xs leading-5 text-text-sub-600">{form.body}</p>
      </div>
    </div>
  );
}

function StatusSlot({ status }: { status: LoginScenarioConfig["status"] }) {
  return (
    <div
      data-testid="login-status-slot"
      role={status.tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`flex h-[88px] shrink-0 gap-3 overflow-hidden rounded-lg border p-3 ${statusToneClasses[status.tone]}`}
    >
      <div className="mt-0.5 shrink-0">{statusIcons[status.tone]}</div>
      <div>
        <p className="text-sm font-semibold">{status.title}</p>
        <p className="mt-1 text-xs leading-5">{status.body}</p>
      </div>
    </div>
  );
}

function ActionSlot({ config }: { config: LoginScenarioConfig }) {
  return (
    <div data-testid="login-actions-slot" className="flex h-[112px] shrink-0 flex-col gap-2">
      <Button
        type="button"
        label={config.primaryLabel}
        disabled={config.loading}
        className="h-12 w-full justify-center"
        leadingIcon={config.loading ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : null}
        trailingIcon={!config.loading ? <RiArrowRightLine className="h-4 w-4" /> : null}
      />
      <Button
        type="button"
        label={config.secondaryLabel}
        variant="neutral"
        mode="stroke"
        className="h-10 w-full justify-center"
      />
    </div>
  );
}

function StableLoginPanel({ scenario }: { scenario: LoginFlowScenario }) {
  const config = scenarios[scenario];
  const HeaderIcon = config.icon;

  return (
    <article
      data-testid="login-panel"
      data-scenario={scenario}
      className="flex min-h-[704px] w-full max-w-[390px] flex-col rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4 text-text-strong-950 shadow-sm"
    >
      <div data-testid="login-brand-slot" className="flex h-[156px] shrink-0 flex-col justify-end">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HeaderIcon className={`h-6 w-6 ${config.loading ? "animate-spin" : ""}`} />
        </div>
        <h2 className="mt-4 text-xl font-semibold leading-7">{config.title}</h2>
        <p className="mt-2 min-h-10 text-sm leading-5 text-text-sub-600">{config.subtitle}</p>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-4">
        <ModeSwitch activeMode={config.activeMode} />
        <FormSlot form={config.form} />
        <StatusSlot status={config.status} />
        <ActionSlot config={config} />
      </div>

      <div
        data-testid="login-footer-slot"
        className="mt-4 flex h-10 shrink-0 items-center justify-center"
      >
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-text-sub-600"
        >
          <RiWallet3Line className="h-4 w-4" />
          {config.footerLabel}
        </button>
      </div>
    </article>
  );
}

function LoginFlowCatalog({ items = catalogOrder }: { items?: LoginFlowScenario[] }) {
  return (
    <main className="min-h-[760px] bg-bg-weak-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 max-w-2xl text-text-strong-950">
          <h1 className="text-2xl font-semibold">PWA passkey login and signup</h1>
          <p className="mt-2 text-sm leading-6 text-text-sub-600">
            Stable-layout mockups for first-time account creation, returning sign in, and the
            failure states that need to stay in place without shifting content.
          </p>
        </header>
        <div data-testid="stable-login-catalog" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {items.map((item) => (
            <StableLoginPanel key={item} scenario={item} />
          ))}
        </div>
      </div>
    </main>
  );
}

function MermaidFlowSource() {
  return (
    <main className="min-h-[760px] bg-bg-weak-50 px-4 py-8 text-text-strong-950">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Passkey login flow</h1>
          <p className="mt-2 text-sm leading-6 text-text-sub-600">
            Mermaid source for the proposed PWA passkey decision tree.
          </p>
        </header>
        <pre
          data-testid="login-flow-mermaid"
          className="whitespace-pre-wrap break-words rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4 text-xs leading-5 text-text-strong-950"
        >
          {loginFlowDiagram}
        </pre>
      </div>
    </main>
  );
}

const meta = {
  title: "Client/PWA/LoginFlow",
  component: LoginFlowCatalog,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "PWA passkey login and signup mockups with fixed slots for form, status, actions, and footer.",
      },
    },
  },
  decorators: [withInstalledPwa(), withClientAppRuntime],
} satisfies Meta<typeof LoginFlowCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
  render: () => <LoginFlowCatalog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("stable-login-catalog")).toBeVisible();
    for (const panel of canvas.getAllByTestId("login-panel")) {
      await expect(panel).toBeVisible();
      expect(panel.className).toContain("min-h-[704px]");
    }
    for (const slot of canvas.getAllByTestId("login-status-slot")) {
      expect(slot.className).toContain("h-[88px]");
    }
    for (const slot of canvas.getAllByTestId("login-actions-slot")) {
      expect(slot.className).toContain("h-[112px]");
    }
  },
};

export const ErrorStates: Story = {
  render: () => <LoginFlowCatalog items={errorOrder} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alerts = canvas.getAllByRole("alert");
    expect(alerts).toHaveLength(errorOrder.length);
    for (const alert of alerts) {
      await expect(alert).toBeVisible();
      expect(alert.className).toContain("h-[88px]");
    }
  },
};

export const CreateAccount: Story = {
  render: () => <LoginFlowCatalog items={["create"]} />,
};

export const SignIn: Story = {
  render: () => <LoginFlowCatalog items={["localSignIn", "usernameSignIn"]} />,
};

export const FlowDiagram: Story = {
  render: () => <MermaidFlowSource />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("login-flow-mermaid")).toBeVisible();
    await expect(canvas.getByText(/Open Green Goods PWA/)).toBeVisible();
  },
};
