#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
declare class GreenGoodsMCPServer {
    private server;
    constructor();
    private setupHandlers;
    runStdio(): Promise<void>;
    runHttp(port: number): Promise<void>;
    getServer(): Server;
}
export { GreenGoodsMCPServer };
