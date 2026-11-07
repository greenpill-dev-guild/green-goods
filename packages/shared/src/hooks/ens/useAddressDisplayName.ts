/**
 * Address Display Name Hook
 *
 * How the product names a person or a garden account: its Green Goods name, else its ENS
 * name, else its chosen passkey name, else the short address.
 * `AddressDisplay` renders it, and a row that needs the name
 * as text (a detail on an item row) reads it here, so both say the same name.
 *
 * @module hooks/ens/useAddressDisplayName
 */

import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAddress, zeroAddress } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { ensKeys } from "../../config/query-keys/identity";
import { readPasskeyDisplayName } from "../../modules/ens/passkey-display-names";
import { AuthStateContext } from "../../providers/authContext";
import type { Address } from "../../types/domain";
import {
  chosenPasskeyUsername,
  formatAddress,
  formatEnsNameForDisplay,
  type FormatAddressVariant,
} from "../../utils/app/text";
import { useEnsName } from "../blockchain/useEnsName";
import { useGreenGoodsEnsName } from "./useGreenGoodsEnsName";

export interface AddressDisplayName {
  /** The preferred name, once one resolves. */
  preferredName: string | null;
  /** What to show: the preferred name, or the short address while there is none. */
  display: string;
}

export function useAddressDisplayName(
  address?: Address | null,
  {
    list = false,
    variant = "card",
  }: {
    /** One row in a list: its Green Goods name is read with the list's other rows, in one batch. */
    list?: boolean;
    variant?: FormatAddressVariant;
  } = {}
): AddressDisplayName {
  const ens = useEnsName(address);
  const protocol = useGreenGoodsEnsName(address, { list });
  const auth = useContext(AuthStateContext);
  const ownPasskeyName =
    address &&
    auth?.isAuthenticated &&
    address.toLowerCase() === auth.smartAccountAddress?.toLowerCase()
      ? chosenPasskeyUsername(auth.authMode, auth.userName)
      : null;
  const preferredEnsName = protocol.data || ens.data || null;
  const normalized =
    address && isAddress(address, { strict: false }) ? (address.toLowerCase() as Address) : null;
  const { data: directoryName } = useQuery({
    queryKey: ensKeys.passkeyName(DEFAULT_CHAIN_ID, normalized ?? ""),
    queryFn: () => (normalized ? readPasskeyDisplayName(DEFAULT_CHAIN_ID, normalized) : null),
    enabled: Boolean(
      normalized &&
        normalized !== zeroAddress &&
        !preferredEnsName &&
        !ownPasskeyName &&
        !protocol.isFetching &&
        !ens.isFetching
    ),
    staleTime: STALE_TIME_RARE,
    retry: false,
  });
  const passkeyName = ownPasskeyName ?? directoryName ?? null;
  const preferredName = preferredEnsName ?? passkeyName;
  return {
    preferredName,
    display:
      formatEnsNameForDisplay(preferredEnsName) ??
      passkeyName ??
      (address ? formatAddress(address, { variant }) : ""),
  };
}
