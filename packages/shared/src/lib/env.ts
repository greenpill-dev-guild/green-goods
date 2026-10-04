// Vite pastes the whole env object into the bundle wherever `import.meta.env` is read whole,
// and inlines a single value where a key is read by name. Every key read through `ENV` is
// therefore named here: add a key to this list before reading it.
const viteEnv = {
  VITE_ALCHEMY_API_KEY: () => import.meta.env.VITE_ALCHEMY_API_KEY,
  VITE_CHAIN_ID: () => import.meta.env.VITE_CHAIN_ID,
  VITE_DEV_CHAIN_MODE: () => import.meta.env.VITE_DEV_CHAIN_MODE,
  VITE_ERC7677_PROXY_URL: () => import.meta.env.VITE_ERC7677_PROXY_URL,
  VITE_GARDENS_SUBGRAPH_KEY: () => import.meta.env.VITE_GARDENS_SUBGRAPH_KEY,
  VITE_LOCAL_FORK_RPC_URL: () => import.meta.env.VITE_LOCAL_FORK_RPC_URL,
  VITE_PIMLICO_API_KEY: () => import.meta.env.VITE_PIMLICO_API_KEY,
  VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID: () =>
    import.meta.env.VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID,
  VITE_PIMLICO_SPONSORSHIP_POLICY_ID: () => import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID,
  VITE_WALLETCONNECT_PROJECT_ID: () => import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
};

type EnvKey = keyof typeof viteEnv;
type RuntimeEnv = Readonly<Record<EnvKey, string | undefined>>;

function readRuntimeEnv(key: string): unknown {
  if (typeof import.meta !== "undefined") {
    return Object.prototype.hasOwnProperty.call(viteEnv, key)
      ? viteEnv[key as EnvKey]()
      : undefined;
  }
  if (typeof process !== "undefined") return process.env[key];
  return undefined;
}

export const ENV = new Proxy({} as RuntimeEnv, {
  get: (_target, prop) => {
    if (typeof prop !== "string") return undefined;
    const value = readRuntimeEnv(prop);
    return typeof value === "string" ? value : undefined;
  },
});
