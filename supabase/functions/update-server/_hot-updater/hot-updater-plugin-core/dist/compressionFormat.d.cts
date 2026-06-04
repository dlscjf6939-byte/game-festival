//#region src/compressionFormat.d.ts
/**
 * Compression format type definition
 */
type CompressionFormat = "zip" | "tar.br" | "tar.gz";
/**
 * Compression format metadata
 */
interface CompressionFormatInfo {
  format: CompressionFormat;
  fileExtension: string;
  mimeType?: string;
}
/**
 * Detects compression format from filename
 * @param filename The filename to detect format from
 * @returns Compression format information
 */
declare function detectCompressionFormat(filename: string): CompressionFormatInfo;
/**
 * Gets MIME type for a filename
 * @param filename The filename to get MIME type for
 * @returns MIME type string
 */
declare function getCompressionMimeType(filename: string): string | undefined;
/**
 * Gets Content-Type for a bundle file with 3-tier fallback
 * @param bundlePath The bundle file path
 * @returns Content-Type string (never undefined, falls back to application/octet-stream)
 */
declare function getContentType(bundlePath: string): string;
//#endregion
export { CompressionFormat, CompressionFormatInfo, detectCompressionFormat, getCompressionMimeType, getContentType };