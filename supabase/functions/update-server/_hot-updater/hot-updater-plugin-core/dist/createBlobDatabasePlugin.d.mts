import { DatabasePlugin, DatabasePluginHooks } from "./types/index.mjs";

//#region src/createBlobDatabasePlugin.d.ts
interface BlobDatabasePluginConfig {
  managementIndexPageSize?: number;
}
interface BlobOperations {
  listObjects: (prefix: string) => Promise<string[]>;
  loadObject: <T>(key: string) => Promise<T | null>;
  uploadObject: <T>(key: string, data: T) => Promise<void>;
  deleteObject: (key: string) => Promise<void>;
  invalidatePaths: (paths: string[]) => Promise<void>;
  apiBasePath: string;
}
/**
 * Creates a blob storage-based database plugin with lazy initialization.
 *
 * @param name - The name of the database plugin
 * @param factory - Function that creates blob storage operations from config
 * @returns A double-curried function that lazily initializes the database plugin
 */
declare const createBlobDatabasePlugin: <TConfig>({
  name,
  factory
}: {
  name: string;
  factory: (config: TConfig) => BlobOperations;
}) => (config: TConfig, hooks?: DatabasePluginHooks) => () => DatabasePlugin<unknown>;
//#endregion
export { BlobDatabasePluginConfig, BlobOperations, createBlobDatabasePlugin };