type Environment = Record<string, string | undefined>;

export function telemetryBuildDefines(options: {
  surface: "app" | "admin";
  release: string;
  env?: Environment;
}): Record<string, string>;
