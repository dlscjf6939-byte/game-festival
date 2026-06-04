//#region src/createStorageKeyBuilder.ts
const createStorageKeyBuilder = (basePath) => (...args) => {
	return [basePath || "", ...args].filter(Boolean).join("/");
};
//#endregion
export { createStorageKeyBuilder };
