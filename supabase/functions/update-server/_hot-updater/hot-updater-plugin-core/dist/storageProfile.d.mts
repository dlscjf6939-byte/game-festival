import { NodeStoragePlugin, RuntimeStoragePlugin, StoragePlugin } from "./types/index.mjs";

//#region src/storageProfile.d.ts
declare const isNodeStoragePlugin: <TContext = unknown>(plugin: StoragePlugin<TContext>) => plugin is NodeStoragePlugin<TContext>;
declare const isRuntimeStoragePlugin: <TContext = unknown>(plugin: StoragePlugin<TContext>) => plugin is RuntimeStoragePlugin<TContext>;
declare function assertNodeStoragePlugin<TContext = unknown>(plugin: StoragePlugin<TContext>): asserts plugin is NodeStoragePlugin<TContext>;
declare function assertRuntimeStoragePlugin<TContext = unknown>(plugin: StoragePlugin<TContext>): asserts plugin is RuntimeStoragePlugin<TContext>;
//#endregion
export { assertNodeStoragePlugin, assertRuntimeStoragePlugin, isNodeStoragePlugin, isRuntimeStoragePlugin };