//#region src/parseStorageUri.d.ts
interface ParsedStorageUri {
  protocol: string;
  bucket: string;
  key: string;
}
/**
 * Parses a storage URI and validates the protocol.
 *
 * @param storageUri - The storage URI to parse (e.g., "s3://bucket/path/to/file")
 * @param expectedProtocol - The expected protocol without colon (e.g., "s3", "r2", "gs")
 * @returns Parsed storage URI components
 * @throws Error if the URI is invalid or protocol doesn't match
 *
 * @example
 * ```typescript
 * const { bucket, key } = parseStorageUri("s3://my-bucket/path/to/file.zip", "s3");
 * // bucket: "my-bucket"
 * // key: "path/to/file.zip"
 * ```
 */
declare function parseStorageUri(storageUri: string, expectedProtocol: string): ParsedStorageUri;
//#endregion
export { ParsedStorageUri, parseStorageUri };