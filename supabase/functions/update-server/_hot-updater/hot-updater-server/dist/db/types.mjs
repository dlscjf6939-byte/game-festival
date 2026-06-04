import { sqlProviders } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/index.mjs";
//#region src/db/types.ts
function isDatabasePluginFactory(adapter) {
	return typeof adapter === "function";
}
function isDatabasePlugin(adapter) {
	return typeof adapter === "object" && adapter !== null && "getBundleById" in adapter && "getBundles" in adapter && "getChannels" in adapter;
}
function getSQLProvider(provider) {
	if (!provider) return;
	return sqlProviders.includes(provider) ? provider : void 0;
}
//#endregion
export { getSQLProvider, isDatabasePlugin, isDatabasePluginFactory };
