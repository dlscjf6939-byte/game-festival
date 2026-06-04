//#region src/assetStorageLayout.d.ts
type AssetStorageLayout = "content-addressed" | "legacy-files";
declare const createStorageUriWithRelativePath: ({
  baseStorageUri,
  relativePath
}: {
  baseStorageUri: string;
  relativePath: string;
}) => string;
declare const getAssetStorageLayout: (assetBaseStorageUri: string) => AssetStorageLayout;
declare const isContentAddressedAssetBaseStorageUri: (assetBaseStorageUri: string) => boolean;
declare const getManifestAssetStoragePath: ({
  assetBaseStorageUri,
  assetPath,
  fileHash
}: {
  assetBaseStorageUri: string;
  assetPath: string;
  fileHash: string;
}) => string;
declare const resolveManifestAssetStorageUri: ({
  assetBaseStorageUri,
  assetPath,
  fileHash
}: {
  assetBaseStorageUri: string;
  assetPath: string;
  fileHash: string;
}) => string;
//#endregion
export { AssetStorageLayout, createStorageUriWithRelativePath, getAssetStorageLayout, getManifestAssetStoragePath, isContentAddressedAssetBaseStorageUri, resolveManifestAssetStorageUri };