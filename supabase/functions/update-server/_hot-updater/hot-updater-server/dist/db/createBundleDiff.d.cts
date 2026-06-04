import { Bundle, DatabasePlugin, NodeStoragePlugin } from "@hot-updater/plugin-core";

//#region src/db/createBundleDiff.d.ts
interface CreateBundleDiffInput {
  baseBundleId: string;
  bundleId: string;
}
interface CreateBundleDiffDependencies {
  databasePlugin: DatabasePlugin;
  storagePlugin: NodeStoragePlugin | null;
}
interface CreateBundleDiffOptions {
  makePrimary?: boolean;
}
declare function createBundleDiff({
  baseBundleId,
  bundleId
}: CreateBundleDiffInput, deps: CreateBundleDiffDependencies, options?: CreateBundleDiffOptions): Promise<Bundle>;
//#endregion
export { CreateBundleDiffDependencies, CreateBundleDiffInput, CreateBundleDiffOptions, createBundleDiff };