//#region src/storageAccess.ts
const assertRemoteDownloadUrl = (fileUrl) => {
	try {
		const protocol = new URL(fileUrl).protocol.replace(":", "");
		if (protocol === "http" || protocol === "https") return fileUrl;
	} catch {}
	throw new Error("Storage plugin returned a local file path; runtime update checks require an HTTP(S) download URL.");
};
const getStorageProtocol = (storageUri) => new URL(storageUri).protocol.replace(":", "");
const isRemoteUrlProtocol = (protocol) => protocol === "http" || protocol === "https";
const createStorageAccess = (storagePlugins) => {
	const findStoragePlugin = (protocol) => {
		return storagePlugins.find((item) => item.supportedProtocol === protocol);
	};
	const resolveFileUrl = async (storageUri, context) => {
		if (!storageUri) return null;
		const protocol = getStorageProtocol(storageUri);
		const plugin = findStoragePlugin(protocol);
		if (plugin) {
			const { fileUrl } = await plugin.profiles.runtime.getDownloadUrl(storageUri, context);
			if (!fileUrl) throw new Error("Storage plugin returned empty fileUrl");
			return assertRemoteDownloadUrl(fileUrl);
		}
		if (isRemoteUrlProtocol(protocol)) return storageUri;
		throw new Error(`No storage plugin for protocol: ${protocol}`);
	};
	const readStorageText = async (storageUri, context) => {
		const protocol = getStorageProtocol(storageUri);
		const plugin = findStoragePlugin(protocol);
		if (plugin) return plugin.profiles.runtime.readText(storageUri, context);
		if (isRemoteUrlProtocol(protocol)) {
			const response = await fetch(storageUri);
			if (!response.ok) return null;
			return response.text();
		}
		throw new Error(`No storage plugin for protocol: ${protocol}`);
	};
	return {
		readStorageText,
		resolveFileUrl
	};
};
//#endregion
export { createStorageAccess };
