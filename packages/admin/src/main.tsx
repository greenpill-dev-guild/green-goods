import { bootAdmin } from "@/components/Boot/bootAdmin";

import "@/index.css";

// The boot sequence mounts a visible shell before any optional service runs,
// loads the application tree, and turns a startup failure into a recovery
// card instead of an empty root. See components/Boot/bootAdmin.tsx. Below the
// browser minimum the gate at the top of <body> (scripts/lib/browser-minimum-gate.js)
// shows the update screen instead, and the Hub does not start behind it.
if (!document.documentElement.hasAttribute("data-browser-update")) void bootAdmin();
