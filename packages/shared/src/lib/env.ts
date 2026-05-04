type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv: RuntimeEnv =
  typeof import.meta !== "undefined"
    ? (import.meta.env as unknown as RuntimeEnv)
    : typeof process !== "undefined"
      ? (process.env as RuntimeEnv)
      : ({} as RuntimeEnv);

export const ENV = new Proxy({} as RuntimeEnv, {
  get: (_target, prop) => {
    if (typeof prop !== "string") return undefined;
    const value = runtimeEnv[prop];
    return typeof value === "string" ? value : undefined;
  },
});
