const require_runtime = require("./_virtual/_rolldown/runtime.cjs");
let node_path = require("node:path");
node_path = require_runtime.__toESM(node_path);
let mime = require("mime");
mime = require_runtime.__toESM(mime);
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
	const filename = node_path.default.basename(bundlePath);
	return mime.default.getType(bundlePath) ?? getCompressionMimeType(filename) ?? "application/octet-stream";
}
//#endregion
exports.detectCompressionFormat = detectCompressionFormat;
exports.getCompressionMimeType = getCompressionMimeType;
exports.getContentType = getContentType;
