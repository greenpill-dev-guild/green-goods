/**
 * Event handler entry point -- re-exports all domain handler modules.
 *
 * Each handler file registers its own Envio v3 event handlers at import time.
 * `config.yaml` points every contract at this stable entry point.
 *
 * The actual handler logic lives in src/handlers/:
 *   actionRegistry.ts  -- ActionRegistry events
 *   garden.ts          -- GardenToken + GardenAccount events
 *   hatsModule.ts      -- HatsModule role events
 *   octantVault.ts     -- OctantModule + OctantVault events
 *   hypercerts.ts      -- HypercertMinter events
 *   greenWill.ts       -- GreenWill badge events
 *   yieldSplitter.ts   -- YieldSplitter split events
 *   cookieJarFactory.ts -- Shared campaign Cookie Jar discovery
 */
import "./handlers/actionRegistry";
import "./handlers/garden";
import "./handlers/hatsModule";
import "./handlers/octantVault";
import "./handlers/hypercerts";
import "./handlers/greenWill";
import "./handlers/yieldSplitter";
import "./handlers/cookieJarFactory";
import "./handlers/settlement";
