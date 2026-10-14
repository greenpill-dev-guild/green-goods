import * as z from "zod";

type Hex = `0x${string}`;
export const hexOf = (pattern: RegExp, message: string) =>
  z.custom<Hex>((value) => typeof value === "string" && pattern.test(value), message);
export const hex = hexOf(/^0x[0-9a-fA-F]*$/, "Expected hex data");
export const address = hexOf(/^0x[0-9a-fA-F]{40}$/, "Expected an address");
export const digest = hexOf(/^0x[0-9a-f]{64}$/, "Expected a 32-byte digest");
