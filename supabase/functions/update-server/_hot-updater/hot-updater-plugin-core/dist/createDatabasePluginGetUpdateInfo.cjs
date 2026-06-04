require("./_virtual/_rolldown/runtime.cjs");
const require_filterCompatibleAppVersions = require("./filterCompatibleAppVersions.cjs");
let _hot_updater_js = require("@hot-updater/js");
let _hot_updater_core = require("@hot-updater/core");
//#region src/createDatabasePluginGetUpdateInfo.ts
const normalizeAppVersionArgs = (args) => ({
	...args,
	channel: args.channel ?? "production",
	minBundleId: args.minBundleId ?? _hot_updater_core.NIL_UUID
});
const normalizeFingerprintArgs = (args) => ({
	...args,
	channel: args.channel ?? "production",
	minBundleId: args.minBundleId ?? _hot_updater_core.NIL_UUID
});
const createDatabasePluginGetUpdateInfo = ({ getBundlesByFingerprint, getBundlesByTargetAppVersions, listTargetAppVersions }) => {
	return async (args, context) => {
		if (args._updateStrategy === "appVersion") {
			const normalizedArgs = normalizeAppVersionArgs(args);
			const compatibleAppVersions = require_filterCompatibleAppVersions.filterCompatibleAppVersions(await listTargetAppVersions(normalizedArgs, context), normalizedArgs.appVersion);
			return (0, _hot_updater_js.getUpdateInfo)(compatibleAppVersions.length > 0 ? await getBundlesByTargetAppVersions(normalizedArgs, compatibleAppVersions, context) : [], normalizedArgs);
		}
		const normalizedArgs = normalizeFingerprintArgs(args);
		return (0, _hot_updater_js.getUpdateInfo)(await getBundlesByFingerprint(normalizedArgs, context), normalizedArgs);
	};
};
//#endregion
exports.createDatabasePluginGetUpdateInfo = createDatabasePluginGetUpdateInfo;
