import { filterCompatibleAppVersions } from "./filterCompatibleAppVersions.mjs";
import { getUpdateInfo } from "@hot-updater/js";
import { NIL_UUID } from "@hot-updater/core";
//#region src/createDatabasePluginGetUpdateInfo.ts
const normalizeAppVersionArgs = (args) => ({
	...args,
	channel: args.channel ?? "production",
	minBundleId: args.minBundleId ?? NIL_UUID
});
const normalizeFingerprintArgs = (args) => ({
	...args,
	channel: args.channel ?? "production",
	minBundleId: args.minBundleId ?? NIL_UUID
});
const createDatabasePluginGetUpdateInfo = ({ getBundlesByFingerprint, getBundlesByTargetAppVersions, listTargetAppVersions }) => {
	return async (args, context) => {
		if (args._updateStrategy === "appVersion") {
			const normalizedArgs = normalizeAppVersionArgs(args);
			const compatibleAppVersions = filterCompatibleAppVersions(await listTargetAppVersions(normalizedArgs, context), normalizedArgs.appVersion);
			return getUpdateInfo(compatibleAppVersions.length > 0 ? await getBundlesByTargetAppVersions(normalizedArgs, compatibleAppVersions, context) : [], normalizedArgs);
		}
		const normalizedArgs = normalizeFingerprintArgs(args);
		return getUpdateInfo(await getBundlesByFingerprint(normalizedArgs, context), normalizedArgs);
	};
};
//#endregion
export { createDatabasePluginGetUpdateInfo };
