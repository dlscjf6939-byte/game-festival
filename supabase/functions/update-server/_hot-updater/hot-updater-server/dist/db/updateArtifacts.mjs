import { resolveManifestAssetStorageUri } from "@hot-updater/plugin-core";
import { getAssetBaseStorageUri, getBundlePatch, getManifestFileHash, getManifestStorageUri, stripBundleArtifactMetadata } from "@hot-updater/core";
//#region src/db/updateArtifacts.ts
const HBC_ASSET_PATH_RE = /\.bundle$/;
const BR_COMPRESSED_ASSET_PATH_RE = /(^|\/)index\.[^/]+\.bundle$/;
const resolveUniqueHbcAssetPath = (manifest) => {
	const candidates = Object.keys(manifest.assets).sort((left, right) => left.localeCompare(right)).filter((candidate) => HBC_ASSET_PATH_RE.test(candidate));
	return candidates.length === 1 ? candidates[0] : null;
};
const isBundleManifest = (value) => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const manifest = value;
	if (typeof manifest.bundleId !== "string") return false;
	if (!manifest.assets || typeof manifest.assets !== "object") return false;
	return Object.values(manifest.assets).every((asset) => {
		if (!asset || typeof asset !== "object" || Array.isArray(asset)) return false;
		const manifestAsset = asset;
		return typeof manifestAsset.fileHash === "string" && (manifestAsset.signature === void 0 || typeof manifestAsset.signature === "string");
	});
};
const parseBundleMetadata = (value) => {
	if (!value) return;
	let parsedValue = value;
	if (typeof parsedValue === "string") try {
		parsedValue = JSON.parse(parsedValue);
	} catch {
		return;
	}
	if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) return;
	return stripBundleArtifactMetadata(parsedValue);
};
async function fetchBundleManifest(storageUri, readStorageText, resolveFileUrl, context) {
	const [storageText, fileUrl] = await Promise.all([readStorageText(storageUri, context), resolveFileUrl(storageUri, context)]);
	if (storageText === null) return null;
	let payload;
	try {
		payload = JSON.parse(storageText);
	} catch {
		return null;
	}
	if (!isBundleManifest(payload)) return null;
	if (!fileUrl) return null;
	return {
		fileUrl,
		manifest: payload
	};
}
async function resolveChangedAssets({ assetBaseStorageUri, currentManifest, currentBundle, resolveFileUrl, targetBundle, targetManifest, context }) {
	const patchDescriptor = await resolveHbcPatchDescriptor({
		currentBundle,
		resolveFileUrl,
		targetBundle,
		targetManifest,
		context
	});
	const changedEntries = await Promise.all(Object.entries(targetManifest.assets).map(async ([assetPath, asset]) => {
		if ((currentManifest?.assets[assetPath])?.fileHash === asset.fileHash) return null;
		const usesBrotliAsset = BR_COMPRESSED_ASSET_PATH_RE.test(assetPath);
		const storageUri = resolveManifestAssetStorageUri({
			assetBaseStorageUri,
			assetPath: usesBrotliAsset ? `${assetPath}.br` : assetPath,
			fileHash: asset.fileHash
		});
		const patch = patchDescriptor?.assetPath === assetPath ? patchDescriptor.patch : null;
		let fileUrl = null;
		try {
			fileUrl = await resolveFileUrl(storageUri, context);
		} catch (error) {
			if (!patch) throw error;
		}
		if (!fileUrl && !patch) return false;
		const changedAsset = { fileHash: asset.fileHash };
		if (fileUrl) {
			changedAsset.file = { url: fileUrl };
			if (usesBrotliAsset) changedAsset.file.compression = "br";
		}
		if (patch) changedAsset.patch = patch;
		return [assetPath, changedAsset];
	}));
	if (changedEntries.some((entry) => entry === false)) return null;
	return Object.fromEntries(changedEntries.filter((entry) => entry !== null));
}
async function resolveHbcPatchDescriptor({ currentBundle, resolveFileUrl, targetBundle, targetManifest, context }) {
	const matchingPatch = targetBundle && currentBundle ? getBundlePatch(targetBundle, currentBundle.id) : null;
	const patchAssetPath = resolveUniqueHbcAssetPath(targetManifest);
	if (!currentBundle || !matchingPatch || !patchAssetPath || !matchingPatch.patchStorageUri || !matchingPatch.patchFileHash || !matchingPatch.baseFileHash) return null;
	const patchUrl = await resolveFileUrl(matchingPatch.patchStorageUri, context);
	if (!patchUrl) return null;
	return {
		assetPath: patchAssetPath,
		patch: {
			algorithm: "bsdiff",
			baseBundleId: matchingPatch.baseBundleId,
			baseFileHash: matchingPatch.baseFileHash,
			patchFileHash: matchingPatch.patchFileHash,
			patchUrl
		}
	};
}
async function resolveManifestArtifacts({ currentBundle, resolveFileUrl, readStorageText, targetBundle, context }) {
	const manifestStorageUri = targetBundle ? getManifestStorageUri(targetBundle) : null;
	const manifestFileHash = targetBundle ? getManifestFileHash(targetBundle) : null;
	const assetBaseStorageUri = targetBundle ? getAssetBaseStorageUri(targetBundle) : null;
	if (!manifestStorageUri || !manifestFileHash || !assetBaseStorageUri) return null;
	const currentManifestStorageUri = currentBundle ? getManifestStorageUri(currentBundle) : null;
	const [targetManifestResult, currentManifestResult] = await Promise.all([fetchBundleManifest(manifestStorageUri, readStorageText, resolveFileUrl, context), currentManifestStorageUri ? fetchBundleManifest(currentManifestStorageUri, readStorageText, resolveFileUrl, context) : null]);
	if (!targetManifestResult) return null;
	const changedAssets = await resolveChangedAssets({
		assetBaseStorageUri,
		currentManifest: currentManifestResult?.manifest ?? null,
		currentBundle,
		resolveFileUrl,
		targetBundle,
		targetManifest: targetManifestResult.manifest,
		context
	});
	if (!changedAssets) return null;
	return {
		changedAssets,
		manifestFileHash,
		manifestUrl: targetManifestResult.fileUrl
	};
}
//#endregion
export { parseBundleMetadata, resolveManifestArtifacts };
