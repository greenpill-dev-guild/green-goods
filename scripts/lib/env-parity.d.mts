type Environment = Record<string, string | undefined>;

type WarningLogger = {
  warn(message: string): void;
};

type ParityResult = {
  checked: boolean;
  missing: string[];
  empty: string[];
};

export function assertEnvParity(options: {
  app: "client" | "admin";
  env?: Environment;
  schemaPath: string;
  logger?: WarningLogger;
}): ParityResult;

export function assertSentryDsnResolvable(options: {
  app: "client" | "admin";
  sentryDsn: string | undefined;
  env?: Environment;
  logger?: WarningLogger;
}): boolean;
