// Compile-only guard for the app graph, including the Hypercert SDK's Safe declarations.
// Runtime code must not import this file; external addresses still require validation.
import type { Address } from "viem";
import type { Address as DomainAddress } from "@green-goods/shared/types/domain";

declare const acceptAddress: (address: Address) => void;
declare const externalText: string;
declare const domainAddress: DomainAddress;

acceptAddress(domainAddress);
acceptAddress("0x1234567890123456789012345678901234567890");
// @ts-expect-error -- ordinary names must not become addresses
acceptAddress("community-garden");
// @ts-expect-error -- external strings require validation or narrowing
acceptAddress(externalText);
// @ts-expect-error -- numbers are not addresses
acceptAddress(42);
// @ts-expect-error -- absent addresses must be handled explicitly
acceptAddress(null);
