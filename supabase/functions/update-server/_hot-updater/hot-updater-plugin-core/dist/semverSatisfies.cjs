const require_runtime = require("./_virtual/_rolldown/runtime.cjs");
let semver = require("semver");
semver = require_runtime.__toESM(semver);
//#region src/semverSatisfies.ts
const semverSatisfies = (targetAppVersion, currentVersion) => {
	const currentCoerce = semver.default.coerce(currentVersion);
	if (!currentCoerce) return false;
	return semver.default.satisfies(currentCoerce.version, targetAppVersion);
};
//#endregion
exports.semverSatisfies = semverSatisfies;
