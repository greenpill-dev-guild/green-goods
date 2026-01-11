// Augment ImportMeta for shared package compatibility
interface ImportMeta {
  env: Record<string, string | undefined>;
}

// Environment variable declarations
declare namespace NodeJS {
  interface ProcessEnv {
    // Required
    TELEGRAM_BOT_TOKEN?: string;
    ENCRYPTION_SECRET?: string;

    // Server
    NODE_ENV?: "development" | "production" | "test";
    PORT?: string;
    HOST?: string;
    BOT_MODE?: "polling" | "webhook";
    WEBHOOK_URL?: string;

    // Telegram
    TELEGRAM_WEBHOOK_SECRET?: string;

    // Database
    DB_PATH?: string;

    // Analytics
    POSTHOG_AGENT_KEY?: string;
    POSTHOG_HOST?: string;
    ANALYTICS_ENABLED?: string;

    // Chain
    VITE_CHAIN_ID?: string;
  }
}
