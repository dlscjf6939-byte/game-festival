//#region src/filterCompatibleAppVersions.d.ts
/**
 * Filters target app versions that are compatible with the current app version.
 * Returns only versions that are compatible with the current version according to semver rules.
 *
 * @param targetAppVersionList - List of target app versions to filter
 * @param currentVersion - Current app version
 * @returns Array of target app versions compatible with the current version
 */
declare const filterCompatibleAppVersions: (targetAppVersionList: string[], currentVersion: string) => string[];
//#endregion
export { filterCompatibleAppVersions };