import semver from "semver";
//#region src/semverSatisfies.ts
const semverSatisfies = (targetAppVersion, currentVersion) => {
	const currentCoerce = semver.coerce(currentVersion);
	if (!currentCoerce) return false;
	return semver.satisfies(currentCoerce.version, targetAppVersion);
};
//#endregion
export { semverSatisfies };
