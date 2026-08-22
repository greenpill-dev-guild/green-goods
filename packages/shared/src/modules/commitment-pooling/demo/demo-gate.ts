/**
 * The one seam between the real reads and the demo world.
 *
 * `demoAware` wraps a reader so that, in dev with `?mockPooling=1`, the
 * fixture implementation of the same name answers instead. Production
 * builds replace the DEV guard with `false`, which leaves the real reader
 * untouched and drops the dynamic import with it.
 *
 * @module modules/commitment-pooling/demo/demo-gate
 */

import { isDemoPoolingActive } from "./demo-mode";

type DemoReads = typeof import("./demo-reads");
type AsyncReader = (...args: never[]) => Promise<unknown>;
type DemoReadName = {
  [K in keyof DemoReads]: DemoReads[K] extends AsyncReader ? K : never;
}[keyof DemoReads];

export function demoAware<N extends DemoReadName>(name: N, real: DemoReads[N]): DemoReads[N] {
  if (!import.meta.env.DEV) return real;
  const wrapped = async (...args: unknown[]) => {
    const reader: unknown = isDemoPoolingActive() ? (await import("./demo-reads"))[name] : real;
    return (reader as (...inner: unknown[]) => Promise<unknown>)(...args);
  };
  return wrapped as unknown as DemoReads[N];
}

/**
 * The document behind a CID, from the fixture world when demo mode is on
 * and the CID is one of its own; null otherwise so the caller reads the
 * gateway as usual.
 */
export async function demoDocumentFor(cid: string): Promise<Record<string, unknown> | null> {
  if (!import.meta.env.DEV || !isDemoPoolingActive()) return null;
  const demo = await import("./demo-reads");
  return demo.demoDocument(cid);
}
