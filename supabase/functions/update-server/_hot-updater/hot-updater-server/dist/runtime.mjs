import { HOT_UPDATER_SERVER_VERSION } from "./version.mjs";
import { createHandler } from "./handler.mjs";
import { normalizeBasePath } from "./route.mjs";
import { createStorageAccess } from "./storageAccess.mjs";
import { isDatabasePlugin, isDatabasePluginFactory } from "./db/types.mjs";
import { createPluginDatabaseCore } from "./db/pluginCore.mjs";
import { assertRuntimeStoragePlugin } from "@hot-updater/plugin-core";
//#region src/runtime.ts
function createHotUpdater(options) {
	const database = options.database;
	const basePath = normalizeBasePath(options.basePath ?? "/api");
	const { readStorageText, resolveFileUrl } = createStorageAccess((options.storages ?? options.storagePlugins ?? []).map((plugin) => {
		const storagePlugin = typeof plugin === "function" ? plugin() : plugin;
		assertRuntimeStoragePlugin(storagePlugin);
		return storagePlugin;
	}));
	if (!isDatabasePluginFactory(database) && !isDatabasePlugin(database)) throw new Error("@hot-updater/server/runtime only supports database plugins.");
	const plugin = isDatabasePluginFactory(database) ? database() : database;
	const core = createPluginDatabaseCore(() => plugin, resolveFileUrl, isDatabasePluginFactory(database) ? {
		createMutationPlugin: () => database(),
		readStorageText
	} : { readStorageText });
	const api = {
		...core.api,
		handler: createHandler(core.api, {
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
export { HOT_UPDATER_SERVER_VERSION, createHandler, createHotUpdater };
