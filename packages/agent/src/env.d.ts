// Augment ImportMeta for shared package compatibility
interface ImportMeta {
  env: Record<string, string | undefined>;
}

// Environment variable declarations
declare namespace NodeJS {
  interface ProcessEnv {
    APP_ENV?: "development" | "test" | "staging" | "production";

    // Required
    TELEGRAM_BOT_TOKEN?: string;
    ENCRYPTION_SECRET?: string;

    // Server
    NODE_ENV?: "development" | "production" | "test";
    PORT?: string;
    HOST?: string;
    BOT_MODE?: "polling" | "webhook";
    WEBHOOK_URL?: string;
    AGENT_DISABLE_TELEGRAM_RUNTIME?: string;

    // Telegram
    TELEGRAM_WEBHOOK_SECRET?: string;

    // Database
    DB_PATH?: string;

    // API
    BOT_API_TOKEN?: string;
    AGENT_ALLOWED_ORIGINS?: string;
    AGENT_PUBLIC_ALLOWED_ORIGINS?: string;
    AGENT_TRUSTED_PROXY_HOPS?: string;
    AGENT_TRUSTED_PROXY_CIDRS?: string;
    AGENT_UPLOAD_SIGN_TTL_SECONDS?: string;
    AGENT_UPLOAD_MAX_FILE_SIZE_BYTES?: string;
    AGENT_UPLOAD_ALLOWED_MIME_TYPES?: string;
    AGENT_UPLOAD_SIGN_RATE_LIMIT?: string;
    AGENT_UPLOAD_SIGN_RATE_LIMIT_WINDOW_MS?: string;

    // Upload signing
    PINATA_JWT?: string;
    PINATA_UPLOADS_API_URL?: string;

    // Public subscription provider
    RESEND_API_KEY?: string;
    RESEND_GREEN_GOODS_SEGMENT_ID?: string;
    RESEND_GREEN_GOODS_TOPIC_ID?: string;

    // Analytics
    POSTHOG_AGENT_KEY?: string;
    ANALYTICS_ENABLED?: string;

    // Chain
    VITE_CHAIN_ID?: string;
    VITE_RPC_URL_11155111?: string;
    ETHEREUM_RPC_URL?: string;
    SEPOLIA_RPC_URL?: string;
    ARBITRUM_RPC_URL?: string;
    CELO_RPC_URL?: string;
    OPTIMISM_RPC_URL?: string;
    ALCHEMY_API_KEY?: string;
    ALCHEMY_KEY?: string;
  }
}
