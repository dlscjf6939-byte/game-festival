const require_chunk_ZEQMAIFI = require("../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/chunk-ZEQMAIFI.cjs");
require("../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/schema/index.cjs");
//#region src/schema/v0_31_0.ts
const v0_31_0 = require_chunk_ZEQMAIFI.schema({
	version: "0.31.0",
	tables: {
		bundles: require_chunk_ZEQMAIFI.table("bundles", {
			id: require_chunk_ZEQMAIFI.idColumn("id", "uuid"),
			platform: require_chunk_ZEQMAIFI.column("platform", "string"),
			should_force_update: require_chunk_ZEQMAIFI.column("should_force_update", "bool"),
			enabled: require_chunk_ZEQMAIFI.column("enabled", "bool"),
			file_hash: require_chunk_ZEQMAIFI.column("file_hash", "string"),
			git_commit_hash: require_chunk_ZEQMAIFI.column("git_commit_hash", "string").nullable(),
			message: require_chunk_ZEQMAIFI.column("message", "string").nullable(),
			channel: require_chunk_ZEQMAIFI.column("channel", "string").defaultTo("production"),
			storage_uri: require_chunk_ZEQMAIFI.column("storage_uri", "string"),
			target_app_version: require_chunk_ZEQMAIFI.column("target_app_version", "string").nullable(),
			fingerprint_hash: require_chunk_ZEQMAIFI.column("fingerprint_hash", "string").nullable(),
			metadata: require_chunk_ZEQMAIFI.column("metadata", "json"),
			manifest_storage_uri: require_chunk_ZEQMAIFI.column("manifest_storage_uri", "string").nullable(),
			manifest_file_hash: require_chunk_ZEQMAIFI.column("manifest_file_hash", "string").nullable(),
			asset_base_storage_uri: require_chunk_ZEQMAIFI.column("asset_base_storage_uri", "string").nullable(),
			rollout_cohort_count: require_chunk_ZEQMAIFI.column("rollout_cohort_count", "integer").defaultTo(1e3),
			target_cohorts: require_chunk_ZEQMAIFI.column("target_cohorts", "json").nullable()
		}),
		bundle_patches: require_chunk_ZEQMAIFI.table("bundle_patches", {
			id: require_chunk_ZEQMAIFI.idColumn("id", "varchar(255)"),
			bundle_id: require_chunk_ZEQMAIFI.column("bundle_id", "uuid"),
			base_bundle_id: require_chunk_ZEQMAIFI.column("base_bundle_id", "uuid"),
			base_file_hash: require_chunk_ZEQMAIFI.column("base_file_hash", "string"),
			patch_file_hash: require_chunk_ZEQMAIFI.column("patch_file_hash", "string"),
			patch_storage_uri: require_chunk_ZEQMAIFI.column("patch_storage_uri", "string"),
			order_index: require_chunk_ZEQMAIFI.column("order_index", "integer").defaultTo(0)
		})
	},
	relations: { bundle_patches: (builder) => ({
		bundle: builder.one("bundles", ["bundle_id", "id"]).imply("patches").foreignKey({
			name: "bundle_patches_bundle_id_fk",
			onDelete: "CASCADE"
		}),
		baseBundle: builder.one("bundles", ["base_bundle_id", "id"]).imply("baseForPatches").foreignKey({
			name: "bundle_patches_base_bundle_id_fk",
			onDelete: "CASCADE"
		})
	}) }
});
//#endregion
exports.v0_31_0 = v0_31_0;
