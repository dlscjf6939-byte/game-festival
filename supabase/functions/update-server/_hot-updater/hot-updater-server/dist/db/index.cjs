require("../_virtual/_rolldown/runtime.cjs");
require("./createBundleDiff.cjs");
require("../version.cjs");
const require_handler = require("../handler.cjs");
const require_route = require("../route.cjs");
const require_storageAccess = require("../storageAccess.cjs");
const require_types = require("./types.cjs");
const require_ormCore = require("./ormCore.cjs");
const require_pluginCore = require("./pluginCore.cjs");
let _hot_updater_plugin_core = require("@hot-updater/plugin-core");
//#region src/db/index.ts
function createHotUpdater(options) {
	const basePath = require_route.normalizeBasePath(options.basePath ?? "/api");
	const { readStorageText, resolveFileUrl } = require_storageAccess.createStorageAccess((options.storages ?? options.storagePlugins ?? []).map((plugin) => {
		const storagePlugin = typeof plugin === "function" ? plugin() : plugin;
		(0, _hot_updater_plugin_core.assertRuntimeStoragePlugin)(storagePlugin);
		return storagePlugin;
	}));
	const database = options.database;
	const core = require_types.isDatabasePluginFactory(database) || require_types.isDatabasePlugin(database) ? (() => {
		const plugin = require_types.isDatabasePluginFactory(database) ? database() : database;
		return require_pluginCore.createPluginDatabaseCore(() => plugin, resolveFileUrl, require_types.isDatabasePluginFactory(database) ? {
			createMutationPlugin: () => database(),
			readStorageText
		} : { readStorageText });
	})() : require_ormCore.createOrmDatabaseCore({
		database,
		readStorageText,
		resolveFileUrl
	});
	const api = {
		...core.api,
		handler: require_handler.createHandler(core.api, {
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
exports.createHotUpdater = createHotUpdater;
