const require_runtime = require("../_virtual/_rolldown/runtime.cjs");
let _hot_updater_plugin_core = require("@hot-updater/plugin-core");
let node_crypto = require("node:crypto");
node_crypto = require_runtime.__toESM(node_crypto);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_runtime.__toESM(node_fs_promises);
let node_os = require("node:os");
node_os = require_runtime.__toESM(node_os);
let node_path = require("node:path");
node_path = require_runtime.__toESM(node_path);
let node_util = require("node:util");
let node_zlib = require("node:zlib");
let _hot_updater_bsdiff = require("@hot-updater/bsdiff");
let _hot_updater_core = require("@hot-updater/core");
//#region src/db/createBundleDiff.ts
const HBC_ASSET_PATH_RE = /\.bundle$/;
const BR_COMPRESSED_ASSET_PATH_RE = /(^|\/)index\.[^/]+\.bundle$/;
const HOT_UPDATER_DOWNLOAD_DIR_PREFIX = "downloads-";
const decompressBrotli = (0, node_util.promisify)(node_zlib.brotliDecompress);
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
const getRelativeStorageDir = (relativePath) => {
	const normalized = relativePath.replace(/\\/g, "/");
	const dirname = node_path.default.posix.dirname(normalized);
	return dirname === "." ? "" : dirname;
};
async function downloadFromUrl(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to download storage object: ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}
async function downloadStorageBytes(storageUri, storagePlugin) {
	const protocol = new URL(storageUri).protocol.replace(":", "");
	if (protocol === "http" || protocol === "https") return downloadFromUrl(storageUri);
	if (!storagePlugin) throw new Error("Storage plugin is not configured");
	if (storagePlugin.supportedProtocol !== protocol) throw new Error(`No storage plugin for protocol: ${protocol}`);
	const downloadRoot = node_path.default.join(process.cwd(), ".hot-updater");
	await node_fs_promises.default.mkdir(downloadRoot, { recursive: true });
	const workDir = await node_fs_promises.default.mkdtemp(node_path.default.join(downloadRoot, HOT_UPDATER_DOWNLOAD_DIR_PREFIX));
	const filename = node_path.default.basename(new URL(storageUri).pathname) || (0, node_crypto.randomUUID)();
	const filePath = node_path.default.join(workDir, filename);
	try {
		await storagePlugin.profiles.node.downloadFile(storageUri, filePath);
		return new Uint8Array(await node_fs_promises.default.readFile(filePath));
	} finally {
		await node_fs_promises.default.rm(workDir, {
			force: true,
			recursive: true
		});
	}
}
async function fetchManifest(bundle, storagePlugin) {
	const manifestStorageUri = (0, _hot_updater_core.getManifestStorageUri)(bundle);
	if (!manifestStorageUri) throw new Error(`Bundle ${bundle.id} does not have manifest metadata`);
	const manifestBytes = await downloadStorageBytes(manifestStorageUri, storagePlugin);
	const payload = JSON.parse(new TextDecoder().decode(manifestBytes));
	if (!isBundleManifest(payload)) throw new Error(`Invalid manifest payload for bundle ${bundle.id}`);
	return payload;
}
function resolveHbcAssetPath(manifest) {
	const candidates = Object.keys(manifest.assets).sort((left, right) => left.localeCompare(right)).filter((candidate) => HBC_ASSET_PATH_RE.test(candidate));
	if (candidates.length === 0) throw new Error("No Hermes bundle asset found in manifest");
	if (candidates.length > 1) throw new Error(`Expected exactly one Hermes bundle asset in manifest, found ${candidates.length}: ${candidates.join(", ")}`);
	return candidates[0];
}
async function fetchAssetBytes(bundle, assetPath, manifest, storagePlugin) {
	const assetBaseStorageUri = (0, _hot_updater_core.getAssetBaseStorageUri)(bundle);
	if (!assetBaseStorageUri) throw new Error(`Bundle ${bundle.id} does not have asset storage metadata`);
	const asset = manifest.assets[assetPath];
	if (!asset) throw new Error(`Asset ${assetPath} is missing from manifest`);
	if (BR_COMPRESSED_ASSET_PATH_RE.test(assetPath)) {
		const compressedAssetStorageUri = (0, _hot_updater_plugin_core.resolveManifestAssetStorageUri)({
			assetBaseStorageUri,
			assetPath: `${assetPath}.br`,
			fileHash: asset.fileHash
		});
		let compressedBytes = null;
		try {
			compressedBytes = await downloadStorageBytes(compressedAssetStorageUri, storagePlugin);
		} catch {}
		if (compressedBytes) return new Uint8Array(await decompressBrotli(compressedBytes));
	}
	return downloadStorageBytes((0, _hot_updater_plugin_core.resolveManifestAssetStorageUri)({
		assetBaseStorageUri,
		assetPath,
		fileHash: asset.fileHash
	}), storagePlugin);
}
async function getFileHash(filePath) {
	const file = await node_fs_promises.default.readFile(filePath);
	return node_crypto.default.createHash("sha256").update(file).digest("hex");
}
function buildNextPatchState({ currentBundle, nextPatch, makePrimary }) {
	const existingPatches = (0, _hot_updater_core.getBundlePatches)(currentBundle).filter((patch) => patch.baseBundleId !== nextPatch.baseBundleId);
	const orderedPatches = makePrimary ? [nextPatch, ...existingPatches] : [...existingPatches, nextPatch];
	return {
		patches: orderedPatches,
		primaryPatch: orderedPatches[0] ?? nextPatch
	};
}
async function createBundleDiff({ baseBundleId, bundleId }, deps, options = {}) {
	if (!deps.storagePlugin) throw new Error("Storage plugin is not configured");
	if (baseBundleId === bundleId) throw new Error("Base bundle must be different from the target bundle");
	const baseBundle = await deps.databasePlugin.getBundleById(baseBundleId);
	const targetBundle = await deps.databasePlugin.getBundleById(bundleId);
	if (!baseBundle || !targetBundle) throw new Error("Bundle not found");
	if (baseBundle.platform !== targetBundle.platform) throw new Error("Base bundle platform must match the target bundle");
	if (baseBundle.id.localeCompare(targetBundle.id) >= 0) throw new Error("Base bundle must be older than the target bundle");
	const [baseManifest, targetManifest] = await Promise.all([fetchManifest(baseBundle, deps.storagePlugin), fetchManifest(targetBundle, deps.storagePlugin)]);
	const baseAssetPath = resolveHbcAssetPath(baseManifest);
	const targetAssetPath = resolveHbcAssetPath(targetManifest);
	if (baseAssetPath !== targetAssetPath) throw new Error("Base and target Hermes asset paths do not match");
	const baseAssetHash = baseManifest.assets[baseAssetPath]?.fileHash;
	const targetAssetHash = targetManifest.assets[targetAssetPath]?.fileHash;
	if (!baseAssetHash || !targetAssetHash) throw new Error("Hermes asset hash is missing from manifest");
	if (baseAssetHash === targetAssetHash) throw new Error("Hermes bundle is unchanged; no diff patch is required");
	const [baseBytes, targetBytes] = await Promise.all([fetchAssetBytes(baseBundle, baseAssetPath, baseManifest, deps.storagePlugin), fetchAssetBytes(targetBundle, targetAssetPath, targetManifest, deps.storagePlugin)]);
	const patchBytes = await (0, _hot_updater_bsdiff.hdiff)(baseBytes, targetBytes);
	const workDir = await node_fs_promises.default.mkdtemp(node_path.default.join(node_os.default.tmpdir(), "hot-updater-console-bsdiff-"));
	const patchFilename = `${node_path.default.posix.basename(targetAssetPath)}.bsdiff`;
	const patchPath = node_path.default.join(workDir, patchFilename);
	const previousPatch = (0, _hot_updater_core.getBundlePatch)(targetBundle, baseBundle.id);
	try {
		await node_fs_promises.default.writeFile(patchPath, patchBytes);
		const uploadKey = [
			targetBundle.id,
			"patches",
			baseBundle.id,
			getRelativeStorageDir(targetAssetPath)
		].filter(Boolean).join("/");
		const patchUpload = await deps.storagePlugin.profiles.node.upload(uploadKey, patchPath);
		const patchFileHash = await getFileHash(patchPath);
		const nextState = buildNextPatchState({
			currentBundle: targetBundle,
			nextPatch: {
				baseBundleId: baseBundle.id,
				baseFileHash: baseAssetHash,
				patchFileHash,
				patchStorageUri: patchUpload.storageUri
			},
			makePrimary: options.makePrimary ?? true
		});
		await deps.databasePlugin.updateBundle(targetBundle.id, {
			patches: nextState.patches,
			patchBaseBundleId: nextState.primaryPatch.baseBundleId,
			patchBaseFileHash: nextState.primaryPatch.baseFileHash,
			patchFileHash: nextState.primaryPatch.patchFileHash,
			patchStorageUri: nextState.primaryPatch.patchStorageUri
		});
		await deps.databasePlugin.commitBundle();
		if (previousPatch?.patchStorageUri && previousPatch.patchStorageUri !== patchUpload.storageUri) await deps.storagePlugin.profiles.node.delete(previousPatch.patchStorageUri).catch(() => {});
		const updatedBundle = await deps.databasePlugin.getBundleById(targetBundle.id);
		if (!updatedBundle) throw new Error("Updated bundle not found");
		return updatedBundle;
	} finally {
		await node_fs_promises.default.rm(workDir, {
			force: true,
			recursive: true
		});
	}
}
//#endregion
exports.createBundleDiff = createBundleDiff;
