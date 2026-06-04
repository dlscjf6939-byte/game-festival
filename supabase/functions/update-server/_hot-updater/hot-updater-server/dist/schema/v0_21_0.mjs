import { column, idColumn, schema, table } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/chunk-ZEQMAIFI.mjs";
import "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/schema/index.mjs";
//#region src/schema/v0_21_0.ts
const v0_21_0 = schema({
	version: "0.21.0",
	tables: { bundles: table("bundles", {
		id: idColumn("id", "uuid"),
		platform: column("platform", "string"),
		should_force_update: column("should_force_update", "bool"),
		enabled: column("enabled", "bool"),
		file_hash: column("file_hash", "string"),
		git_commit_hash: column("git_commit_hash", "string").nullable(),
		message: column("message", "string").nullable(),
		channel: column("channel", "string").defaultTo("production"),
		storage_uri: column("storage_uri", "string"),
		target_app_version: column("target_app_version", "string").nullable(),
		fingerprint_hash: column("fingerprint_hash", "string").nullable(),
		metadata: column("metadata", "json")
	}) },
	relations: {}
});
//#endregion
export { v0_21_0 };
