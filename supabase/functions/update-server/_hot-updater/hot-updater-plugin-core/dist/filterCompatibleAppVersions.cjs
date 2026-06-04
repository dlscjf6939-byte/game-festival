const require_semverSatisfies = require("./semverSatisfies.cjs");
//#region src/filterCompatibleAppVersions.ts
/**
* Filters target app versions that are compatible with the current app version.
* Returns only versions that are compatible with the current version according to semver rules.
*
* @param targetAppVersionList - List of target app versions to filter
* @param currentVersion - Current app version
* @returns Array of target app versions compatible with the current version
*/
const filterCompatibleAppVersions = (targetAppVersionList, currentVersion) => {
	return targetAppVersionList.filter((version) => require_semverSatisfies.semverSatisfies(version, currentVersion)).sort((a, b) => b.localeCompare(a));
};
//#endregion
exports.filterCompatibleAppVersions = filterCompatibleAppVersions;
