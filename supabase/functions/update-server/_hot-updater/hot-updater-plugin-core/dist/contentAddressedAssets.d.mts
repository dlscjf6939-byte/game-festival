//#region src/contentAddressedAssets.d.ts
declare const getContentAddressedAssetStoragePath: ({
  assetPath,
  fileHash
}: {
  assetPath: string;
  fileHash: string;
}) => string;
//#endregion
export { getContentAddressedAssetStoragePath };