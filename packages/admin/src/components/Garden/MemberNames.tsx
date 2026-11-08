import { useAddressDisplayName } from "@green-goods/shared/hooks/ens/useAddressDisplayName";
import type { Address } from "@green-goods/shared/types/domain";
import { useEffect } from "react";

function NameReader({
  address,
  onName,
}: {
  address: Address;
  onName: (address: Address, name: string | null) => void;
}) {
  // The name a person row shows (DL-112), read with the list's other names in one batch.
  const { preferredName } = useAddressDisplayName(address, { list: true });
  useEffect(() => {
    onName(address, preferredName);
  }, [address, onName, preferredName]);
  return null;
}

/**
 * Reads the name each person's row shows, so a search finds people by the words on screen.
 * Renders nothing; its `onName` feeds a map kept with `withMemberName`.
 */
export function MemberNameReaders({
  addresses,
  onName,
}: {
  addresses: readonly Address[];
  onName: (address: Address, name: string | null) => void;
}) {
  return (
    <>
      {addresses.map((address) => (
        <NameReader key={address.toLowerCase()} address={address} onName={onName} />
      ))}
    </>
  );
}

/**
 * Each person's shown name by lowercase address, with one more read in. Returns the same map
 * when nothing changed, so a state update that changes nothing renders nothing.
 */
export function withMemberName(
  current: ReadonlyMap<string, string>,
  address: Address,
  name: string | null
): ReadonlyMap<string, string> {
  const key = address.toLowerCase();
  if ((current.get(key) ?? null) === name) return current;
  const next = new Map(current);
  if (name) next.set(key, name);
  else next.delete(key);
  return next;
}
