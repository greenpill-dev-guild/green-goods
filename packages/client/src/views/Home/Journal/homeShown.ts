import { createContext } from "react";

/**
 * Whether Home shows. It turns false while a page Home opened is on screen and the journal waits
 * under it, mounted but out of sight, so Home can come back where it was. A sheet a section opens
 * from its own state portals into <body>, past Home's hidden wrapper, so the section closes it as
 * this turns false, as Home closes its own drawers.
 */
export const HomeShownContext = createContext(true);
