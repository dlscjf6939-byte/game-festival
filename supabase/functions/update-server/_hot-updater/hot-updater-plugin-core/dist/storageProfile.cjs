//#region src/storageProfile.ts
const createMissingProfileError = (plugin, profile) => /* @__PURE__ */ new Error(`${plugin.name} does not implement the ${profile} storage profile for protocol "${plugin.supportedProtocol}".`);
const isNodeStoragePlugin = (plugin) => Boolean(plugin.profiles.node);
const isRuntimeStoragePlugin = (plugin) => Boolean(plugin.profiles.runtime);
function assertNodeStoragePlugin(plugin) {
	if (!isNodeStoragePlugin(plugin)) throw createMissingProfileError(plugin, "node");
}
function assertRuntimeStoragePlugin(plugin) {
	if (!isRuntimeStoragePlugin(plugin)) throw createMissingProfileError(plugin, "runtime");
}
//#endregion
exports.assertNodeStoragePlugin = assertNodeStoragePlugin;
exports.assertRuntimeStoragePlugin = assertRuntimeStoragePlugin;
exports.isNodeStoragePlugin = isNodeStoragePlugin;
exports.isRuntimeStoragePlugin = isRuntimeStoragePlugin;
