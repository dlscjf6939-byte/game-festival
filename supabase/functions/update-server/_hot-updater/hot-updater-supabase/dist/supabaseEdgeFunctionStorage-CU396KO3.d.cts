import * as _$_hot_updater_plugin_core0 from "@hot-updater/plugin-core";
import { DatabasePluginHooks } from "@hot-updater/plugin-core";

//#region src/supabaseEdgeFunctionDatabase.d.ts
interface SupabaseEdgeFunctionDatabaseConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}
declare const supabaseEdgeFunctionDatabase: (config: SupabaseEdgeFunctionDatabaseConfig, hooks?: DatabasePluginHooks) => () => _$_hot_updater_plugin_core0.DatabasePlugin<unknown>;
//#endregion
//#region src/supabaseEdgeFunctionStorage.d.ts
interface SupabaseEdgeFunctionStorageConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  signedUrlExpiresIn?: number;
}
declare const supabaseEdgeFunctionStorage: (config: SupabaseEdgeFunctionStorageConfig, hooks?: _$_hot_updater_plugin_core0.StoragePluginHooks) => () => _$_hot_updater_plugin_core0.RuntimeStoragePlugin<unknown>;
//#endregion
export { supabaseEdgeFunctionDatabase as i, supabaseEdgeFunctionStorage as n, SupabaseEdgeFunctionDatabaseConfig as r, SupabaseEdgeFunctionStorageConfig as t };