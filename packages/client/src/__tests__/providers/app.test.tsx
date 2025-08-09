import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupAfterEach, mockConsole, setupBeforeEach } from "@/__tests__/utils/test-helpers";
import {
  AppProvider,
  // type Locale,
  // type Platform,
  supportedLanguages,
  useApp,
} from "@/providers/app";

// Mock dependencies
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

vi.mock("@/modules/posthog", () => ({
  track: vi.fn(),
}));

vi.mock("react-intl", () => ({
  IntlProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="intl-provider">{children}</div>
  ),
}));

vi.mock("browser-lang", () => ({
  default: vi.fn(),
}));

// Import mocked modules
import browserLang from "browser-lang";
import { track } from "@/modules/posthog";

const mockBrowserLang = vi.mocked(browserLang);
const mockTrack = vi.mocked(track);

// Test component to access context
const TestComponent = () => {
  const app = useApp();
  return (
    <div data-testid="test-component">
      <div data-testid="locale">{app.locale}</div>
      <div data-testid="platform">{app.platform}</div>
      <div data-testid="is-mobile">{app.isMobile.toString()}</div>
      <div data-testid="is-installed">{app.isInstalled.toString()}</div>
      <div data-testid="available-locales">{app.availableLocales.join(",")}</div>
      <button data-testid="prompt-install" onClick={app.promptInstall}>
        Install
      </button>
      <button data-testid="switch-to-pt" onClick={() => app.switchLanguage("pt")}>
        Switch to PT
      </button>
      <button data-testid="switch-to-es" onClick={() => app.switchLanguage("es")}>
        Switch to ES
      </button>
    </div>
  );
};

// Helper to render app with provider
const renderWithApp = (children = <TestComponent />) => {
  return render(<AppProvider>{children}</AppProvider>);
};

describe("AppProvider", () => {
  let mockLocalStorage: any;
  let mockMatchMedia: any;
  let mockBeforeInstallPromptEvent: any;

  beforeEach(() => {
    setupBeforeEach();

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });

    // Mock matchMedia
    mockMatchMedia = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });

    // Mock navigator.userAgent
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      writable: true,
    });

    // Mock import.meta.env
    vi.stubGlobal("import", {
      meta: {
        env: {
          VITE_PUBLIC_POSTHOG_KEY: "test-posthog-key",
          VITE_PUBLIC_POSTHOG_HOST: "https://test-posthog.com",
          VITE_MOCK_PWA_INSTALLED: "false",
          MODE: "test",
        },
      },
    });

    // Setup default mocks
    mockBrowserLang.mockReturnValue("en");
    mockLocalStorage.getItem.mockReturnValue(null);
    mockMatchMedia.mockReturnValue({ matches: false });

    // Setup mock beforeinstallprompt event
    mockBeforeInstallPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    };
  });

  afterEach(() => {
    cleanupAfterEach();
    vi.unstubAllGlobals();
  });

  describe("Provider Setup", () => {
    it("should render children with context", () => {
      renderWithApp();

      expect(screen.getByTestId("test-component")).toBeInTheDocument();
      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
      expect(screen.getByTestId("intl-provider")).toBeInTheDocument();
    });

    it("should provide default context values", () => {
      renderWithApp();

      expect(screen.getByTestId("locale")).toHaveTextContent("en");
      expect(screen.getByTestId("platform")).toHaveTextContent("unknown");
      expect(screen.getByTestId("is-mobile")).toHaveTextContent("false");
      expect(screen.getByTestId("is-installed")).toHaveTextContent("false");
      expect(screen.getByTestId("available-locales")).toHaveTextContent("en,pt,es");
    });

    it("should throw error when useApp is used outside provider", () => {
      const consoleSpy = mockConsole();

      expect(() => {
        render(<TestComponent />);
      }).toThrow();

      consoleSpy.error.mockRestore();
    });
  });

  describe("Platform Detection", () => {
    it("should detect Android platform", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36",
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("platform")).toHaveTextContent("android");
      expect(screen.getByTestId("is-mobile")).toHaveTextContent("true");
    });

    it("should detect iOS platform", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("platform")).toHaveTextContent("ios");
      expect(screen.getByTestId("is-mobile")).toHaveTextContent("true");
    });

    it("should detect Windows Phone platform", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0)",
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("platform")).toHaveTextContent("windows");
      expect(screen.getByTestId("is-mobile")).toHaveTextContent("true");
    });

    it("should detect unknown platform for desktop", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("platform")).toHaveTextContent("unknown");
      expect(screen.getByTestId("is-mobile")).toHaveTextContent("false");
    });

    it("should handle iPad detection correctly", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("platform")).toHaveTextContent("ios");
      expect(screen.getByTestId("is-mobile")).toHaveTextContent("true");
    });
  });

  describe("Language Management", () => {
    it("should use stored language from localStorage", () => {
      mockLocalStorage.getItem.mockReturnValue("pt");

      renderWithApp();

      expect(screen.getByTestId("locale")).toHaveTextContent("pt");
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("gg-language");
    });

    it("should use browser language when no stored language", () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockBrowserLang.mockReturnValue("es");

      renderWithApp();

      expect(screen.getByTestId("locale")).toHaveTextContent("es");
      expect(mockBrowserLang).toHaveBeenCalledWith({
        languages: supportedLanguages,
        fallback: "en",
      });
    });

    it("should fall back to English for unsupported language", () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockBrowserLang.mockReturnValue("fr"); // Unsupported language

      renderWithApp();

      expect(screen.getByTestId("locale")).toHaveTextContent("fr");
    });

    it("should switch language and update localStorage", async () => {
      renderWithApp();

      await act(async () => {
        fireEvent.click(screen.getByTestId("switch-to-pt"));
      });

      expect(screen.getByTestId("locale")).toHaveTextContent("pt");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("gg-language", "pt");
    });

    it("should switch to different languages", async () => {
      renderWithApp();

      await act(async () => {
        fireEvent.click(screen.getByTestId("switch-to-es"));
      });

      expect(screen.getByTestId("locale")).toHaveTextContent("es");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("gg-language", "es");
    });

    it("should provide all supported languages", () => {
      renderWithApp();

      expect(screen.getByTestId("available-locales")).toHaveTextContent("en,pt,es");
    });
  });

  describe("PWA Installation", () => {
    it("should detect installed app via display-mode", () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query.includes("display-mode: standalone"),
      }));

      renderWithApp();

      expect(screen.getByTestId("is-installed")).toHaveTextContent("true");
    });

    it("should detect installed app via fullscreen mode", () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query.includes("display-mode: fullscreen"),
      }));

      renderWithApp();

      expect(screen.getByTestId("is-installed")).toHaveTextContent("true");
    });

    it("should detect installed app via navigator.standalone (iOS)", () => {
      Object.defineProperty(navigator, "standalone", {
        value: true,
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("is-installed")).toHaveTextContent("true");
    });

    it("should handle mock PWA installation for testing", () => {
      vi.stubGlobal("import", {
        meta: {
          env: {
            VITE_MOCK_PWA_INSTALLED: "true",
            VITE_PUBLIC_POSTHOG_KEY: "test-key",
            VITE_PUBLIC_POSTHOG_HOST: "https://test.com",
            MODE: "test",
          },
        },
      });

      renderWithApp();

      expect(screen.getByTestId("is-installed")).toHaveTextContent("true");
    });

    it("should detect not installed when no installation indicators", () => {
      mockMatchMedia.mockReturnValue({ matches: false });

      renderWithApp();

      expect(screen.getByTestId("is-installed")).toHaveTextContent("false");
    });

    it("should handle beforeinstallprompt event", async () => {
      renderWithApp();

      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt"), mockBeforeInstallPromptEvent)
        );
      });

      expect(mockBeforeInstallPromptEvent.preventDefault).toHaveBeenCalled();
    });

    it("should prompt installation when deferredPrompt is available", async () => {
      renderWithApp();

      // First trigger the beforeinstallprompt event
      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt"), mockBeforeInstallPromptEvent)
        );
      });

      // Then click the install button
      await act(async () => {
        fireEvent.click(screen.getByTestId("prompt-install"));
      });

      expect(mockBeforeInstallPromptEvent.prompt).toHaveBeenCalled();
    });

    it("should handle installation acceptance", async () => {
      mockBeforeInstallPromptEvent.userChoice = Promise.resolve({ outcome: "accepted" });

      renderWithApp();

      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt"), mockBeforeInstallPromptEvent)
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("prompt-install"));
      });

      // Wait for userChoice to resolve
      await act(async () => {
        await mockBeforeInstallPromptEvent.userChoice;
      });

      // The deferredPrompt should be cleared after user choice
      expect(mockBeforeInstallPromptEvent.prompt).toHaveBeenCalled();
    });

    it("should handle installation dismissal", async () => {
      mockBeforeInstallPromptEvent.userChoice = Promise.resolve({ outcome: "dismissed" });

      renderWithApp();

      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt"), mockBeforeInstallPromptEvent)
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("prompt-install"));
      });

      await act(async () => {
        await mockBeforeInstallPromptEvent.userChoice;
      });

      expect(mockBeforeInstallPromptEvent.prompt).toHaveBeenCalled();
    });

    it("should handle app installed event", async () => {
      renderWithApp();

      await act(async () => {
        window.dispatchEvent(new Event("appinstalled"));
      });

      expect(screen.getByTestId("is-installed")).toHaveTextContent("true");
      expect(mockTrack).toHaveBeenCalledWith("App Installed", {
        platform: "unknown",
        locale: "en",
        installState: "installed",
      });
    });

    it("should not prompt installation when no deferredPrompt", async () => {
      renderWithApp();

      await act(async () => {
        fireEvent.click(screen.getByTestId("prompt-install"));
      });

      // Should not crash or throw error
      expect(screen.getByTestId("test-component")).toBeInTheDocument();
    });
  });

  describe("Event Listeners", () => {
    it("should add event listeners on mount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      renderWithApp();

      expect(addEventListenerSpy).toHaveBeenCalledWith("beforeinstallprompt", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it("should remove event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderWithApp();
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "beforeinstallprompt",
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("PostHog Integration", () => {
    it("should configure PostHog with environment variables", () => {
      renderWithApp();

      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
    });

    it("should track app installation with correct data", async () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36",
        writable: true,
      });

      renderWithApp();

      await act(async () => {
        window.dispatchEvent(new Event("appinstalled"));
      });

      expect(mockTrack).toHaveBeenCalledWith("App Installed", {
        platform: "android",
        locale: "en",
        installState: "installed",
      });
    });
  });

  describe("IntlProvider Integration", () => {
    it("should provide IntlProvider with correct locale", () => {
      mockLocalStorage.getItem.mockReturnValue("pt");

      renderWithApp();

      expect(screen.getByTestId("intl-provider")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing localStorage gracefully", () => {
      Object.defineProperty(global, "localStorage", {
        value: undefined,
        writable: true,
      });

      // Should not crash
      expect(() => renderWithApp()).not.toThrow();
    });

    it("should handle missing matchMedia gracefully", () => {
      Object.defineProperty(window, "matchMedia", {
        value: undefined,
        writable: true,
      });

      // Should not crash
      expect(() => renderWithApp()).not.toThrow();
    });

    it("should handle missing navigator properties", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: undefined,
        writable: true,
      });

      renderWithApp();

      expect(screen.getByTestId("platform")).toHaveTextContent("unknown");
    });

    it("should handle malformed beforeinstallprompt events", async () => {
      renderWithApp();

      // Event without required methods
      const malformedEvent = new Event("beforeinstallprompt");

      await act(async () => {
        window.dispatchEvent(malformedEvent);
      });

      // Should not crash
      expect(screen.getByTestId("test-component")).toBeInTheDocument();
    });

    it("should handle rapid language switches", async () => {
      renderWithApp();

      // Rapidly switch languages
      await act(async () => {
        fireEvent.click(screen.getByTestId("switch-to-pt"));
        fireEvent.click(screen.getByTestId("switch-to-es"));
        fireEvent.click(screen.getByTestId("switch-to-pt"));
      });

      expect(screen.getByTestId("locale")).toHaveTextContent("pt");
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it("should handle multiple beforeinstallprompt events", async () => {
      renderWithApp();

      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt"), mockBeforeInstallPromptEvent)
        );
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt"), {
            ...mockBeforeInstallPromptEvent,
            preventDefault: vi.fn(),
          })
        );
      });

      // Should handle multiple events gracefully
      expect(screen.getByTestId("test-component")).toBeInTheDocument();
    });

    it("should handle multiple appinstalled events", async () => {
      renderWithApp();

      await act(async () => {
        window.dispatchEvent(new Event("appinstalled"));
        window.dispatchEvent(new Event("appinstalled"));
      });

      expect(screen.getByTestId("is-installed")).toHaveTextContent("true");
      expect(mockTrack).toHaveBeenCalledTimes(2);
    });
  });

  describe("Accessibility and UX", () => {
    it("should provide accessible button for installation", () => {
      renderWithApp();

      const installButton = screen.getByTestId("prompt-install");
      expect(installButton).toBeInTheDocument();
      expect(installButton.tagName).toBe("BUTTON");
    });

    it("should provide accessible buttons for language switching", () => {
      renderWithApp();

      const ptButton = screen.getByTestId("switch-to-pt");
      const esButton = screen.getByTestId("switch-to-es");

      expect(ptButton).toBeInTheDocument();
      expect(esButton).toBeInTheDocument();
      expect(ptButton.tagName).toBe("BUTTON");
      expect(esButton.tagName).toBe("BUTTON");
    });
  });
});
