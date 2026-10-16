#!/usr/bin/env node
// klipp            start the app (http://localhost:4747)
// klipp mcp        MCP server for agents (stdio)
const cmd = process.argv[2];
if (cmd === "mcp") await import("../server/mcp.js");
else if (!cmd || cmd === "start") { const { startServer } = await import("../server/index.js"); await startServer(); }
else { console.error("Benutzung: klipp [start|mcp]"); process.exit(1); }
