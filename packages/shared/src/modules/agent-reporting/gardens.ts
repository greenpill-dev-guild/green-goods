import { isGardenHiddenEverywhere } from "../../config/garden-visibility";

/**
 * Every garden accepts chat reports, except the indexer's placeholders for gardens that were never
 * initialized and gardens hidden from every Green Goods surface. Gardens kept only off the public
 * website still work for the people in them, so they accept reports too. Accepting a report is
 * not membership: the reporter's role in the chosen garden is still checked on chain before
 * anything is published.
 */
export function acceptsChatReports(garden: { address: string; initialized: boolean }): boolean {
  return garden.initialized && !isGardenHiddenEverywhere(garden.address);
}
