Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/bundleArtifacts.ts
const stripBundleArtifactMetadata = (metadata) => metadata;
const getManifestStorageUri = (bundle) => bundle.manifestStorageUri ?? null;
const getManifestFileHash = (bundle) => bundle.manifestFileHash ?? null;
const getAssetBaseStorageUri = (bundle) => bundle.assetBaseStorageUri ?? null;
const isBundlePatchArtifact = (value) => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const candidate = value;
	return typeof candidate.baseBundleId === "string" && typeof candidate.baseFileHash === "string" && typeof candidate.patchFileHash === "string" && typeof candidate.patchStorageUri === "string";
};
const readBundlePatchArray = (patches) => {
	if (!Array.isArray(patches)) return [];
	return patches.filter(isBundlePatchArtifact);
};
const getBundlePatches = (bundle) => {
	const patches = readBundlePatchArray(bundle.patches);
	const seenBaseBundleIds = /* @__PURE__ */ new Set();
	return patches.filter((patch) => {
		if (seenBaseBundleIds.has(patch.baseBundleId)) return false;
		seenBaseBundleIds.add(patch.baseBundleId);
		return true;
	});
};
const getBundlePatch = (bundle, baseBundleId) => {
	return getBundlePatches(bundle).find((patch) => patch.baseBundleId === baseBundleId) ?? null;
};
const getPrimaryPatch = (bundle) => {
	return getBundlePatches(bundle)[0] ?? null;
};
const getPatchBaseBundleId = (bundle) => bundle.patchBaseBundleId ?? getPrimaryPatch(bundle)?.baseBundleId ?? null;
const getPatchBaseFileHash = (bundle) => bundle.patchBaseFileHash ?? getPrimaryPatch(bundle)?.baseFileHash ?? null;
const getPatchFileHash = (bundle) => bundle.patchFileHash ?? getPrimaryPatch(bundle)?.patchFileHash ?? null;
const getPatchStorageUri = (bundle) => bundle.patchStorageUri ?? getPrimaryPatch(bundle)?.patchStorageUri ?? null;
//#endregion
//#region src/rollout.ts
const NUMERIC_COHORT_SIZE = 1e3;
const DEFAULT_ROLLOUT_COHORT_COUNT = NUMERIC_COHORT_SIZE;
const MAX_COHORT_LENGTH = 64;
const INVALID_COHORT_ERROR_MESSAGE = `Invalid cohort. Use 1-1000 or a lowercase slug without spaces, up to 64 characters.`;
const CUSTOM_COHORT_PATTERN = /^[a-z0-9-]+$/;
function parseNumericCohortValue(cohort) {
	if (!/^\d+$/.test(cohort)) return null;
	const parsed = Number.parseInt(cohort, 10);
	if (Number.isNaN(parsed) || parsed < 1 || parsed > 1e3) return null;
	return parsed;
}
function positiveMod(value, modulus) {
	return (value % modulus + modulus) % modulus;
}
function hashString(value) {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		const char = value.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return hash;
}
function gcd(a, b) {
	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		const next = x % y;
		x = y;
		y = next;
	}
	return x;
}
function modularInverse(value, modulus) {
	let t = 0;
	let newT = 1;
	let r = modulus;
	let newR = positiveMod(value, modulus);
	while (newR !== 0) {
		const quotient = Math.floor(r / newR);
		[t, newT] = [newT, t - quotient * newT];
		[r, newR] = [newR, r - quotient * newR];
	}
	if (r > 1) throw new Error(`No modular inverse for ${value} mod ${modulus}`);
	return positiveMod(t, modulus);
}
function getRolloutShuffleParameters(bundleId) {
	let multiplier = positiveMod(hashString(`${bundleId}:multiplier`), 997);
	if (multiplier === 0) multiplier = 1;
	while (gcd(multiplier, NUMERIC_COHORT_SIZE) !== 1) {
		multiplier = positiveMod(multiplier + 1, NUMERIC_COHORT_SIZE);
		if (multiplier === 0) multiplier = 1;
	}
	const offset = positiveMod(hashString(`${bundleId}:offset`), NUMERIC_COHORT_SIZE);
	return {
		multiplier,
		offset,
		inverseMultiplier: modularInverse(multiplier, NUMERIC_COHORT_SIZE)
	};
}
function normalizeRolloutCohortCount(rolloutCohortCount) {
	if (rolloutCohortCount === null || rolloutCohortCount === void 0) return DEFAULT_ROLLOUT_COHORT_COUNT;
	if (rolloutCohortCount <= 0) return 0;
	if (rolloutCohortCount >= 1e3) return NUMERIC_COHORT_SIZE;
	return Math.floor(rolloutCohortCount);
}
function normalizeCohortValue(cohort) {
	const normalized = cohort.trim().toLowerCase();
	const numericCohort = parseNumericCohortValue(normalized);
	if (numericCohort !== null) return String(numericCohort);
	return normalized;
}
function getNumericCohortValue(cohort) {
	return parseNumericCohortValue(normalizeCohortValue(cohort));
}
function isNumericCohort(cohort) {
	return getNumericCohortValue(cohort) !== null;
}
function isCustomCohort(cohort) {
	const normalized = normalizeCohortValue(cohort);
	return normalized.length > 0 && normalized.length <= 64 && !/^\d+$/.test(normalized) && CUSTOM_COHORT_PATTERN.test(normalized);
}
function isValidCohort(cohort) {
	const normalized = normalizeCohortValue(cohort);
	return isNumericCohort(normalized) || isCustomCohort(normalized);
}
function getDefaultNumericCohort(identifier) {
	const cohortValue = positiveMod(hashString(identifier), NUMERIC_COHORT_SIZE) + 1;
	return String(cohortValue);
}
function getNumericCohortRolloutPosition(bundleId, cohortValue) {
	if (cohortValue < 1 || cohortValue > 1e3) throw new Error(`Invalid numeric cohort: ${cohortValue}`);
	const { offset, inverseMultiplier } = getRolloutShuffleParameters(bundleId);
	return positiveMod(inverseMultiplier * (cohortValue - 1 - offset), NUMERIC_COHORT_SIZE);
}
function getRolledOutNumericCohorts(bundleId, rolloutCohortCount) {
	const normalizedRolloutCount = normalizeRolloutCohortCount(rolloutCohortCount);
	if (normalizedRolloutCount <= 0) return [];
	return Array.from({ length: NUMERIC_COHORT_SIZE }, (_, index) => index + 1).filter((cohortValue) => {
		if (normalizedRolloutCount >= 1e3) return true;
		return getNumericCohortRolloutPosition(bundleId, cohortValue) < normalizedRolloutCount;
	});
}
function isCohortEligibleForUpdate(bundleId, cohort, rolloutCohortCount, targetCohorts) {
	const normalizedCohort = cohort === null || cohort === void 0 ? void 0 : normalizeCohortValue(cohort);
	const normalizedTargetCohorts = targetCohorts?.map((targetCohort) => normalizeCohortValue(targetCohort)) ?? [];
	if (normalizedCohort !== void 0 && normalizedTargetCohorts.includes(normalizedCohort)) return true;
	const normalizedRolloutCount = normalizeRolloutCohortCount(rolloutCohortCount);
	if (normalizedRolloutCount <= 0) return false;
	if (normalizedCohort === void 0) return normalizedRolloutCount >= NUMERIC_COHORT_SIZE;
	const numericCohort = getNumericCohortValue(normalizedCohort);
	if (numericCohort === null) return false;
	if (normalizedRolloutCount >= 1e3) return true;
	return getNumericCohortRolloutPosition(bundleId, numericCohort) < normalizedRolloutCount;
}
//#endregion
//#region src/uuid.ts
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
//#endregion
exports.DEFAULT_ROLLOUT_COHORT_COUNT = DEFAULT_ROLLOUT_COHORT_COUNT;
exports.INVALID_COHORT_ERROR_MESSAGE = INVALID_COHORT_ERROR_MESSAGE;
exports.MAX_COHORT_LENGTH = MAX_COHORT_LENGTH;
exports.NIL_UUID = NIL_UUID;
exports.NUMERIC_COHORT_SIZE = NUMERIC_COHORT_SIZE;
exports.getAssetBaseStorageUri = getAssetBaseStorageUri;
exports.getBundlePatch = getBundlePatch;
exports.getBundlePatches = getBundlePatches;
exports.getDefaultNumericCohort = getDefaultNumericCohort;
exports.getManifestFileHash = getManifestFileHash;
exports.getManifestStorageUri = getManifestStorageUri;
exports.getNumericCohortRolloutPosition = getNumericCohortRolloutPosition;
exports.getNumericCohortValue = getNumericCohortValue;
exports.getPatchBaseBundleId = getPatchBaseBundleId;
exports.getPatchBaseFileHash = getPatchBaseFileHash;
exports.getPatchFileHash = getPatchFileHash;
exports.getPatchStorageUri = getPatchStorageUri;
exports.getRolledOutNumericCohorts = getRolledOutNumericCohorts;
exports.isCohortEligibleForUpdate = isCohortEligibleForUpdate;
exports.isCustomCohort = isCustomCohort;
exports.isNumericCohort = isNumericCohort;
exports.isValidCohort = isValidCohort;
exports.normalizeCohortValue = normalizeCohortValue;
exports.normalizeRolloutCohortCount = normalizeRolloutCohortCount;
exports.stripBundleArtifactMetadata = stripBundleArtifactMetadata;
