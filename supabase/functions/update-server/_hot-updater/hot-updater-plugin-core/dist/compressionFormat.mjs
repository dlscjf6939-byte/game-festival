import path from "node:path";
import mime from "mime";
//#region src/compressionFormat.ts
/**
* Compression formats registry
* Add new formats here to support additional compression types
*/
const COMPRESSION_FORMATS = {
	zip: {
		format: "zip",
		fileExtension: ".zip",
		mimeType: "application/zip"
	},
	"tar.br": {
		format: "tar.br",
		fileExtension: ".tar.br",
		mimeType: "application/x-tar"
	},
	"tar.gz": {
		format: "tar.gz",
		fileExtension: ".tar.gz",
		mimeType: "application/x-tar"
	}
};
/**
* Detects compression format from filename
* @param filename The filename to detect format from
* @returns Compression format information
*/
function detectCompressionFormat(filename) {
	for (const info of Object.values(COMPRESSION_FORMATS)) if (filename.endsWith(info.fileExtension)) return info;
	return COMPRESSION_FORMATS.zip;
}
/**
* Gets MIME type for a filename
* @param filename The filename to get MIME type for
* @returns MIME type string
*/
function getCompressionMimeType(filename) {
	return detectCompressionFormat(filename).mimeType;
}
/**
* Gets Content-Type for a bundle file with 3-tier fallback
* @param bundlePath The bundle file path
* @returns Content-Type string (never undefined, falls back to application/octet-stream)
*/
function getContentType(bundlePath) {
	const filename = path.basename(bundlePath);
	return mime.getType(bundlePath) ?? getCompressionMimeType(filename) ?? "application/octet-stream";
}
//#endregion
export { detectCompressionFormat, getCompressionMimeType, getContentType };
