import "./createBundleDiff.mjs";
import "../version.mjs";
import { createHandler } from "../handler.mjs";
import { normalizeBasePath } from "../route.mjs";
import { createStorageAccess } from "../storageAccess.mjs";
import { isDatabasePlugin, isDatabasePluginFactory } from "./types.mjs";
import { createOrmDatabaseCore } from "./ormCore.mjs";
import { createPluginDatabaseCore } from "./pluginCore.mjs";
import { assertRuntimeStoragePlugin } from "@hot-updater/plugin-core";
//#region src/db/index.ts
function createHotUpdater(options) {
	const basePath = normalizeBasePath(options.basePath ?? "/api");
	const { readStorageText, resolveFileUrl } = createStorageAccess((options.storages ?? options.storagePlugins ?? []).map((plugin) => {
		const storagePlugin = typeof plugin === "function" ? plugin() : plugin;
		assertRuntimeStoragePlugin(storagePlugin);
		return storagePlugin;
	}));
	const database = options.database;
	const core = isDatabasePluginFactory(database) || isDatabasePlugin(database) ? (() => {
		const plugin = isDatabasePluginFactory(database) ? database() : database;
		return createPluginDatabaseCore(() => plugin, resolveFileUrl, isDatabasePluginFactory(database) ? {
			createMutationPlugin: () => database(),
			readStorageText
		} : { readStorageText });
	})() : createOrmDatabaseCore({
		database,
		readStorageText,
		resolveFileUrl
	});
	const api = {
		...core.api,
		handler: createHandler(core.api, {
			basePath,
			routes: options.routes
		}),
		adapterName: core.adapterName,
		createMigrator: core.createMigrator,
		generateSchema: core.generateSchema
	};
	return {
		...api,
		basePath,
		handler: api.handler
	};
}
//#endregion
export { createHotUpdater };
