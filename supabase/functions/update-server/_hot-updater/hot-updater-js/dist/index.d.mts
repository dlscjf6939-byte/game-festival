import { Bundle, GetBundlesArgs, UpdateInfo } from "@hot-updater/core";

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
//#region src/getUpdateInfo.d.ts
declare const getUpdateInfo: (bundles: Bundle[], args: GetBundlesArgs) => Promise<UpdateInfo | null>;
//#endregion
//#region src/semverSatisfies.d.ts
declare const semverSatisfies: (targetAppVersion: string, currentVersion: string) => boolean;
//#endregion
//#region src/verifyJwtSignedUrl.d.ts
type SuccessResponse = {
  status: 200;
  responseHeaders?: Record<string, string>;
  responseBody: any;
};
type ErrorResponse = {
  status: 400 | 403 | 404;
  error: string;
};
type VerifyJwtSignedUrlResponse = SuccessResponse | ErrorResponse;
/**
 * Verifies JWT token only and returns the file key (path with leading slashes removed) if valid.
 */
declare const verifyJwtToken: ({
  path,
  token,
  jwtSecret
}: {
  path: string;
  token: string | undefined;
  jwtSecret: string;
}) => Promise<{
  valid: boolean;
  key?: string;
  error?: string;
}>;
/**
 * Integrated function for JWT verification and file handling.
 * - Returns error response if token is missing or validation fails.
 * - On success, retrieves file data through the handler and constructs a response object.
 */
declare const verifyJwtSignedUrl: ({
  path,
  token,
  jwtSecret,
  handler
}: {
  path: string;
  token: string | undefined;
  jwtSecret: string;
  handler: (key: string) => Promise<{
    body: any;
    contentType?: string;
  } | null>;
}) => Promise<VerifyJwtSignedUrlResponse>;
//#endregion
//#region src/withJwtSignedUrl.d.ts
/**
 * Creates a JWT-signed download URL based on the provided update information.
 *
 * @param {Object} options - Function options
 * @param {T|null} options.data - Update information (null if none)
 * @param {string} options.reqUrl - Request URL (base URL for token generation)
 * @param {string} options.jwtSecret - Secret key for JWT signing
 * @returns {Promise<T|null>} - Update response object with fileUrl or null
 */
declare const withJwtSignedUrl: <T extends {
  id: string;
  storageUri: string | null;
}>({
  data,
  reqUrl,
  jwtSecret
}: {
  data: T | null;
  reqUrl: string;
  jwtSecret: string;
}) => Promise<(Omit<T, "storageUri"> & {
  fileUrl: string | null;
}) | null>;
declare const signToken: (key: string, jwtSecret: string) => Promise<string>;
//#endregion
export { ErrorResponse, SuccessResponse, VerifyJwtSignedUrlResponse, filterCompatibleAppVersions, getUpdateInfo, semverSatisfies, signToken, verifyJwtSignedUrl, verifyJwtToken, withJwtSignedUrl };