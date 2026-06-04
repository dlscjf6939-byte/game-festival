Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
const require_supabaseEdgeFunctionStorage = require("./supabaseEdgeFunctionStorage-D933mGy9.cjs");
let _hot_updater_plugin_core = require("@hot-updater/plugin-core");
let _supabase_supabase_js = require("@supabase/supabase-js");
let fs_promises = require("fs/promises");
fs_promises = __toESM(fs_promises);
let path = require("path");
path = __toESM(path);
//#region src/supabaseStorage.ts
function getErrorMessage(error) {
	if (error instanceof Error) return error.message;
	if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
	return String(error);
}
async function createSignedUrlOrThrow({ bucket, key, expiresIn }) {
	let data = null;
	let error = null;
	try {
		const response = await bucket.createSignedUrl(key, expiresIn);
		data = response.data;
		error = response.error;
	} catch (thrownError) {
		error = thrownError;
	}
	if (!error && data?.signedUrl) return data.signedUrl;
	throw new Error(`Failed to generate download URL for "${key}": ${getErrorMessage(error ?? /* @__PURE__ */ new Error("missing signed URL"))}`);
}
async function verifyObjectCanBeSignedForRuntime({ bucket, key }) {
	await createSignedUrlOrThrow({
		bucket,
		key,
		expiresIn: 3600
	});
}
const supabaseStorage = (0, _hot_updater_plugin_core.createUniversalStoragePlugin)({
	name: "supabaseStorage",
	supportedProtocol: "supabase-storage",
	factory: (config) => {
		const bucket = (0, _supabase_supabase_js.createClient)(config.supabaseUrl, require_supabaseEdgeFunctionStorage.resolveSupabaseServiceRoleKey(config)).storage.from(config.bucketName);
		const getStorageKey = (0, _hot_updater_plugin_core.createStorageKeyBuilder)(config.basePath);
		return {
			node: {
				async delete(storageUri) {
					const { key, bucket: bucketName } = (0, _hot_updater_plugin_core.parseStorageUri)(storageUri, "supabase-storage");
					if (bucketName !== config.bucketName) throw new Error(`Bucket name mismatch: expected "${config.bucketName}", but found "${bucketName}".`);
					const { error } = await bucket.remove([key]);
					if (error) {
						if (error.message?.includes("not found")) throw new Error(`Bundle not found`);
						throw new Error(`Failed to delete bundle: ${error.message}`);
					}
				},
				async upload(key, filePath) {
					const Body = await fs_promises.default.readFile(filePath);
					const ContentType = (0, _hot_updater_plugin_core.getContentType)(filePath);
					const Key = getStorageKey(key, path.default.basename(filePath));
					const upload = await bucket.upload(Key, Body, {
						contentType: ContentType,
						cacheControl: "max-age=31536000",
						headers: {}
					});
					if (upload.error) throw upload.error;
					await verifyObjectCanBeSignedForRuntime({
						bucket,
						key: Key
					});
					return { storageUri: `supabase-storage://${upload.data.fullPath}` };
				},
				async exists(storageUri) {
					const { key, bucket: bucketName } = (0, _hot_updater_plugin_core.parseStorageUri)(storageUri, "supabase-storage");
					if (bucketName !== config.bucketName) throw new Error(`Bucket name mismatch: expected "${config.bucketName}", but found "${bucketName}".`);
					const { data, error } = await bucket.exists(key);
					if (data === false) return false;
					if (error) throw error;
					await verifyObjectCanBeSignedForRuntime({
						bucket,
						key
					});
					return data;
				},
				async downloadFile(storageUri, filePath) {
					const { key, bucket: bucketName } = (0, _hot_updater_plugin_core.parseStorageUri)(storageUri, "supabase-storage");
					if (bucketName !== config.bucketName) throw new Error(`Bucket name mismatch: expected "${config.bucketName}", but found "${bucketName}".`);
					const { data, error } = await bucket.download(key);
					if (error) throw new Error(`Failed to download bundle: ${error.message}`);
					if (!data) throw new Error("Failed to download bundle");
					await fs_promises.default.mkdir(path.default.dirname(filePath), { recursive: true });
					await fs_promises.default.writeFile(filePath, new Uint8Array(await data.arrayBuffer()));
				}
			},
			runtime: {
				async readText(storageUri) {
					const { key, bucket: bucketName } = (0, _hot_updater_plugin_core.parseStorageUri)(storageUri, "supabase-storage");
					if (bucketName !== config.bucketName) throw new Error(`Bucket name mismatch: expected "${config.bucketName}", but found "${bucketName}".`);
					const { data, error } = await bucket.download(key);
					if (error) {
						if (error.message?.includes("not found")) return null;
						throw new Error(`Failed to read storage text: ${error.message}`);
					}
					if (!data) return null;
					return data.text();
				},
				async getDownloadUrl(storageUri) {
					const u = new URL(storageUri);
					if (u.protocol.replace(":", "") !== "supabase-storage") throw new Error("Invalid Supabase storage URI protocol");
					let key = `${u.host}${u.pathname}`.replace(/^\//, "");
					if (!key) throw new Error("Invalid Supabase storage URI: missing key");
					if (key.startsWith(`${config.bucketName}/`)) key = key.substring(`${config.bucketName}/`.length);
					return { fileUrl: await createSignedUrlOrThrow({
						bucket,
						key,
						expiresIn: 3600
					}) };
				}
			}
		};
	}
});
//#endregion
exports.__toESM = __toESM;
exports.supabaseDatabase = require_supabaseEdgeFunctionStorage.supabaseDatabase;
exports.supabaseEdgeFunctionDatabase = require_supabaseEdgeFunctionStorage.supabaseEdgeFunctionDatabase;
exports.supabaseEdgeFunctionStorage = require_supabaseEdgeFunctionStorage.supabaseEdgeFunctionStorage;
exports.supabaseStorage = supabaseStorage;
