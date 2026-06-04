import { HotUpdaterAPI } from "./db/index.cjs";
//#region src/node.d.ts
/**
 * Converts a Hot Updater handler to a Node.js-compatible middleware
 * Works with Express, Connect, and other frameworks using Node.js req/res
 *
 * @example
 * ```typescript
 * import { toNodeHandler } from "@hot-updater/server/node";
 * import express from "express";
 *
 * const app = express();
 *
 * // Mount middleware
 * app.use(express.json());
 *
 * // Mount hot-updater handler
 * app.all("/hot-updater/*", toNodeHandler(hotUpdater));
 * ```
 */
declare function toNodeHandler(hotUpdater: HotUpdaterAPI): (req: any, res: any, next?: any) => Promise<void>;
//#endregion
export { toNodeHandler };