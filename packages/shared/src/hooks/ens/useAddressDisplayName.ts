/**
 * Address Display Name Hook
 *
 * How the product names a person or a garden account: its Green Goods name, else its ENS
 * name, else the short address. `AddressDisplay` renders it, and a row that needs the name
 * as text (a detail on an item row) reads it here, so both say the same name.
 *
 * @module hooks/ens/useAddressDisplayName
 */

import type { Address } from "../../types/domain";
import { formatAddress } from "../../utils/app/text";
import { useEnsName } from "../blockchain/useEnsName";
import { useGreenGoodsEnsName } from "./useGreenGoodsEnsName";

export interface AddressDisplayName {
  /** The Green Goods or ENS name, once one resolves. */
  preferredName: string | null;
  /** What to show: the preferred name, or the short address while there is none. */
  display: string;
}

export function useAddressDisplayName(
  address?: Address | null,
  {
    list = false,
  }: {
    /** One row in a list: its Green Goods name is read with the list's other rows, in one batch. */
    list?: boolean;
  } = {}
): AddressDisplayName {
  const { data: ensName } = useEnsName(address);
  const { data: protocolName } = useGreenGoodsEnsName(address, { list });
  const preferredName = protocolName || ensName || null;
  return {
    preferredName,
    display: address
      ? formatAddress(address, {
          ensName: preferredName,
          variant: preferredName ? "default" : "card",
        })
      : "",
  };
}
