// Environment variables debug info (remove in production)
const debugEnvVars = () => {
  const viteVars = Object.keys(import.meta.env)
    .filter((key) => key.startsWith("VITE_"))
    .reduce(
      (acc, key) => {
        acc[key] = import.meta.env[key] ? "✅ Loaded" : "❌ Missing";
        return acc;
      },
      {} as Record<string, string>
    );

  void viteVars;
};

// Run debug in development
if (import.meta.env.DEV) {
  debugEnvVars();
}

export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION = "Start Bringing Your Impact Onchain";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

export const ONBOARDED_STORAGE_KEY = "greengoods_user_onboarded";
