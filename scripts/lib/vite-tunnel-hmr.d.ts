import type { HmrOptions } from "vite";

export function readTunnelUrl(rootDir: string, tunnelFile?: string): URL | null;

export function resolveTunnelHmrConfig(rootDir: string, tunnelFile?: string): HmrOptions | null;
