import type {} from "abitype";

// The marketplace SDK's Safe types register legacy AddressType: string globally.
// Keep viem's address contract in the Admin graph; runtime validation still owns validity.
declare module "abitype" {
  interface Register {
    addressType: `0x${string}`;
  }
}
