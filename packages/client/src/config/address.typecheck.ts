// Compile-only contract: the app project includes this file; runtime code must not import it.
// Address constrains a hex prefix, while external input still needs runtime address validation.
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
