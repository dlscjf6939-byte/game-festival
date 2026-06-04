import { HandlerRoutes, createHandler } from "./handler.cjs";
import { HOT_UPDATER_SERVER_VERSION } from "./version.cjs";
import { DatabaseAPI, DatabaseAdapter, StoragePluginFactory } from "./db/types.cjs";
import { HotUpdaterContext, RuntimeStoragePlugin } from "@hot-updater/plugin-core";

//#region src/runtime.d.ts
type HotUpdaterAPI<TContext = unknown> = DatabaseAPI<TContext> & {
  basePath: string;
  handler: (request: Request, context?: HotUpdaterContext<TContext>) => Promise<Response>;
  adapterName: string;
};
interface CreateHotUpdaterOptions<TContext = unknown> {
  database: DatabaseAdapter<TContext>;
  storages?: (RuntimeStoragePlugin<TContext> | StoragePluginFactory<TContext>)[];
  storagePlugins?: (RuntimeStoragePlugin<TContext> | StoragePluginFactory<TContext>)[];
  basePath?: string;
  cwd?: string;
  routes?: HandlerRoutes;
}
declare function createHotUpdater<TContext = unknown>(options: CreateHotUpdaterOptions<TContext>): HotUpdaterAPI<TContext>;
//#endregion
export { CreateHotUpdaterOptions, HOT_UPDATER_SERVER_VERSION, HotUpdaterAPI, createHandler, createHotUpdater };