import * as z from "zod";
import { address, digest, hex, hexOf } from "./api-values";

/** Activation carries only the browser-prepared operation, never an owner enable signature. */
const rpcQuantity = hexOf(/^0x[0-9a-fA-F]{1,64}$/, "Expected an RPC quantity");
export const grantActivationOperationSchema = z
  .object({
    sender: address,
    nonce: rpcQuantity,
    callData: hex,
    callGasLimit: rpcQuantity,
    verificationGasLimit: rpcQuantity,
    preVerificationGas: rpcQuantity,
    maxFeePerGas: rpcQuantity,
    maxPriorityFeePerGas: rpcQuantity,
    paymaster: address,
    paymasterVerificationGasLimit: rpcQuantity,
    paymasterPostOpGasLimit: rpcQuantity,
    paymasterData: hex,
  })
  .strict();
export const grantActivationSignatureRequestSchema = z
  .object({
    attemptId: z.string(),
    permitVersion: z.number().int().min(0),
    payloadDigest: digest,
    userOperation: grantActivationOperationSchema,
  })
  .strict();
export const grantActivationSignatureResponseSchema = z.object({
  ok: z.literal(true),
  delegateSignature: hex,
});
export type GrantActivationOperation = z.infer<typeof grantActivationOperationSchema>;
export type GrantActivationSignatureRequest = z.infer<typeof grantActivationSignatureRequestSchema>;
