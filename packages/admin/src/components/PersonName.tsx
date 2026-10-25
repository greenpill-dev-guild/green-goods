import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";

interface PersonNameProps {
  address: Address;
  className?: string;
  /** For a caller that builds its own element around the name, such as a chip. */
  children?: (name: string) => ReactNode;
}

/**
 * What the cockpit calls a person in a line of text: the name the shared address display
 * resolves (their Green Goods name, then their ENS name, then a short address, never a raw
 * hex string), so a confirmer chip, a member suggestion, a Review Promises row and a person
 * row name the same person the same way (DL-112), in one style (PRD-1025 D11): 14px
 * semibold sans.
 */
export function PersonName({ address, className, children }: PersonNameProps) {
  return (
    <AddressDisplay address={address}>
      {(name) =>
        children ? (
          children(name)
        ) : (
          <span
            data-component="PersonName"
            className={cn("truncate type-body font-semibold text-text-strong", className)}
            title={`${name} · ${address}`}
          >
            {name}
          </span>
        )
      }
    </AddressDisplay>
  );
}
