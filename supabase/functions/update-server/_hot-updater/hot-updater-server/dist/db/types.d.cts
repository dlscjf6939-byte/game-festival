import { Provider } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/index-CMqePMTF.cjs";
import { PaginatedResult } from "../types/index.cjs";
import { AppUpdateAvailableInfo, Bundle, GetBundlesArgs, UpdateInfo } from "@hot-updater/core";
import { DatabaseBundleQueryOptions, DatabasePlugin, HotUpdaterContext, RuntimeStoragePlugin } from "@hot-updater/plugin-core";

//#region src/db/types.d.ts
type DatabasePluginFactory<TContext = unknown> = () => DatabasePlugin<TContext>;
type ORMProvider = Provider;
interface ORMDatabaseAdapter {
  name: string;
  provider?: ORMProvider;
  createORM(this: any, schema: any): unknown;
  getSchemaVersion(this: any): Promise<string | undefined>;
  generateSchema?: (this: any, schema: any, schemaName: string) => {
    code: string;
    path: string;
  };
  createMigrationEngine?: (this: any) => unknown;
}
type DatabaseAdapter<TContext = unknown> = ORMDatabaseAdapter | DatabasePlugin<TContext> | DatabasePluginFactory<TContext>;
interface DatabaseAPI<TContext = unknown> {
  getBundleById(id: string, context?: HotUpdaterContext<TContext>): Promise<Bundle | null>;
  getUpdateInfo(args: GetBundlesArgs, context?: HotUpdaterContext<TContext>): Promise<UpdateInfo | null>;
  getAppUpdateInfo(args: GetBundlesArgs, context?: HotUpdaterContext<TContext>): Promise<AppUpdateAvailableInfo | null>;
  getChannels(context?: HotUpdaterContext<TContext>): Promise<string[]>;
  getBundles(options: DatabaseBundleQueryOptions, context?: HotUpdaterContext<TContext>): Promise<PaginatedResult>;
  insertBundle(bundle: Bundle, context?: HotUpdaterContext<TContext>): Promise<void>;
  updateBundleById(bundleId: string, newBundle: Partial<Bundle>, context?: HotUpdaterContext<TContext>): Promise<void>;
  deleteBundleById(bundleId: string, context?: HotUpdaterContext<TContext>): Promise<void>;
}
type StoragePluginFactory<TContext = unknown> = () => RuntimeStoragePlugin<TContext>;
//#endregion
export { DatabaseAPI, DatabaseAdapter, ORMDatabaseAdapter, StoragePluginFactory };