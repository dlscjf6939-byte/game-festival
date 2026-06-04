import { PaginatedResult } from "./types/index.mjs";
import { DatabaseBundleQueryOptions, HotUpdaterContext } from "@hot-updater/plugin-core";
import { AppUpdateAvailableInfo, AppVersionGetBundlesArgs, Bundle as Bundle$1, FingerprintGetBundlesArgs } from "@hot-updater/core";

//#region src/handler.d.ts
interface HandlerAPI<TContext = unknown> {
  getAppUpdateInfo: (args: AppVersionGetBundlesArgs | FingerprintGetBundlesArgs, context?: HotUpdaterContext<TContext>) => Promise<AppUpdateAvailableInfo | null>;
  getBundleById: (id: string, context?: HotUpdaterContext<TContext>) => Promise<Bundle$1 | null>;
  getBundles: (options: DatabaseBundleQueryOptions, context?: HotUpdaterContext<TContext>) => Promise<PaginatedResult>;
  insertBundle: (bundle: Bundle$1, context?: HotUpdaterContext<TContext>) => Promise<void>;
  updateBundleById: (bundleId: string, bundle: Partial<Bundle$1>, context?: HotUpdaterContext<TContext>) => Promise<void>;
  deleteBundleById: (bundleId: string, context?: HotUpdaterContext<TContext>) => Promise<void>;
  getChannels: (context?: HotUpdaterContext<TContext>) => Promise<string[]>;
}
interface HandlerOptions {
  /**
   * Base path for all routes
   * @default "/api"
   */
  basePath?: string;
  /**
   * Route groups to mount. Omit this option to use the default route groups.
   * When provided, both route groups must be specified explicitly.
   * The `/version` endpoint is always mounted for diagnostics.
   */
  routes?: HandlerRoutes;
}
interface HandlerRoutes {
  /**
   * Controls whether update-check routes are mounted.
   * Defaults to `true` only when `routes` is omitted.
   */
  updateCheck: boolean;
  /**
   * Controls whether bundle management routes are mounted.
   * This includes `/api/bundles*`, which are used by the
   * CLI `standaloneRepository` plugin.
   * Defaults to `false` only when `routes` is omitted.
   */
  bundles: boolean;
}
/**
 * Creates a Web Standard Request handler for Hot Updater API
 * This handler is framework-agnostic and works with any runtime that
 * supports standard Request/Response objects.
 */
declare function createHandler<TContext = unknown>(api: HandlerAPI<TContext>, options?: HandlerOptions): (request: Request, context?: HotUpdaterContext<TContext>) => Promise<Response>;
//#endregion
export { HandlerAPI, HandlerOptions, HandlerRoutes, createHandler };