import { Bundle as Bundle$1, HotUpdaterContext } from "./types/index.cjs";
import { AppVersionGetBundlesArgs, FingerprintGetBundlesArgs, GetBundlesArgs, UpdateInfo } from "@hot-updater/core";

//#region src/createDatabasePluginGetUpdateInfo.d.ts
type AppVersionLookupArgs = {
  channel: string;
  minBundleId: string;
  platform: AppVersionGetBundlesArgs["platform"];
};
type FingerprintLookupArgs = {
  channel: string;
  fingerprintHash: string;
  minBundleId: string;
  platform: FingerprintGetBundlesArgs["platform"];
};
interface CreateDatabasePluginGetUpdateInfoOptions<TContext = unknown> {
  getBundlesByFingerprint: (args: FingerprintLookupArgs, context?: HotUpdaterContext<TContext>) => Promise<Bundle$1[]>;
  getBundlesByTargetAppVersions: (args: AppVersionLookupArgs, targetAppVersions: string[], context?: HotUpdaterContext<TContext>) => Promise<Bundle$1[]>;
  listTargetAppVersions: (args: AppVersionLookupArgs, context?: HotUpdaterContext<TContext>) => Promise<string[]>;
}
declare const createDatabasePluginGetUpdateInfo: <TContext = unknown>({
  getBundlesByFingerprint,
  getBundlesByTargetAppVersions,
  listTargetAppVersions
}: CreateDatabasePluginGetUpdateInfoOptions<TContext>) => (args: GetBundlesArgs, context?: HotUpdaterContext<TContext>) => Promise<UpdateInfo | null>;
//#endregion
export { CreateDatabasePluginGetUpdateInfoOptions, createDatabasePluginGetUpdateInfo };