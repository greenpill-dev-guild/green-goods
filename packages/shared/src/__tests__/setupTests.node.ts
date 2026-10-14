/**
 * Shared Node project setup: the Node-safe core without Testing Library, jest-dom or React DOM,
 * which no Node test uses and every Node test file used to import.
 */

import { setupCoreTestEnvironment } from "./setupTests.core";

setupCoreTestEnvironment();
