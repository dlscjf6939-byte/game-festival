Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
require("./_virtual/_rolldown/runtime.cjs");
const require_version = require("./version.cjs");
const require_handler = require("./handler.cjs");
const require_route = require("./route.cjs");
const require_storageAccess = require("./storageAccess.cjs");
const require_types = require("./db/types.cjs");
const require_pluginCore = require("./db/pluginCore.cjs");
let _hot_updater_plugin_core = require("@hot-updater/plugin-core");
//#region src/runtime.ts
function createHotUpdater(options) {
	const database = options.database;
	const basePath = require_route.normalizeBasePath(options.basePath ?? "/api");
	const { readStorageText, resolveFileUrl } = require_storageAccess.createStorageAccess((options.storages ?? options.storagePlugins ?? []).map((plugin) => {
		const storagePlugin = typeof plugin === "function" ? plugin() : plugin;
		(0, _hot_updater_plugin_core.assertRuntimeStoragePlugin)(storagePlugin);
		return storagePlugin;
	}));
	if (!require_types.isDatabasePluginFactory(database) && !require_types.isDatabasePlugin(database)) throw new Error("@hot-updater/server/runtime only supports database plugins.");
	const plugin = require_types.isDatabasePluginFactory(database) ? database() : database;
	const core = require_pluginCore.createPluginDatabaseCore(() => plugin, resolveFileUrl, require_types.isDatabasePluginFactory(database) ? {
		createMutationPlugin: () => database(),
		readStorageText
	} : { readStorageText });
	const api = {
		...core.api,
		handler: require_handler.createHandler(core.api, {
			basePath,
			routes: options.routes
		}),
		adapterName: core.adapterName
	};
	const handler = (request, context, ...extraArgs) => {
		if (extraArgs.length > 0) return api.handler(request);
		return api.handler(request, context);
	};
	return {
		...api,
		basePath,
		handler
	};
}
//#endregion
exports.HOT_UPDATER_SERVER_VERSION = require_version.HOT_UPDATER_SERVER_VERSION;
exports.createHandler = require_handler.createHandler;
exports.createHotUpdater = createHotUpdater;
