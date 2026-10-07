import { decodeAbiParameters, type Hex, keccak256, pad, parseAbiParameters, toHex } from "viem";
import {
  decodeAttestCall,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import {
  ATTESTED_TOPIC,
  type AccountKind,
  type Addr,
  type AttestationView,
  type AttestedEvent,
  type GardenRoles,
  type PublishedWorkView,
  type ReportingChain,
  type TransactionReceiptView,
} from "../../../services/reporting/chain";

/**
 * An in-memory Arbitrum stand-in. It decodes the real EAS `attest` calldata and applies the
 * resolver checks the prototype depends on (gardener or operator for work; operator, same garden
 * and no self-approval for reviews), so tests exercise genuine rejection paths. It proves
 * orchestration only, never live chain or wallet compatibility.
 */
const lower = (value: string) => value.toLowerCase() as Addr;

export class FakeChain implements ReportingChain {
  readonly deployment = resolveReportingDeployment(42161);
  block = 1_000n;
  rpcDown = false;
  readonly roles = new Map<string, GardenRoles>();
  /** Gardens that refuse a join (closed or full), by lowercase address; every other one accepts. */
  readonly closed = new Set<string>();
  readonly masks = new Map<string, number>();
  readonly kernels = new Set<string>();
  readonly receipts = new Map<Hex, TransactionReceiptView>();
  readonly hidden = new Set<Hex>();
  readonly attestations = new Map<Hex, AttestationView>();
  readonly events: AttestedEvent[] = [];
  readonly userOperations = new Map<Hex, Hex>();
  readonly works = new Map<Hex, PublishedWorkView & { approved?: boolean }>();
  /** `${account}:${permissionId}` for permissions the owner has installed. */
  readonly permissions = new Set<string>();
  private nonce = 0;

  grantRole(garden: string, account: string, roles: Partial<GardenRoles>): void {
    this.roles.set(`${lower(garden)}:${lower(account)}`, {
      gardener: false,
      operator: false,
      owner: false,
      ...roles,
    });
  }

  private guard(): void {
    if (this.rpcDown) throw new Error("rpc unavailable");
  }

  async gardenRoles(_chainId: number, garden: string, account: string): Promise<GardenRoles> {
    this.guard();
    return (
      this.roles.get(`${lower(garden)}:${lower(account)}`) ?? {
        gardener: false,
        operator: false,
        owner: false,
      }
    );
  }

  async gardenAcceptsJoin(_chainId: number, garden: string, _account: string): Promise<boolean> {
    this.guard();
    return !this.closed.has(lower(garden));
  }

  async gardenDomainMask(_chainId: number, garden: string): Promise<number | null> {
    this.guard();
    return this.masks.get(lower(garden)) ?? 0b11;
  }

  async accountKind(_chainId: number, account: string): Promise<AccountKind> {
    this.guard();
    return this.kernels.has(lower(account)) ? "kernel" : "eoa";
  }

  async blockNumber(): Promise<bigint> {
    this.guard();
    return this.block;
  }

  async transactionReceipt(_chainId: number, hash: Hex): Promise<TransactionReceiptView | null> {
    this.guard();
    return this.hidden.has(hash) ? null : (this.receipts.get(hash) ?? null);
  }

  async attestation(_chainId: number, uid: Hex): Promise<AttestationView | null> {
    this.guard();
    return this.attestations.get(uid) ?? null;
  }

  async attestedEvents(
    _chainId: number,
    filter: {
      eas: Addr;
      schemaUID: Hex;
      recipient: Addr;
      attester: Addr;
      fromBlock: bigint;
      toBlock: bigint;
    }
  ): Promise<AttestedEvent[]> {
    this.guard();
    return this.events.filter(
      (event) =>
        !this.hidden.has(event.transactionHash) &&
        event.schemaUID === filter.schemaUID &&
        event.recipient === lower(filter.recipient) &&
        event.attester === lower(filter.attester) &&
        event.blockNumber >= filter.fromBlock &&
        event.blockNumber <= filter.toBlock
    );
  }

  async pendingWork(_chainId: number, garden: string): Promise<PublishedWorkView[]> {
    this.guard();
    return [...this.works.values()].filter(
      (work) => work.gardenAddress === lower(garden) && work.approved === undefined
    );
  }

  async work(_chainId: number, uid: Hex): Promise<PublishedWorkView | null> {
    this.guard();
    return this.works.get(uid) ?? null;
  }

  async permissionInstalled(
    _chainId: number,
    account: string,
    permissionId: Hex
  ): Promise<boolean> {
    this.guard();
    return this.permissions.has(`${lower(account)}:${permissionId.toLowerCase()}`);
  }

  private accepts(attester: Addr, schema: Hex, recipient: Addr, data: Hex): boolean {
    const roles = this.roles.get(`${recipient}:${attester}`);
    if (schema === this.deployment.work.schemaUID)
      return Boolean(roles?.gardener || roles?.operator);
    if (schema !== this.deployment.review.schemaUID || !roles?.operator) return false;
    const [, workUID, , , confidence, method] = decodeAbiParameters(
      parseAbiParameters(this.deployment.review.schema),
      data
    );
    const work = this.works.get(workUID as Hex);
    return (
      Boolean(work) &&
      work?.gardenAddress === recipient &&
      work?.gardenerAddress !== attester &&
      Number(confidence) <= 3 &&
      Number(method) <= 15
    );
  }

  /** Includes a transaction calling EAS `attest`. `attester` is the account executing the call. */
  submit(input: { attester: string; to: string; data: Hex; revert?: boolean }): Hex {
    this.nonce += 1;
    this.block += 1n;
    const hash = keccak256(toHex(`tx-${this.nonce}`));
    const blockHash = keccak256(toHex(`block-${this.block}`));
    const attester = lower(input.attester);
    const request = decodeAttestCall(input.data);
    const recipient = lower(request.recipient);
    const ok =
      !input.revert &&
      lower(input.to) === lower(this.deployment.easAddress) &&
      request.value === 0n &&
      this.accepts(attester, request.schema, recipient, request.data);
    if (!ok) {
      this.receipts.set(hash, {
        transactionHash: hash,
        blockHash,
        blockNumber: this.block,
        status: "reverted",
        logs: [],
      });
      return hash;
    }
    const uid = keccak256(toHex(`attestation-${this.nonce}`));
    this.attestations.set(uid, {
      uid,
      schema: request.schema,
      recipient,
      attester,
      expirationTime: request.expirationTime,
      revocable: request.revocable,
      refUID: request.refUID,
      data: request.data,
    });
    const log = {
      address: lower(this.deployment.easAddress),
      topics: [ATTESTED_TOPIC, pad(recipient), pad(attester), request.schema] as const,
      data: uid,
      logIndex: 0,
    };
    this.receipts.set(hash, {
      transactionHash: hash,
      blockHash,
      blockNumber: this.block,
      status: "success",
      logs: [log],
    });
    this.events.push({
      uid,
      recipient,
      attester,
      schemaUID: request.schema,
      transactionHash: hash,
      blockHash,
      blockNumber: this.block,
      logIndex: 0,
    });
    if (request.schema === this.deployment.work.schemaUID) {
      const [actionUID, title, feedback, , media] = decodeAbiParameters(
        parseAbiParameters(this.deployment.work.schema),
        request.data
      );
      this.works.set(uid, {
        workUID: uid,
        gardenAddress: recipient,
        gardenerAddress: attester,
        actionUID: Number(actionUID),
        title: title as string,
        feedback: feedback as string,
        mediaCids: media as string[],
      });
    } else {
      const [, workUID, approved] = decodeAbiParameters(
        parseAbiParameters(this.deployment.review.schema),
        request.data
      );
      const work = this.works.get(workUID as Hex);
      if (work) work.approved = approved as boolean;
    }
    return hash;
  }

  /** A UserOperation bundled into a transaction sent by a bundler; the attester is the account. */
  submitUserOperation(input: { account: string; to: string; data: Hex }): {
    userOperationHash: Hex;
    transactionHash: Hex;
  } {
    const transactionHash = this.submit({
      attester: input.account,
      to: input.to,
      data: input.data,
    });
    const userOperationHash = keccak256(toHex(`userop-${transactionHash}`));
    this.userOperations.set(userOperationHash, transactionHash);
    return { userOperationHash, transactionHash };
  }

  reorg(hash: Hex): void {
    const receipt = this.receipts.get(hash);
    if (receipt)
      this.receipts.set(hash, { ...receipt, blockHash: keccak256(toHex(`reorg-${hash}`)) });
  }
}
