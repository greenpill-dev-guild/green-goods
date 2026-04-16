type RuntimeEnvValue = string | boolean | undefined;
type RuntimeEnv = Record<string, RuntimeEnvValue>;

const runtimeEnv: RuntimeEnv =
  typeof import.meta !== "undefined"
    ? (import.meta.env as RuntimeEnv)
    : ({} as RuntimeEnv);

export const ENV = new Proxy({} as RuntimeEnv, {
  get: (_target, prop) => {
    if (typeof prop !== "string") return undefined;
    return runtimeEnv[prop];
  },
});

export function initVarlockEnv() {
  return;
}

export function redactSensitiveConfig<T>(value: T): T {
  return value;
}

export function resetRedactionMap() {
  return;
}

export function revealSensitiveConfig(secretStr: string): string {
  return secretStr;
}

export function scanForLeaks<T>(value: T): T {
  return value;
}

export const varlockSettings = {};
