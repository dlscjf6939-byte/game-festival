//#region src/uuidv7.d.ts
declare const extractTimestampFromUUIDv7: (uuid: string) => number;
declare const createUUIDv7: () => string;
declare const createUUIDv7WithSameTimestamp: (originalUuid: string) => string;
//#endregion
export { createUUIDv7, createUUIDv7WithSameTimestamp, extractTimestampFromUUIDv7 };