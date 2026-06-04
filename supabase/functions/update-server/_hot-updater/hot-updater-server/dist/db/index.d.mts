import { CreateBundleDiffDependencies, CreateBundleDiffInput, CreateBundleDiffOptions, createBundleDiff } from "./createBundleDiff.mjs";
import { HandlerRoutes } from "../handler.mjs";
import { HotUpdaterClient, HotUpdaterDB, Migrator } from "./ormCore.mjs";
import { HOT_UPDATER_SERVER_VERSION } from "../version.mjs";
import { DatabaseAPI, DatabaseAdapter, StoragePluginFactory } from "./types.mjs";
import { HotUpdaterContext, RuntimeStoragePlugin } from "@hot-updater/plugin-core";

//#region src/db/index.d.ts
type HotUpdaterAPI<TContext = unknown> = DatabaseAPI<TContext> & {
  basePath: string;
  handler: (request: Request, context?: HotUpdaterContext<TContext>) => Promise<Response>;
  adapterName: string;
  createMigrator: () => Migrator;
  generateSchema: HotUpdaterClient["generateSchema"];
};
interface CreateHotUpdaterOptions<TContext = unknown> {
  database: DatabaseAdapter<TContext>;
  /**
   * Storage plugins for handling file uploads and downloads.
   */
  storages?: (RuntimeStoragePlugin<TContext> | StoragePluginFactory<TContext>)[];
  /**
   * @deprecated Use `storages` instead. This field will be removed in a future version.
   */
  storagePlugins?: (RuntimeStoragePlugin<TContext> | StoragePluginFactory<TContext>)[];
  basePath?: string;
  cwd?: string;
  routes?: HandlerRoutes;
}
declare function createHotUpdater<TContext = unknown>(options: CreateHotUpdaterOptions<TContext>): HotUpdaterAPI<TContext>;
//#endregion
export { CreateHotUpdaterOptions, HotUpdaterAPI, createHotUpdater };