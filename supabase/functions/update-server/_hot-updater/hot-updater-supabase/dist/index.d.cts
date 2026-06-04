import { i as supabaseEdgeFunctionDatabase, n as supabaseEdgeFunctionStorage, r as SupabaseEdgeFunctionDatabaseConfig, t as SupabaseEdgeFunctionStorageConfig } from "./supabaseEdgeFunctionStorage-CU396KO3.cjs";
import * as _$_hot_updater_plugin_core0 from "@hot-updater/plugin-core";

//#region src/supabaseConfig.d.ts
type SupabaseServiceRoleConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey?: string;
} | {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
};
//#endregion
//#region src/supabaseDatabase.d.ts
type SupabaseDatabaseConfig = SupabaseServiceRoleConfig;
declare const supabaseDatabase: (config: SupabaseServiceRoleConfig, hooks?: _$_hot_updater_plugin_core0.DatabasePluginHooks) => () => _$_hot_updater_plugin_core0.DatabasePlugin<unknown>;
//#endregion
//#region src/supabaseStorage.d.ts
type SupabaseStorageConfig = SupabaseServiceRoleConfig & {
  bucketName: string;
  /**
   * Base path where bundles will be stored in the bucket
   */
  basePath?: string;
};
declare const supabaseStorage: (config: SupabaseStorageConfig, hooks?: _$_hot_updater_plugin_core0.StoragePluginHooks) => () => _$_hot_updater_plugin_core0.UniversalStoragePlugin<unknown>;
//#endregion
export { SupabaseDatabaseConfig, SupabaseEdgeFunctionDatabaseConfig, SupabaseEdgeFunctionStorageConfig, SupabaseStorageConfig, supabaseDatabase, supabaseEdgeFunctionDatabase, supabaseEdgeFunctionStorage, supabaseStorage };