import type { PublicationEnvelope } from "@green-goods/shared/modules/agent-reporting";
import { type Hex, keccak256, toHex } from "viem";
import type { DelegatedSender } from "../../../services/reporting/delegated";
import type { GrantRecord } from "../../../services/reporting/grants-store";
import type { FakeChain } from "./fake-chain";

/**
 * A delegated signer double. It "signs" by recording the exact call and submits it to the fake
 * chain as the Kernel account, as a bundler would include a UserOperation. It proves executor
 * orchestration only: no Kernel module, permission validator or bundler is exercised.
 */
export class FakeDelegatedSender implements DelegatedSender {
  readonly signerAddress = "0x000000000000000000000000000000000000d5d5" as const;
  signed = 0;
  submitted = 0;
  failSigning = false;
  loseSubmitResponse = false;

  constructor(private readonly chain: FakeChain) {}

  async sign(input: { grant: GrantRecord; envelope: PublicationEnvelope }) {
    if (this.failSigning) throw new Error("signer unavailable");
    this.signed += 1;
    const userOperationHash = keccak256(
      toHex(`delegated-${this.signed}-${input.envelope.payloadDigest}`)
    );
    return {
      userOperationHash,
      signedOperation: JSON.stringify({
        hash: userOperationHash,
        account: input.grant.policy.account,
        to: input.envelope.call.to,
        data: input.envelope.call.data,
      }),
    };
  }

  async signActivation(input: {
    grant: GrantRecord;
    envelope: PublicationEnvelope;
    userOperation: unknown;
  }) {
    const signed = await this.sign(input);
    this.activationOperations.set(signed.userOperationHash, signed.signedOperation);
    return { userOperationHash: signed.userOperationHash, delegateSignature: "0xfade" as Hex };
  }

  readonly activationOperations = new Map<Hex, string>();

  async submit(signedOperation: string) {
    const op = JSON.parse(signedOperation) as { hash: Hex; account: string; to: string; data: Hex };
    this.submitted += 1;
    if (!this.chain.userOperations.has(op.hash)) {
      this.chain.submitUserOperation({
        account: op.account,
        to: op.to,
        data: op.data,
        userOperationHash: op.hash,
      });
    }
    if (this.loseSubmitResponse) throw new Error("bundler response lost");
    return { accepted: true, retryable: false };
  }
}
