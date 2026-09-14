export interface Invocation { command: string; args: string[]; cwd: string; env: Record<string, string>; }
export interface Resolution extends Invocation { operation: string; network?: string; mode?: string; checks: Array<{command: string; args: string[]}>; explain: boolean; json: boolean; capabilities: string[]; effects: string[]; safeguards: string[]; }
export interface Help { help: true; topic: string; }
export interface Operation { command: string; handler: string; prefix: string[]; network: boolean; networks: string[]; modes: Record<string, string[]> | null; flags: string[]; values: string[]; positional: number; }
export const PACKAGE_ROOT: string;
export const OPERATOR: string;
export const OPERATOR_ARGUMENTS: Readonly<Record<string, readonly string[]>>;
export const OPERATIONS: readonly Operation[];
export function resolveCommand(args: string[]): Resolution | Help;
export function resolveOperatorBoundary(id: string, args: string[]): Resolution;
export function resolveMintingTransaction(network: string, gardenToken: string, rpc: string): { command: string; args: string[] };
export function explainOperation(resolution: Resolution): Record<string, unknown>;
export function renderHelp(topic?: string): string;
