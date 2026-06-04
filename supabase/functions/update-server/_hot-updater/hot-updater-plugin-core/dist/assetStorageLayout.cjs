const require_contentAddressedAssets = require("./contentAddressedAssets.cjs");
const require_legacyAssetStorageLayout = require("./legacyAssetStorageLayout.cjs");
//#region src/assetStorageLayout.ts
const createStorageUriWithRelativePath = ({ baseStorageUri, relativePath }) => {
	const storageUrl = new URL(baseStorageUri);
	storageUrl.pathname = `${storageUrl.pathname.replace(/\/+$/, "")}/${relativePath.replace(/\\/g, "/").split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/")}`;
	return storageUrl.toString();
};
const getAssetStorageLayout = (assetBaseStorageUri) => {
	const pathname = new URL(assetBaseStorageUri).pathname.replace(/\/+$/, "");
	return pathname.endsWith("/assets") || pathname === "/assets" ? "content-addressed" : "legacy-files";
};
const isContentAddressedAssetBaseStorageUri = (assetBaseStorageUri) => getAssetStorageLayout(assetBaseStorageUri) === "content-addressed";
const getManifestAssetStoragePath = ({ assetBaseStorageUri, assetPath, fileHash }) => {
	if (getAssetStorageLayout(assetBaseStorageUri) === "content-addressed") return require_contentAddressedAssets.getContentAddressedAssetStoragePath({
		assetPath,
		fileHash
	});
	return require_legacyAssetStorageLayout.getLegacyManifestAssetStoragePath({ assetPath });
};
const resolveManifestAssetStorageUri = ({ assetBaseStorageUri, assetPath, fileHash }) => createStorageUriWithRelativePath({
	baseStorageUri: assetBaseStorageUri,
	relativePath: getManifestAssetStoragePath({
		assetBaseStorageUri,
		assetPath,
		fileHash
	})
});
//#endregion
exports.createStorageUriWithRelativePath = createStorageUriWithRelativePath;
exports.getAssetStorageLayout = getAssetStorageLayout;
exports.getManifestAssetStoragePath = getManifestAssetStoragePath;
exports.isContentAddressedAssetBaseStorageUri = isContentAddressedAssetBaseStorageUri;
exports.resolveManifestAssetStorageUri = resolveManifestAssetStorageUri;
