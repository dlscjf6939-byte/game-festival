//#region src/types.d.ts
type Platform = "ios" | "android";
type BundleMetadata = {
  app_version?: string;
};
interface BundlePatchArtifact {
  baseBundleId: string;
  baseFileHash: string;
  patchFileHash: string;
  patchStorageUri: string;
}
interface ChangedAssetPatch {
  algorithm: "bsdiff";
  baseBundleId: string;
  baseFileHash: string;
  patchFileHash: string;
  patchUrl: string;
}
interface ChangedAssetFile {
  compression?: "br" | null;
  url: string;
}
interface ChangedAsset {
  file?: ChangedAssetFile | null;
  fileHash: string;
  patch?: ChangedAssetPatch | null;
}
interface Bundle {
  /**
   * The unique identifier for the bundle. uuidv7
   */
  id: string;
  /**
   * The platform the bundle is for.
   */
  platform: Platform;
  /**
   * Whether the bundle should force an update.
   */
  shouldForceUpdate: boolean;
  /**
   * Whether the bundle is enabled.
   */
  enabled: boolean;
  /**
   * The hash of the bundle.
   */
  fileHash: string;
  /**
   * The storage key of the bundle.
   * @example "s3://my-bucket/my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   * @example "r2://my-bucket/my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   * @example "firebase-storage://my-bucket/my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   * @example "storage://my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   */
  storageUri: string;
  /**
   * The git commit hash of the bundle.
   */
  gitCommitHash: string | null;
  /**
   * The message of the bundle.
   */
  message: string | null;
  /**
   * The name of the channel where the bundle is deployed.
   *
   * Examples:
   * - production: Production channel for end users
   * - development: Development channel for testing
   * - staging: Staging channel for quality assurance before production
   * - app-name: Channel for specific app instances (e.g., my-app, app-test)
   *
   * Different channel values can be used based on each app's requirements.
   */
  channel: string;
  /**
   * The target app version of the bundle.
   */
  targetAppVersion: string | null;
  /**
   * The fingerprint hash of the bundle.
   */
  fingerprintHash: string | null;
  /**
   * The metadata of the bundle.
   */
  metadata?: BundleMetadata;
  /**
   * Storage URI for the bundle manifest artifact.
   */
  manifestStorageUri?: string | null;
  /**
   * SHA256 hash of the manifest artifact, optionally signed as sig:<signature>.
   */
  manifestFileHash?: string | null;
  /**
   * Storage URI prefix for manifest assets.
   */
  assetBaseStorageUri?: string | null;
  /**
   * Binary patch artifacts keyed by base bundle in array order.
   * Earlier entries take precedence when a single "primary" patch is needed.
   */
  patches?: BundlePatchArtifact[] | null;
  /**
   * Base bundle id used to generate this bundle's binary patch.
   * @deprecated Use Bundle.patches.
   */
  patchBaseBundleId?: string | null;
  /**
   * Expected hash of the base asset before patch application.
   * @deprecated Use Bundle.patches.
   */
  patchBaseFileHash?: string | null;
  /**
   * Expected hash of the binary patch artifact.
   * @deprecated Use Bundle.patches.
   */
  patchFileHash?: string | null;
  /**
   * Storage URI for the binary patch artifact.
   * @deprecated Use Bundle.patches.
   */
  patchStorageUri?: string | null;
  /**
   * Rollout cohort count (0-1000). Controls gradual rollout to numeric cohorts.
   * - 0: No cohorts receive this update
   * - 250: 25.0% of numeric cohorts receive this update
   * - 1000 or null: All numeric cohorts receive this update (full rollout)
   *
   * @default 1000
   */
  rolloutCohortCount?: number | null;
  /**
   * Additional cohorts to include for this update.
   * Matching cohorts receive the update even if they are outside the current
   * numeric rollout.
   * If empty/null, only rolloutCohortCount-based rollout is used.
   *
   * NOTE: This field is stored in database but should NOT be returned to
   * update-check clients for security reasons. Server uses it for rollout
   * decisions only.
   */
  targetCohorts?: string[] | null;
}
type SnakeCase<S extends string> = S extends `${infer T}${infer U}` ? T extends "_" ? `_${SnakeCase<U>}` : T extends "-" ? `-${SnakeCase<U>}` : T extends Lowercase<T> ? `${T}${SnakeCase<U>}` : `_${Lowercase<T>}${SnakeCase<U>}` : S;
type SnakeKeyObject<T> = T extends readonly (infer U)[] ? SnakeKeyObject<U>[] : T extends Record<string, any> ? { [K in keyof T as SnakeCase<Extract<K, string>>]: SnakeKeyObject<T[K]> } : T;
type SnakeCaseBundle = SnakeKeyObject<Bundle>;
type UpdateStatus = "ROLLBACK" | "UPDATE";
type AppUpdateStatus = UpdateStatus | "UP_TO_DATE";
/**
 * The update info for the database layer.
 * This is the update info that is used by the database.
 */
interface UpdateInfo {
  id: string;
  shouldForceUpdate: boolean;
  message: string | null;
  status: UpdateStatus;
  storageUri: string | null;
  fileHash: string | null;
  /**
   * Rollout cohort count (0-1000). Controls gradual rollout to numeric cohorts.
   */
  rolloutCohortCount?: number | null;
  /**
   * Additional cohorts included for this update.
   * Used internally for rollout decisions.
   */
  targetCohorts?: string[] | null;
}
/**
 * The update info for the app layer.
 * This is the update info that is used by the app.
 */
interface AppUpdateAvailableInfo extends Omit<UpdateInfo, "storageUri"> {
  status: UpdateStatus;
  fileUrl: string | null;
  /**
   * SHA256 hash of the bundle file, optionally with embedded signature.
   * Format when signed: "sig:<base64_signature>"
   * Format when unsigned: "<hex_hash>" (64-character lowercase hex)
   * The client parses this to extract signature for native verification.
   */
  fileHash: string | null;
  /**
   * Optional manifest artifact for manifest-driven updates.
   * When present with `changedAssets`, native can download and verify a signed
   * manifest, then assemble the next bundle directory from reused and changed
   * files while keeping archive fallback available through `fileUrl`.
   */
  manifestUrl?: string | null;
  /**
   * SHA256 hash of the manifest file, optionally with embedded signature.
   * Follows the same `sig:<base64_signature>` or plain hex format as `fileHash`.
   */
  manifestFileHash?: string | null;
  /**
   * Per-file descriptors for assets whose hash differs from the client's
   * current manifest, or for all assets when the server cannot reuse a base
   * manifest. Keys are manifest-relative file paths.
   */
  changedAssets?: Record<string, ChangedAsset> | null;
}
interface AppUpToDateInfo {
  status: "UP_TO_DATE";
}
type AppUpdateInfo = AppUpdateAvailableInfo | AppUpToDateInfo;
type UpdateStrategy = "fingerprint" | "appVersion";
type FingerprintGetBundlesArgs = {
  _updateStrategy: "fingerprint";
  platform: Platform;
  /**
   * The current bundle id of the app.
   */
  bundleId: string;
  /**
   * Minimum bundle id that should be used.
   * This value is generated at build time via getMinBundleId().
   *
   * @default "00000000-0000-0000-0000-000000000000"
   */
  minBundleId?: string;
  /**
   * The name of the channel where the bundle is deployed.
   *
   * @default "production"
   *
   * Examples:
   * - production: Production channel for end users
   * - development: Development channel for testing
   * - staging: Staging channel for quality assurance before production
   * - app-name: Channel for specific app instances (e.g., my-app, app-test)
   */
  channel?: string;
  /**
   * Cohort identifier used for server-side rollout decisions.
   */
  cohort?: string;
  /**
   * The fingerprint hash of the bundle.
   */
  fingerprintHash: string;
};
type AppVersionGetBundlesArgs = {
  _updateStrategy: "appVersion";
  platform: Platform;
  /**
   * The current bundle id of the app.
   */
  bundleId: string;
  /**
   * Minimum bundle id that should be used.
   * This value is generated at build time via getMinBundleId().
   *
   * @default "00000000-0000-0000-0000-000000000000"
   */
  minBundleId?: string;
  /**
   * The name of the channel where the bundle is deployed.
   *
   * @default "production"
   *
   * Examples:
   * - production: Production channel for end users
   * - development: Development channel for testing
   * - staging: Staging channel for quality assurance before production
   * - app-name: Channel for specific app instances (e.g., my-app, app-test)
   */
  channel?: string;
  /**
   * Cohort identifier used for server-side rollout decisions.
   */
  cohort?: string;
  /**
   * The current app version.
   */
  appVersion: string;
};
type GetBundlesArgs = FingerprintGetBundlesArgs | AppVersionGetBundlesArgs;
type UpdateBundleParams = {
  platform: Platform;
  bundleId: string;
  minBundleId: string;
  channel: string;
  appVersion: string;
  fingerprintHash: string | null;
};
//#endregion
//#region src/bundleArtifacts.d.ts
declare const stripBundleArtifactMetadata: (metadata: BundleMetadata | undefined) => BundleMetadata | undefined;
declare const getManifestStorageUri: (bundle: Pick<Bundle, "manifestStorageUri" | "metadata">) => string | null;
declare const getManifestFileHash: (bundle: Pick<Bundle, "manifestFileHash" | "metadata">) => string | null;
declare const getAssetBaseStorageUri: (bundle: Pick<Bundle, "assetBaseStorageUri" | "metadata">) => string | null;
declare const getBundlePatches: (bundle: Pick<Bundle, "patches" | "patchBaseBundleId" | "patchBaseFileHash" | "patchFileHash" | "patchStorageUri" | "metadata">) => BundlePatchArtifact[];
declare const getBundlePatch: (bundle: Pick<Bundle, "patches" | "patchBaseBundleId" | "patchBaseFileHash" | "patchFileHash" | "patchStorageUri" | "metadata">, baseBundleId: string) => BundlePatchArtifact | null;
declare const getPatchBaseBundleId: (bundle: Pick<Bundle, "patches" | "patchBaseBundleId" | "patchBaseFileHash" | "patchFileHash" | "patchStorageUri" | "metadata">) => string;
declare const getPatchBaseFileHash: (bundle: Pick<Bundle, "patches" | "patchBaseBundleId" | "patchBaseFileHash" | "patchFileHash" | "patchStorageUri" | "metadata">) => string;
declare const getPatchFileHash: (bundle: Pick<Bundle, "patches" | "patchBaseBundleId" | "patchBaseFileHash" | "patchFileHash" | "patchStorageUri" | "metadata">) => string;
declare const getPatchStorageUri: (bundle: Pick<Bundle, "patches" | "patchBaseBundleId" | "patchBaseFileHash" | "patchFileHash" | "patchStorageUri" | "metadata">) => string;
//#endregion
//#region src/rollout.d.ts
declare const NUMERIC_COHORT_SIZE = 1000;
declare const DEFAULT_ROLLOUT_COHORT_COUNT = 1000;
declare const MAX_COHORT_LENGTH = 64;
declare const INVALID_COHORT_ERROR_MESSAGE = "Invalid cohort. Use 1-1000 or a lowercase slug without spaces, up to 64 characters.";
declare function normalizeRolloutCohortCount(rolloutCohortCount: number | null | undefined): number;
declare function normalizeCohortValue(cohort: string): string;
declare function getNumericCohortValue(cohort: string): number | null;
declare function isNumericCohort(cohort: string): boolean;
declare function isCustomCohort(cohort: string): boolean;
declare function isValidCohort(cohort: string): boolean;
declare function getDefaultNumericCohort(identifier: string): string;
declare function getNumericCohortRolloutPosition(bundleId: string, cohortValue: number): number;
declare function getRolledOutNumericCohorts(bundleId: string, rolloutCohortCount: number | null | undefined): number[];
declare function isCohortEligibleForUpdate(bundleId: string, cohort: string | null | undefined, rolloutCohortCount: number | null | undefined, targetCohorts: readonly string[] | null | undefined): boolean;
//#endregion
//#region src/uuid.d.ts
declare const NIL_UUID = "00000000-0000-0000-0000-000000000000";
//#endregion
export { AppUpToDateInfo, AppUpdateAvailableInfo, AppUpdateInfo, AppUpdateStatus, AppVersionGetBundlesArgs, Bundle, BundleMetadata, BundlePatchArtifact, ChangedAsset, ChangedAssetFile, ChangedAssetPatch, DEFAULT_ROLLOUT_COHORT_COUNT, FingerprintGetBundlesArgs, GetBundlesArgs, INVALID_COHORT_ERROR_MESSAGE, MAX_COHORT_LENGTH, NIL_UUID, NUMERIC_COHORT_SIZE, Platform, SnakeCaseBundle, UpdateBundleParams, UpdateInfo, UpdateStatus, UpdateStrategy, getAssetBaseStorageUri, getBundlePatch, getBundlePatches, getDefaultNumericCohort, getManifestFileHash, getManifestStorageUri, getNumericCohortRolloutPosition, getNumericCohortValue, getPatchBaseBundleId, getPatchBaseFileHash, getPatchFileHash, getPatchStorageUri, getRolledOutNumericCohorts, isCohortEligibleForUpdate, isCustomCohort, isNumericCohort, isValidCohort, normalizeCohortValue, normalizeRolloutCohortCount, stripBundleArtifactMetadata };