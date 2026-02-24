/**
 * Event handler entry point -- re-exports all domain handler modules.
 *
 * Each handler file registers its own Envio event handlers at import time
 * (side-effect imports). The generated code (Generated.res.js) requires this
 * file path at runtime, so it must stay as the stable entry point.
 *
 * The actual handler logic lives in src/handlers/:
 *   actionRegistry.ts  -- ActionRegistry events
 *   garden.ts          -- GardenToken + GardenAccount events
 *   hatsModule.ts      -- HatsModule role events
 *   octantVault.ts     -- OctantModule + OctantVault events
 *   hypercerts.ts      -- HypercertMinter events
 *   yieldSplitter.ts   -- YieldSplitter split events
 */
import "./handlers/actionRegistry";
import "./handlers/garden";
import "./handlers/hatsModule";
import "./handlers/octantVault";
import "./handlers/hypercerts";
import "./handlers/yieldSplitter";
