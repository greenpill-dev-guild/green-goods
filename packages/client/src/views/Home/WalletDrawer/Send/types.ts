import type { Address, GardenRole, SendableTokenBalance } from "@green-goods/shared";

/** The three steps of the send flow inside the wallet drawer. */
export type SendStep = "recipient" | "amount" | "review";

/** How the recipient was chosen — drives the recent-recipients label/source. */
export type RecipientSource = "garden" | "recent" | "manual" | "ens" | "qr";

/** A recipient selected in step 1. */
export interface SelectedRecipient {
  address: Address;
  source: RecipientSource;
  /** ENS name when resolved/known, for display. */
  ensName?: string;
  /** Roles held in the originating garden, when picked from the directory. */
  roles?: GardenRole[];
  /** Garden the recipient was picked from, for display context. */
  gardenName?: string;
}

export type SendableToken = SendableTokenBalance;
