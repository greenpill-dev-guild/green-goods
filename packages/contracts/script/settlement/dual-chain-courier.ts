#!/usr/bin/env bun

import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import { keccak256, toUtf8Bytes } from "ethers";

export const DUAL_CHAIN = {
  source: { role: "source" as const, chainId: 421614, selector: "4216140001", port: 3012 },
  executor: { role: "executor" as const, chainId: 11142220, selector: "11142220001", port: 3013 },
};

const CONTRACTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNTIME_DIR = path.join(CONTRACTS_ROOT, ".generated/runtime");
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SOURCE_PEER = "0x000000000000000000000000000000000000a001";
const SOURCE_RECEIVER = "0x000000000000000000000000000000000000a001";
const EXECUTOR_PEER = "0x000000000000000000000000000000000000c001";
const EXECUTOR_RECEIVER = "0x000000000000000000000000000000000000c001";

export interface CourierMessage {
  direction: "COMMAND" | "ACKNOWLEDGMENT";
  messageId: string;
  sourceChainSelector: string;
  sender: string;
  receiver: string;
  data: string;
  destTokenAmounts: [];
}

export interface DeliveryReceipt {
  messageId: string;
  executionKey: string;
  deliveredOnChainId: number;
  txHash: string;
  blockNumber: number;
  status: "SUCCESS" | "FAILED" | "DUPLICATE" | "REJECTED" | "IGNORED";
}

export interface SettlementCommandTuple {
  version: 1;
  executionKey: string;
  attempt: number;
  isBatch: boolean;
  subjectId: string;
  kind: "ContributorConsideration" | "Funding" | "LoanPrincipal" | "GardenBeneficiary";
  batchKinds: SettlementCommandTuple["kind"][];
  recipients: string[];
  amounts: string[];
  acknowledgmentReceiver: string;
  fail?: boolean;
}

export interface SettlementAcknowledgmentTuple {
  version: 1;
  executionKey: string;
  originatingCommandMessageId: string;
  attempt: number;
  success: boolean;
  failureCode: number;
}

interface WorkerResponse {
  requestId: number;
  ok: boolean;
  receipt?: DeliveryReceipt;
  outbound?: CourierMessage;
  error?: string;
  state?: Record<string, unknown>;
}

interface WorkerRequest {
  requestId: number;
  op: "record-command" | "deliver" | "retry-ack" | "rotate-peer" | "cancel" | "state";
  message?: CourierMessage;
  executionKey?: string;
  peer?: string;
  previousGraceTicks?: number;
}

function runtimePath(role: "source" | "executor", suffix: string): string {
  return path.join(RUNTIME_DIR, `dual-chain-${role}.${suffix}`);
}

function rpcUrl(role: "source" | "executor") {
  return `http://127.0.0.1:${DUAL_CHAIN[role].port}`;
}

async function readChainId(role: "source" | "executor"): Promise<number> {
  const response = await fetch(rpcUrl(role), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
  const body = (await response.json()) as { result?: string };
  if (!body.result) throw new Error(`No eth_chainId result from ${role}`);
  return Number.parseInt(body.result, 16);
}

async function waitForChain(role: "source" | "executor", attempts = 80): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const chainId = await readChainId(role);
      if (chainId !== DUAL_CHAIN[role].chainId) {
        throw new Error(`${role} RPC has chain ID ${chainId}; expected ${DUAL_CHAIN[role].chainId}`);
      }
      return;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function assertPortFree(role: "source" | "executor") {
  if (fs.existsSync(runtimePath(role, "pid"))) {
    throw new Error(`${role} PID file already exists; run settlement:dual-chain:down before starting another pair`);
  }
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: DUAL_CHAIN[role].port });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error(`Port ${DUAL_CHAIN[role].port} is already claimed; refusing to replace an unknown process`));
    });
    socket.once("error", () => resolve());
  });
}

export async function startDualChains(
  options: { persistent?: boolean } = {},
): Promise<ChildProcessWithoutNullStreams[]> {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const children: ChildProcessWithoutNullStreams[] = [];
  await Promise.all([assertPortFree("source"), assertPortFree("executor")]);
  for (const role of ["source", "executor"] as const) {
    const configPath = path.join(RUNTIME_DIR, `dual-chain-${role}.json`);
    const child = spawn(
      "anvil",
      [
        "--silent",
        "--chain-id",
        String(DUAL_CHAIN[role].chainId),
        "--port",
        String(DUAL_CHAIN[role].port),
        "--config-out",
        configPath,
      ],
      {
        detached: options.persistent === true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (!child.pid) throw new Error(`Could not start ${role} Anvil process`);
    fs.writeFileSync(runtimePath(role, "pid"), `${child.pid}\n`, { mode: 0o600 });
    child.stdout.on("data", (chunk) => fs.appendFileSync(runtimePath(role, "log"), chunk));
    child.stderr.on("data", (chunk) => fs.appendFileSync(runtimePath(role, "log"), chunk));
    if (options.persistent) child.unref();
    children.push(child);
  }
  await Promise.all([waitForChain("source"), waitForChain("executor")]);
  return children;
}

function ownedPid(role: "source" | "executor"): number | null {
  const pidPath = runtimePath(role, "pid");
  if (!fs.existsSync(pidPath)) return null;
  const pid = Number.parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
  return Number.isSafeInteger(pid) && pid > 1 ? pid : null;
}

export function isOwnedAnvilCommand(role: "source" | "executor", command: string): boolean {
  const configPath = path.join(RUNTIME_DIR, `dual-chain-${role}.json`);
  return (
    /(^|\s)(?:\S*\/)?anvil(\s|$)/u.test(command) &&
    command.includes(`--chain-id ${DUAL_CHAIN[role].chainId}`) &&
    command.includes(`--port ${DUAL_CHAIN[role].port}`) &&
    command.includes(`--config-out ${configPath}`)
  );
}

function ownedProcessState(role: "source" | "executor", pid: number): "owned" | "absent" | "foreign" {
  try {
    const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim();
    if (!command) return "absent";
    return isOwnedAnvilCommand(role, command) ? "owned" : "foreign";
  } catch {
    return "absent";
  }
}

export async function stopDualChains(children: ChildProcessWithoutNullStreams[] = []): Promise<void> {
  const pids = new Set(children.map((child) => child.pid).filter((pid): pid is number => typeof pid === "number"));
  for (const role of ["source", "executor"] as const) {
    const pid = ownedPid(role);
    if (!pid) continue;
    const state = ownedProcessState(role, pid);
    if (state === "foreign") {
      throw new Error(`${role} PID ${pid} no longer belongs to the recorded dual-chain Anvil process`);
    }
    if (state === "owned") pids.add(pid);
  }
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  for (const role of ["source", "executor"] as const) {
    const pidPath = runtimePath(role, "pid");
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
  }
}

export function encodeTuple(value: SettlementCommandTuple | SettlementAcknowledgmentTuple): string {
  return `0x${Buffer.from(JSON.stringify(value), "utf8").toString("hex")}`;
}

export function decodeTuple<T>(value: string): T {
  if (!/^0x[0-9a-f]*$/iu.test(value) || value.length % 2 !== 0) throw new Error("malformed hex payload");
  return JSON.parse(Buffer.from(value.slice(2), "hex").toString("utf8")) as T;
}

export function commandMessage(tuple: SettlementCommandTuple, sequence: number): CourierMessage {
  return {
    direction: "COMMAND",
    messageId: keccak256(toUtf8Bytes(`command:${tuple.executionKey}:${tuple.attempt}:${sequence}`)),
    sourceChainSelector: DUAL_CHAIN.source.selector,
    sender: SOURCE_PEER,
    receiver: EXECUTOR_RECEIVER,
    data: encodeTuple(tuple),
    destTokenAmounts: [],
  };
}

class CourierWorker {
  readonly process: ChildProcessWithoutNullStreams;
  private nextRequestId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void }
  >();

  constructor(role: "source" | "executor") {
    this.process = spawn("bun", [SCRIPT_PATH, "worker", "--role", role, "--rpc-url", rpcUrl(role)], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const lines = readline.createInterface({ input: this.process.stdout });
    lines.on("line", (line) => {
      const response = JSON.parse(line) as WorkerResponse;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      if (response.ok) pending.resolve(response);
      else pending.reject(new Error(response.error ?? "courier worker failed"));
    });
    this.process.stderr.on("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) console.error(`[${role}-worker] ${message}`);
    });
  }

  request(request: Omit<WorkerRequest, "requestId">): Promise<WorkerResponse> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.process.stdin.write(`${JSON.stringify({ ...request, requestId })}\n`);
    });
  }

  stop() {
    this.process.kill("SIGTERM");
  }
}

export class DualProcessCourier {
  private readonly source = new CourierWorker("source");
  private readonly executor = new CourierWorker("executor");
  private held: CourierMessage[] = [];

  hold(message: CourierMessage): void {
    this.held.push(structuredClone(message));
  }

  drop(messageId: string): void {
    this.held = this.held.filter((message) => message.messageId !== messageId);
  }

  heldMessages(): CourierMessage[] {
    return structuredClone(this.held);
  }

  async deliver(message: CourierMessage): Promise<WorkerResponse> {
    const serialized = JSON.stringify(message);
    const isolated = JSON.parse(serialized) as CourierMessage;
    if (message.direction === "COMMAND") {
      await this.source.request({ op: "record-command", message: isolated });
      return this.executor.request({ op: "deliver", message: isolated });
    }
    return this.source.request({ op: "deliver", message: isolated });
  }

  async retryAcknowledgment(executionKey: string): Promise<WorkerResponse> {
    return this.executor.request({ op: "retry-ack", executionKey });
  }

  async rotatePeer(peer: string, previousGraceTicks: number): Promise<WorkerResponse> {
    return this.executor.request({ op: "rotate-peer", peer, previousGraceTicks });
  }

  async cancel(executionKey: string): Promise<WorkerResponse> {
    return this.source.request({ op: "cancel", executionKey });
  }

  async state() {
    const [source, executor] = await Promise.all([
      this.source.request({ op: "state" }),
      this.executor.request({ op: "state" }),
    ]);
    return { source: source.state, executor: executor.state };
  }

  stop() {
    this.source.stop();
    this.executor.stop();
  }
}

function validateEnvelope(message: CourierMessage, role: "source" | "executor") {
  if (!message || !["COMMAND", "ACKNOWLEDGMENT"].includes(message.direction)) throw new Error("malformed envelope");
  if (!/^0x[0-9a-f]{64}$/iu.test(message.messageId)) throw new Error("malformed messageId");
  if (!Array.isArray(message.destTokenAmounts) || message.destTokenAmounts.length !== 0) {
    throw new Error("CCIP token amounts are forbidden");
  }
  if (role === "executor" && message.direction !== "COMMAND") throw new Error("executor accepts commands only");
  if (role === "source" && message.direction !== "ACKNOWLEDGMENT")
    throw new Error("source accepts acknowledgments only");
  const expectedReceiver = role === "executor" ? EXECUTOR_RECEIVER : SOURCE_RECEIVER;
  if (message.receiver.toLowerCase() !== expectedReceiver.toLowerCase()) throw new Error("invalid message receiver");
}

async function worker(role: "source" | "executor", workerRpcUrl: string) {
  const rpcChainId = Number.parseInt(
    (
      (await (
        await fetch(workerRpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        })
      ).json()) as { result: string }
    ).result,
    16,
  );
  const expectedChain = DUAL_CHAIN[role].chainId;
  if (rpcChainId !== expectedChain)
    throw new Error(`worker ${role} attached to chain ${rpcChainId}, expected ${expectedChain}`);

  let blockNumber = 1;
  let tick = 1;
  let currentPeer = role === "executor" ? SOURCE_PEER : EXECUTOR_PEER;
  let previousPeer = "0x0000000000000000000000000000000000000000";
  let previousPeerExpiresAt = 0;
  let totalValueExecuted = 0n;
  const executions = new Map<
    string,
    { message: CourierMessage; tuple: SettlementCommandTuple; status: string; acknowledgment?: CourierMessage }
  >();
  const acknowledgments = new Map<string, SettlementAcknowledgmentTuple>();
  const dispatched = new Map<
    string,
    { attempt: number; acknowledgmentReceiver: string; commandMessageIds: Set<string>; payload: string }
  >();
  const cancelled = new Set<string>();

  function receipt(message: CourierMessage, executionKey: string, status: DeliveryReceipt["status"]): DeliveryReceipt {
    return {
      messageId: message.messageId,
      executionKey,
      deliveredOnChainId: expectedChain,
      txHash: keccak256(toUtf8Bytes(`${process.pid}:${expectedChain}:${blockNumber}:${message.messageId}:${status}`)),
      blockNumber: blockNumber++,
      status,
    };
  }

  function acknowledgment(message: CourierMessage, tuple: SettlementCommandTuple, success: boolean): CourierMessage {
    const ackTuple: SettlementAcknowledgmentTuple = {
      version: 1,
      executionKey: tuple.executionKey,
      originatingCommandMessageId: message.messageId,
      attempt: tuple.attempt,
      success,
      failureCode: success ? 0 : 8,
    };
    return {
      direction: "ACKNOWLEDGMENT",
      messageId: keccak256(toUtf8Bytes(`ack:${message.messageId}:${success}`)),
      sourceChainSelector: DUAL_CHAIN.executor.selector,
      sender: "0x000000000000000000000000000000000000c001",
      receiver: tuple.acknowledgmentReceiver,
      data: encodeTuple(ackTuple),
      destTokenAmounts: [],
    };
  }

  const input = readline.createInterface({ input: process.stdin });
  for await (const line of input) {
    let request: WorkerRequest | undefined;
    try {
      request = JSON.parse(line) as WorkerRequest;
      tick++;
      if (request.op === "state") {
        console.log(
          JSON.stringify({
            requestId: request.requestId,
            ok: true,
            state: {
              pid: process.pid,
              chainId: expectedChain,
              rpcUrl: workerRpcUrl,
              totalValueExecuted: totalValueExecuted.toString(),
              executions: Object.fromEntries([...executions].map(([key, value]) => [key, value.status])),
              acknowledgments: Object.fromEntries([...acknowledgments].map(([key, value]) => [key, value.success])),
              dispatched: Object.fromEntries(
                [...dispatched].map(([key, value]) => [key, [...value.commandMessageIds]]),
              ),
              cancelled: [...cancelled],
              currentPeer,
              previousPeer,
              previousPeerExpiresAt,
            },
          } satisfies WorkerResponse),
        );
        continue;
      }
      if (request.op === "record-command") {
        if (role !== "source" || !request.message || request.message.direction !== "COMMAND") {
          throw new Error("command recording belongs to source");
        }
        const message = request.message;
        if (!Array.isArray(message.destTokenAmounts) || message.destTokenAmounts.length !== 0) {
          throw new Error("CCIP token amounts are forbidden");
        }
        if (
          !/^0x[0-9a-f]{64}$/iu.test(message.messageId) ||
          !/^0x[0-9a-f]{40}$/iu.test(message.sender) ||
          message.receiver.toLowerCase() !== EXECUTOR_RECEIVER.toLowerCase() ||
          message.sourceChainSelector !== DUAL_CHAIN.source.selector
        ) {
          throw new Error("malformed source command record");
        }
        const tuple = decodeTuple<SettlementCommandTuple>(message.data);
        if (tuple.version !== 1 || tuple.attempt <= 0 || !tuple.executionKey)
          throw new Error("malformed command tuple");
        if (tuple.acknowledgmentReceiver.toLowerCase() !== SOURCE_RECEIVER.toLowerCase()) {
          throw new Error("invalid acknowledgment receiver");
        }
        const existing = dispatched.get(tuple.executionKey);
        if (existing) {
          if (
            existing.attempt !== tuple.attempt ||
            existing.acknowledgmentReceiver.toLowerCase() !== tuple.acknowledgmentReceiver.toLowerCase() ||
            existing.payload !== message.data
          ) {
            throw new Error("same-key source command drift");
          }
          existing.commandMessageIds.add(message.messageId);
        } else {
          dispatched.set(tuple.executionKey, {
            attempt: tuple.attempt,
            acknowledgmentReceiver: tuple.acknowledgmentReceiver,
            commandMessageIds: new Set([message.messageId]),
            payload: message.data,
          });
        }
        console.log(JSON.stringify({ requestId: request.requestId, ok: true } satisfies WorkerResponse));
        continue;
      }
      if (request.op === "rotate-peer") {
        if (role !== "executor" || !request.peer) throw new Error("peer rotation belongs to executor");
        previousPeer = currentPeer;
        previousPeerExpiresAt = tick + (request.previousGraceTicks ?? 0);
        currentPeer = request.peer;
        console.log(JSON.stringify({ requestId: request.requestId, ok: true } satisfies WorkerResponse));
        continue;
      }
      if (request.op === "cancel") {
        if (role !== "source" || !request.executionKey) throw new Error("cancellation belongs to source");
        if (acknowledgments.has(request.executionKey)) throw new Error("cannot cancel after authenticated execution");
        cancelled.add(request.executionKey);
        console.log(JSON.stringify({ requestId: request.requestId, ok: true } satisfies WorkerResponse));
        continue;
      }
      if (request.op === "retry-ack") {
        if (role !== "executor" || !request.executionKey) throw new Error("ack retry belongs to executor");
        const execution = executions.get(request.executionKey);
        if (!execution?.acknowledgment) throw new Error("unknown execution key");
        console.log(
          JSON.stringify({
            requestId: request.requestId,
            ok: true,
            outbound: execution.acknowledgment,
          } satisfies WorkerResponse),
        );
        continue;
      }
      if (request.op !== "deliver" || !request.message) throw new Error("deliver requires one serialized message");
      const message = request.message;
      validateEnvelope(message, role);

      if (role === "executor") {
        const tuple = decodeTuple<SettlementCommandTuple>(message.data);
        if (tuple.version !== 1 || !tuple.executionKey || tuple.attempt <= 0)
          throw new Error("malformed command tuple");
        if (tuple.recipients.length !== tuple.amounts.length || tuple.recipients.length === 0) {
          throw new Error("malformed recipient/amount vectors");
        }
        if (
          tuple.isBatch &&
          (tuple.batchKinds.length !== tuple.amounts.length || tuple.batchKinds.some((kind) => kind !== tuple.kind))
        ) {
          throw new Error("batch kind mixing is forbidden");
        }
        const authorizedPeer =
          message.sender.toLowerCase() === currentPeer.toLowerCase() ||
          (message.sender.toLowerCase() === previousPeer.toLowerCase() && tick <= previousPeerExpiresAt);
        if (!authorizedPeer || message.sourceChainSelector !== DUAL_CHAIN.source.selector)
          throw new Error("invalid source peer");
        const existing = executions.get(tuple.executionKey);
        if (existing) {
          const same =
            existing.message.data === message.data &&
            existing.message.sender.toLowerCase() === message.sender.toLowerCase() &&
            existing.message.receiver.toLowerCase() === message.receiver.toLowerCase();
          if (!same) throw new Error("same-key reroute or payload drift");
          console.log(
            JSON.stringify({
              requestId: request.requestId,
              ok: true,
              receipt: receipt(message, tuple.executionKey, "DUPLICATE"),
              outbound: existing.acknowledgment,
            } satisfies WorkerResponse),
          );
          continue;
        }
        const success = tuple.fail !== true;
        if (success) totalValueExecuted += tuple.amounts.reduce((sum, amount) => sum + BigInt(amount), 0n);
        const outbound = acknowledgment(message, tuple, success);
        executions.set(tuple.executionKey, {
          message,
          tuple,
          status: success ? "SUCCESS" : "FAILED",
          acknowledgment: outbound,
        });
        console.log(
          JSON.stringify({
            requestId: request.requestId,
            ok: true,
            receipt: receipt(message, tuple.executionKey, success ? "SUCCESS" : "FAILED"),
            outbound,
          } satisfies WorkerResponse),
        );
      } else {
        const tuple = decodeTuple<SettlementAcknowledgmentTuple>(message.data);
        if (tuple.version !== 1 || tuple.attempt <= 0 || !tuple.executionKey)
          throw new Error("malformed acknowledgment tuple");
        if (
          message.sender.toLowerCase() !== currentPeer.toLowerCase() ||
          message.sourceChainSelector !== DUAL_CHAIN.executor.selector
        ) {
          throw new Error("invalid acknowledgment peer");
        }
        const dispatch = dispatched.get(tuple.executionKey);
        if (!dispatch) throw new Error("acknowledgment has no recorded source command");
        if (
          tuple.attempt !== dispatch.attempt ||
          !dispatch.commandMessageIds.has(tuple.originatingCommandMessageId) ||
          message.receiver.toLowerCase() !== dispatch.acknowledgmentReceiver.toLowerCase()
        ) {
          throw new Error("acknowledgment does not match the recorded source command");
        }
        if (cancelled.has(tuple.executionKey)) throw new Error("acknowledgment arrived after cancellation");
        const existing = acknowledgments.get(tuple.executionKey);
        if (existing) {
          const same = JSON.stringify(existing) === JSON.stringify(tuple);
          console.log(
            JSON.stringify({
              requestId: request.requestId,
              ok: true,
              receipt: receipt(message, tuple.executionKey, same ? "DUPLICATE" : "IGNORED"),
            } satisfies WorkerResponse),
          );
          continue;
        }
        acknowledgments.set(tuple.executionKey, tuple);
        console.log(
          JSON.stringify({
            requestId: request.requestId,
            ok: true,
            receipt: receipt(message, tuple.executionKey, tuple.success ? "SUCCESS" : "FAILED"),
          } satisfies WorkerResponse),
        );
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          requestId: request?.requestId ?? 0,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies WorkerResponse),
      );
    }
  }
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function demo() {
  await Promise.all([waitForChain("source"), waitForChain("executor")]);
  const courier = new DualProcessCourier();
  try {
    const executionKey = keccak256(toUtf8Bytes("dual-chain-demo"));
    const message = commandMessage(
      {
        version: 1,
        executionKey,
        attempt: 1,
        isBatch: false,
        subjectId: "1",
        kind: "GardenBeneficiary",
        batchKinds: [],
        recipients: ["0x000000000000000000000000000000000000b001"],
        amounts: ["1"],
        acknowledgmentReceiver: "0x000000000000000000000000000000000000a001",
      },
      1,
    );
    const execution = await courier.deliver(message);
    if (!execution.outbound) throw new Error("executor did not emit an acknowledgment tuple");
    const acknowledgment = await courier.deliver(execution.outbound);
    console.log(JSON.stringify({ command: execution.receipt, acknowledgment: acknowledgment.receipt }, null, 2));
  } finally {
    courier.stop();
  }
}

async function main() {
  const command = process.argv[2];
  if (!command || process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
Two-process settlement courier

Usage:
  bun run settlement:dual-chain:up
  bun run settlement:dual-chain:down
  bun run settlement:courier

Commands:
  up       Start isolated Anvil chain 421614 on :3012 and chain 11142220 on :3013
  down     Stop only the two PIDs recorded under .generated/runtime
  courier  Relay one serialized command and acknowledgment through isolated worker processes

Only message tuples and delivery receipts cross the worker boundary. No canonical deployment
artifact is created or mutated.
`);
    return;
  }
  if (command === "up") {
    await startDualChains({ persistent: true });
    console.log(
      `Dual chains ready: ${rpcUrl("source")} (${DUAL_CHAIN.source.chainId}), ${rpcUrl("executor")} (${DUAL_CHAIN.executor.chainId})`,
    );
  } else if (command === "down") {
    await stopDualChains();
    console.log("Dual-chain processes stopped");
  } else if (command === "courier") {
    await demo();
  } else if (command === "worker") {
    const role = option(process.argv, "--role");
    const workerRpcUrl = option(process.argv, "--rpc-url");
    if ((role !== "source" && role !== "executor") || !workerRpcUrl)
      throw new Error("worker requires --role and --rpc-url");
    await worker(role, workerRpcUrl);
  } else {
    throw new Error(`Unknown courier command ${command}`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
