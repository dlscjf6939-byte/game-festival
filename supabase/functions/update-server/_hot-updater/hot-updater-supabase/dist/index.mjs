import { i as resolveSupabaseServiceRoleKey, n as supabaseEdgeFunctionDatabase, r as supabaseDatabase, t as supabaseEdgeFunctionStorage } from "./supabaseEdgeFunctionStorage-B4KN0khj.mjs";
import { createStorageKeyBuilder, createUniversalStoragePlugin, getContentType, parseStorageUri } from "@hot-updater/plugin-core";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
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
const supabaseStorage = createUniversalStoragePlugin({
	name: "supabaseStorage",
	supportedProtocol: "supabase-storage",
	factory: (config) => {
		const bucket = createClient(config.supabaseUrl, resolveSupabaseServiceRoleKey(config)).storage.from(config.bucketName);
		const getStorageKey = createStorageKeyBuilder(config.basePath);
		return {
			node: {
				async delete(storageUri) {
					const { key, bucket: bucketName } = parseStorageUri(storageUri, "supabase-storage");
					if (bucketName !== config.bucketName) throw new Error(`Bucket name mismatch: expected "${config.bucketName}", but found "${bucketName}".`);
					const { error } = await bucket.remove([key]);
					if (error) {
						if (error.message?.includes("not found")) throw new Error(`Bundle not found`);
						throw new Error(`Failed to delete bundle: ${error.message}`);
					}
				},
				async upload(key, filePath) {
					const Body = await fs.readFile(filePath);
					const ContentType = getContentType(filePath);
					const Key = getStorageKey(key, path.basename(filePath));
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
					const { key, bucket: bucketName } = parseStorageUri(storageUri, "supabase-storage");
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
					const { key, bucket: bucketName } = parseStorageUri(storageUri, "supabase-storage");
					if (bucketName !== config.bucketName) throw new Error(`Bucket name mismatch: expected "${config.bucketName}", but found "${bucketName}".`);
					const { data, error } = await bucket.download(key);
					if (error) throw new Error(`Failed to download bundle: ${error.message}`);
					if (!data) throw new Error("Failed to download bundle");
					await fs.mkdir(path.dirname(filePath), { recursive: true });
					await fs.writeFile(filePath, new Uint8Array(await data.arrayBuffer()));
				}
			},
			runtime: {
				async readText(storageUri) {
					const { key, bucket: bucketName } = parseStorageUri(storageUri, "supabase-storage");
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
export { supabaseDatabase, supabaseEdgeFunctionDatabase, supabaseEdgeFunctionStorage, supabaseStorage };
