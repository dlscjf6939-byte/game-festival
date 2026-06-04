import { NodeStoragePlugin, NodeStorageProfile, RuntimeStoragePlugin, RuntimeStorageProfile, StoragePluginHooks, StoragePluginProfiles, UniversalStoragePlugin } from "./types/index.mjs";

//#region src/createStoragePlugin.d.ts
type StorageProfileFactory<TConfig, TProfiles> = (config: TConfig) => TProfiles;
interface BaseStoragePluginOptions<TConfig, TContext = unknown, TProfiles extends StoragePluginProfiles<TContext> = StoragePluginProfiles<TContext>> {
  /**
   * The name of the storage plugin (e.g., "s3Storage", "r2Storage").
   */
  name: string;
  /**
   * The protocol that this storage plugin supports (e.g., "s3", "r2", "gs").
   *
   * This value is stored in the database and is used by the server to
   * understand how to fetch assets.
   */
  supportedProtocol: string;
  /**
   * Function that creates the storage plugin profiles.
   */
  factory: StorageProfileFactory<TConfig, TProfiles>;
}
type CreateNodeStoragePluginOptions<TConfig> = Omit<BaseStoragePluginOptions<TConfig, unknown, {
  node: NodeStorageProfile;
}>, "factory"> & {
  factory: StorageProfileFactory<TConfig, NodeStorageProfile>;
};
type CreateRuntimeStoragePluginOptions<TConfig, TContext = unknown> = Omit<BaseStoragePluginOptions<TConfig, TContext, {
  runtime: RuntimeStorageProfile<TContext>;
}>, "factory"> & {
  factory: StorageProfileFactory<TConfig, RuntimeStorageProfile<TContext>>;
};
type CreateUniversalStoragePluginOptions<TConfig, TContext = unknown> = Omit<BaseStoragePluginOptions<TConfig, TContext, {
  node: NodeStorageProfile;
  runtime: RuntimeStorageProfile<TContext>;
}>, "factory"> & {
  factory: StorageProfileFactory<TConfig, {
    node: NodeStorageProfile;
    runtime: RuntimeStorageProfile<TContext>;
  }>;
};
/**
 * Creates a deploy/CLI/console storage plugin.
 */
declare const createNodeStoragePlugin: <TConfig>(options: CreateNodeStoragePluginOptions<TConfig>) => (config: TConfig, hooks?: StoragePluginHooks) => () => NodeStoragePlugin;
/**
 * Creates an update-check runtime storage plugin.
 */
declare const createRuntimeStoragePlugin: <TConfig, TContext = unknown>(options: CreateRuntimeStoragePluginOptions<TConfig, TContext>) => (config: TConfig, hooks?: StoragePluginHooks) => () => RuntimeStoragePlugin<TContext>;
/**
 * Creates a storage plugin that can be used by both Node tooling and update
 * check runtimes.
 */
declare const createUniversalStoragePlugin: <TConfig, TContext = unknown>(options: CreateUniversalStoragePluginOptions<TConfig, TContext>) => (config: TConfig, hooks?: StoragePluginHooks) => () => UniversalStoragePlugin<TContext>;
//#endregion
export { createNodeStoragePlugin, createRuntimeStoragePlugin, createUniversalStoragePlugin };