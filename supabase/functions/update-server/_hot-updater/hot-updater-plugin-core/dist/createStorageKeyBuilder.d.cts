//#region src/createStorageKeyBuilder.d.ts
declare const createStorageKeyBuilder: (basePath: string | undefined) => (...args: string[]) => string;
//#endregion
export { createStorageKeyBuilder };