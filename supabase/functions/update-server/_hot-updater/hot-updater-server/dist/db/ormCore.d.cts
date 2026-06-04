import { Column, ExplicitRelation, IdColumn, Schema, Table } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/create-tg0451Y_.cjs";
import { FumaDBFactory, InferFumaDB } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/index.cjs";
import { HotUpdaterContext } from "@hot-updater/plugin-core";

//#region src/db/ormCore.d.ts
declare const HotUpdaterDB: FumaDBFactory<[Schema<"0.21.0", {
  bundles: Table<{
    id: IdColumn<"uuid", string, string>;
    platform: Column<"string", string, string>;
    should_force_update: Column<"bool", boolean, boolean>;
    enabled: Column<"bool", boolean, boolean>;
    file_hash: Column<"string", string, string>;
    git_commit_hash: Column<"string", string | null, string | null>;
    message: Column<"string", string | null, string | null>;
    channel: Column<"string", string | null, string>;
    storage_uri: Column<"string", string, string>;
    target_app_version: Column<"string", string | null, string | null>;
    fingerprint_hash: Column<"string", string | null, string | null>;
    metadata: Column<"json", unknown, unknown>;
  }, {}>;
}>, Schema<"0.29.0", {
  bundles: Table<{
    id: IdColumn<"uuid", string, string>;
    platform: Column<"string", string, string>;
    should_force_update: Column<"bool", boolean, boolean>;
    enabled: Column<"bool", boolean, boolean>;
    file_hash: Column<"string", string, string>;
    git_commit_hash: Column<"string", string | null, string | null>;
    message: Column<"string", string | null, string | null>;
    channel: Column<"string", string | null, string>;
    storage_uri: Column<"string", string, string>;
    target_app_version: Column<"string", string | null, string | null>;
    fingerprint_hash: Column<"string", string | null, string | null>;
    metadata: Column<"json", unknown, unknown>;
    rollout_cohort_count: Column<"integer", number | null, number>;
    target_cohorts: Column<"json", unknown, unknown>;
  }, {}>;
}>, Schema<"0.31.0", {
  bundles: Table<{
    id: IdColumn<"uuid", string, string>;
    platform: Column<"string", string, string>;
    should_force_update: Column<"bool", boolean, boolean>;
    enabled: Column<"bool", boolean, boolean>;
    file_hash: Column<"string", string, string>;
    git_commit_hash: Column<"string", string | null, string | null>;
    message: Column<"string", string | null, string | null>;
    channel: Column<"string", string | null, string>;
    storage_uri: Column<"string", string, string>;
    target_app_version: Column<"string", string | null, string | null>;
    fingerprint_hash: Column<"string", string | null, string | null>;
    metadata: Column<"json", unknown, unknown>;
    manifest_storage_uri: Column<"string", string | null, string | null>;
    manifest_file_hash: Column<"string", string | null, string | null>;
    asset_base_storage_uri: Column<"string", string | null, string | null>;
    rollout_cohort_count: Column<"integer", number | null, number>;
    target_cohorts: Column<"json", unknown, unknown>;
  }, {}>;
  bundle_patches: Table<{
    id: IdColumn<"varchar(255)", string, string>;
    bundle_id: Column<"uuid", string, string>;
    base_bundle_id: Column<"uuid", string, string>;
    base_file_hash: Column<"string", string, string>;
    patch_file_hash: Column<"string", string, string>;
    patch_storage_uri: Column<"string", string, string>;
    order_index: Column<"integer", number | null, number>;
  }, Omit<{}, "bundle" | "baseBundle"> & {
    bundle: ExplicitRelation<"one", Table<{
      id: IdColumn<"uuid", string, string>;
      platform: Column<"string", string, string>;
      should_force_update: Column<"bool", boolean, boolean>;
      enabled: Column<"bool", boolean, boolean>;
      file_hash: Column<"string", string, string>;
      git_commit_hash: Column<"string", string | null, string | null>;
      message: Column<"string", string | null, string | null>;
      channel: Column<"string", string | null, string>;
      storage_uri: Column<"string", string, string>;
      target_app_version: Column<"string", string | null, string | null>;
      fingerprint_hash: Column<"string", string | null, string | null>;
      metadata: Column<"json", unknown, unknown>;
      manifest_storage_uri: Column<"string", string | null, string | null>;
      manifest_file_hash: Column<"string", string | null, string | null>;
      asset_base_storage_uri: Column<"string", string | null, string | null>;
      rollout_cohort_count: Column<"integer", number | null, number>;
      target_cohorts: Column<"json", unknown, unknown>;
    }, {}>>;
    baseBundle: ExplicitRelation<"one", Table<{
      id: IdColumn<"uuid", string, string>;
      platform: Column<"string", string, string>;
      should_force_update: Column<"bool", boolean, boolean>;
      enabled: Column<"bool", boolean, boolean>;
      file_hash: Column<"string", string, string>;
      git_commit_hash: Column<"string", string | null, string | null>;
      message: Column<"string", string | null, string | null>;
      channel: Column<"string", string | null, string>;
      storage_uri: Column<"string", string, string>;
      target_app_version: Column<"string", string | null, string | null>;
      fingerprint_hash: Column<"string", string | null, string | null>;
      metadata: Column<"json", unknown, unknown>;
      manifest_storage_uri: Column<"string", string | null, string | null>;
      manifest_file_hash: Column<"string", string | null, string | null>;
      asset_base_storage_uri: Column<"string", string | null, string | null>;
      rollout_cohort_count: Column<"integer", number | null, number>;
      target_cohorts: Column<"json", unknown, unknown>;
    }, {}>>;
  }>;
}>]>;
type HotUpdaterClient = InferFumaDB<typeof HotUpdaterDB>;
type Migrator = ReturnType<HotUpdaterClient["createMigrator"]>;
//#endregion
export { HotUpdaterClient, HotUpdaterDB, Migrator };