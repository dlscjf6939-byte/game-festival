//#region src/contentAddressedAssets.ts
const getContentAddressedAssetStoragePath = ({ assetPath, fileHash }) => {
	const extension = assetPath.endsWith(".br") ? ".br" : assetPath.includes(".") ? `.${assetPath.split(".").pop()}` : "";
	return `sha256/${fileHash.slice(0, 2)}/${fileHash}${extension}`;
};
//#endregion
exports.getContentAddressedAssetStoragePath = getContentAddressedAssetStoragePath;
