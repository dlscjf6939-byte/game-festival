//#region src/createStoragePlugin.ts
const wrapNodeProfile = (node, hooks) => ({
	...node,
	async upload(key, filePath) {
		const result = await node.upload(key, filePath);
		await hooks?.onStorageUploaded?.();
		return result;
	}
});
const createProfiledStoragePlugin = ({ createProfiles, name, profileShape, supportedProtocol }, hooks) => {
	let cachedProfiles = null;
	let cachedNodeProfile;
	let cachedRuntimeProfile;
	const getProfiles = () => {
		cachedProfiles ??= createProfiles();
		return cachedProfiles;
	};
	const getNodeProfile = () => {
		const node = getProfiles().node;
		if (!node) return;
		cachedNodeProfile ??= wrapNodeProfile(node, hooks);
		return cachedNodeProfile;
	};
	const requireNodeProfile = () => {
		const node = getNodeProfile();
		if (!node) throw new Error(`${name} does not implement the node storage profile for protocol "${supportedProtocol}".`);
		return node;
	};
	const getRuntimeProfile = () => {
		const runtime = getProfiles().runtime;
		if (!runtime) return;
		cachedRuntimeProfile ??= runtime;
		return cachedRuntimeProfile;
	};
	const requireRuntimeProfile = () => {
		const runtime = getRuntimeProfile();
		if (!runtime) throw new Error(`${name} does not implement the runtime storage profile for protocol "${supportedProtocol}".`);
		return runtime;
	};
	const profiles = {};
	if (profileShape?.node) profiles.node = {
		async delete(storageUri) {
			return requireNodeProfile().delete(storageUri);
		},
		async downloadFile(storageUri, filePath) {
			return requireNodeProfile().downloadFile(storageUri, filePath);
		},
		async exists(storageUri) {
			return requireNodeProfile().exists(storageUri);
		},
		async upload(key, filePath) {
			return requireNodeProfile().upload(key, filePath);
		}
	};
	else if (profileShape?.node !== false) Object.defineProperty(profiles, "node", {
		enumerable: true,
		get: getNodeProfile
	});
	if (profileShape?.runtime) profiles.runtime = {
		async getDownloadUrl(storageUri, context) {
			return requireRuntimeProfile().getDownloadUrl(storageUri, context);
		},
		async readText(storageUri, context) {
			return requireRuntimeProfile().readText(storageUri, context);
		}
	};
	else if (profileShape?.runtime !== false) Object.defineProperty(profiles, "runtime", {
		enumerable: true,
		get: getRuntimeProfile
	});
	return {
		name,
		supportedProtocol,
		profiles
	};
};
/**
* Creates a deploy/CLI/console storage plugin.
*/
const createNodeStoragePlugin = (options) => {
	return (config, hooks) => {
		return () => createProfiledStoragePlugin({
			createProfiles: () => ({ node: options.factory(config) }),
			name: options.name,
			profileShape: {
				node: true,
				runtime: false
			},
			supportedProtocol: options.supportedProtocol
		}, hooks);
	};
};
/**
* Creates an update-check runtime storage plugin.
*/
const createRuntimeStoragePlugin = (options) => {
	return (config, hooks) => {
		return () => createProfiledStoragePlugin({
			createProfiles: () => ({ runtime: options.factory(config) }),
			name: options.name,
			profileShape: {
				node: false,
				runtime: true
			},
			supportedProtocol: options.supportedProtocol
		}, hooks);
	};
};
/**
* Creates a storage plugin that can be used by both Node tooling and update
* check runtimes.
*/
const createUniversalStoragePlugin = (options) => {
	return (config, hooks) => {
		return () => createProfiledStoragePlugin({
			createProfiles: () => options.factory(config),
			name: options.name,
			profileShape: {
				node: true,
				runtime: true
			},
			supportedProtocol: options.supportedProtocol
		}, hooks);
	};
};
//#endregion
export { createNodeStoragePlugin, createRuntimeStoragePlugin, createUniversalStoragePlugin };
