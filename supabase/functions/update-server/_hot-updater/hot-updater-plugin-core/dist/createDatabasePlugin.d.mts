import { DatabaseBundleQueryOptions, DatabasePlugin, DatabasePluginHooks, HotUpdaterContext, Paginated } from "./types/index.mjs";
import { Bundle, GetBundlesArgs, UpdateInfo } from "@hot-updater/core";

//#region src/createDatabasePlugin.d.ts
interface AbstractDatabasePlugin<TContext = unknown> {
  supportsCursorPagination?: boolean;
  getBundleById: (bundleId: string, context?: HotUpdaterContext<TContext>) => Promise<Bundle | null>;
  getUpdateInfo?: (args: GetBundlesArgs, context?: HotUpdaterContext<TContext>) => Promise<UpdateInfo | null>;
  getBundles: (options: DatabaseBundleQueryOptions & {
    offset?: number;
  }, context?: HotUpdaterContext<TContext>) => Promise<Paginated<Bundle[]>>;
  getChannels: (context?: HotUpdaterContext<TContext>) => Promise<string[]>;
  onUnmount?: () => Promise<void>;
  commitBundle: (params: {
    changedSets: {
      operation: "insert" | "update" | "delete";
      data: Bundle;
    }[];
  }, context?: HotUpdaterContext<TContext>) => Promise<void>;
}
/**
 * Database plugin methods without name
 */
type DatabasePluginMethods<TContext = unknown> = Omit<AbstractDatabasePlugin<TContext>, never>;
/**
 * Factory function that creates database plugin methods
 */
type DatabasePluginFactory<TConfig, TContext = unknown> = (config: TConfig) => DatabasePluginMethods<TContext>;
/**
 * Configuration options for creating a database plugin
 */
interface CreateDatabasePluginOptions<TConfig, TContext = unknown> {
  /**
   * The name of the database plugin (e.g., "postgres", "d1Database")
   */
  name: string;
  /**
   * Function that creates the database plugin methods
   */
  factory: DatabasePluginFactory<TConfig, TContext>;
}
/**
 * Creates a database plugin with lazy initialization and automatic hook execution.
 *
 * This factory function abstracts the double currying pattern used by all database plugins,
 * ensuring consistent lazy initialization behavior across different database providers.
 * Hooks are automatically executed at appropriate times without requiring manual invocation.
 *
 * @param options - Configuration options for the database plugin
 * @returns A double-curried function that lazily initializes the database plugin
 *
 * @example
 * ```typescript
 * export const postgres = createDatabasePlugin<PostgresConfig>({
 *   name: "postgres",
 *   factory: (config) => {
 *     const db = new Kysely(config);
 *     return {
 *       async getBundleById(bundleId) { ... },
 *       async getBundles(options) { ... },
 *       async getChannels() { ... },
 *       async commitBundle({ changedSets }) { ... }
 *     };
 *   }
 * });
 * ```
 */
declare function createDatabasePlugin<TConfig, TContext = unknown>(options: CreateDatabasePluginOptions<TConfig, TContext>): (config: TConfig, hooks?: DatabasePluginHooks) => (() => DatabasePlugin<TContext>);
//#endregion
export { AbstractDatabasePlugin, CreateDatabasePluginOptions, createDatabasePlugin };