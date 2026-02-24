import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { MemoryRouter } from "react-router-dom";
import { Splash } from "./Splash";

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
