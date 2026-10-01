import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import { formatEnsAddressName } from "./EnsAddressText";

interface PersonNameProps {
  address: Address;
  className?: string;
  /** For a caller that builds its own element around the name, such as a chip. */
  children?: (name: string) => ReactNode;
}

/**
 * What the cockpit calls a person: their Green Goods name, then their ENS name,
 * then a short address, never a raw hex string. One lookup, so a confirmer
 * chip, a member suggestion and a row waiting for approval name the same
 * person the same way, in one style (PRD-1025 D11): 14px semibold sans.
 */
export function PersonName({ address, className, children }: PersonNameProps) {
  const { data: protocolName } = useGreenGoodsEnsName(address);
  const { data: ensName } = useEnsName(protocolName ? null : address);
  const name = formatEnsAddressName(address, protocolName ?? ensName);
  if (children) return <>{children(name)}</>;
  return (
    <span
      data-component="PersonName"
      className={cn("truncate body-sm font-semibold text-text-strong", className)}
      title={name === address ? address : `${name} · ${address}`}
    >
      {name}
    </span>
  );
}
