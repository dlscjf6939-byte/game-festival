const require_chunk_ZEQMAIFI = require("../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/chunk-ZEQMAIFI.cjs");
require("../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/schema/index.cjs");
//#region src/schema/v0_21_0.ts
const v0_21_0 = require_chunk_ZEQMAIFI.schema({
	version: "0.21.0",
	tables: { bundles: require_chunk_ZEQMAIFI.table("bundles", {
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
		metadata: require_chunk_ZEQMAIFI.column("metadata", "json")
	}) },
	relations: {}
});
//#endregion
exports.v0_21_0 = v0_21_0;
