import { addRoute, createRouter, findRoute } from "./internalRouter.mjs";
import { HOT_UPDATER_SERVER_VERSION } from "./version.mjs";
import semver from "semver";
//#region src/handler.ts
var HandlerBadRequestError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "HandlerBadRequestError";
	}
};
const SDK_VERSION_HEADER = "Hot-Updater-SDK-Version";
const EXPLICIT_NO_UPDATE_MIN_SDK_VERSION = "0.31.0";
const DEFAULT_BUNDLE_LIST_LIMIT = 50;
const MAX_BUNDLE_LIST_LIMIT = 100;
const supportsExplicitNoUpdateResponse = (request) => {
	const sdkVersion = request.headers.get(SDK_VERSION_HEADER)?.trim();
	if (!sdkVersion) return false;
	const normalizedSdkVersion = semver.valid(sdkVersion);
	return normalizedSdkVersion !== null && semver.gte(normalizedSdkVersion, EXPLICIT_NO_UPDATE_MIN_SDK_VERSION);
};
const serializeUpdateInfo = (updateInfo, request) => {
	if (updateInfo) return JSON.stringify(updateInfo);
	if (supportsExplicitNoUpdateResponse(request)) return JSON.stringify({ status: "UP_TO_DATE" });
	return JSON.stringify(null);
};
const handleVersion = async () => {
	return new Response(JSON.stringify({ version: HOT_UPDATER_SERVER_VERSION }), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const decodeMaybe = (value) => {
	if (value === void 0) return void 0;
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};
const isPlatform = (value) => {
	return value === "ios" || value === "android";
};
const requireRouteParam = (params, key) => {
	const value = params[key];
	if (!value) throw new HandlerBadRequestError(`Missing route parameter: ${key}`);
	return value;
};
const parseBooleanSearchParam = (url, key) => {
	const value = url.searchParams.get(key);
	if (value === null) return;
	if (value === "true") return true;
	if (value === "false") return false;
	throw new HandlerBadRequestError(`The '${key}' query parameter must be 'true' or 'false'.`);
};
const parseNullableStringSearchParam = (url, key) => {
	const value = url.searchParams.get(key);
	if (value === null) return;
	return value === "null" ? null : value;
};
const parseStringArraySearchParam = (url, key) => {
	const values = url.searchParams.getAll(key);
	return values.length > 0 ? values : void 0;
};
const parsePositiveIntegerSearchParam = (url, key, defaultValue, maxValue) => {
	const value = url.searchParams.get(key);
	if (value === null) return defaultValue;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxValue) throw new HandlerBadRequestError(`The '${key}' query parameter must be a positive integer between 1 and ${maxValue}.`);
	return parsed;
};
const requirePlatformParam = (params) => {
	const platform = requireRouteParam(params, "platform");
	if (!isPlatform(platform)) throw new HandlerBadRequestError(`Invalid platform: ${platform}. Expected 'ios' or 'android'.`);
	return platform;
};
const requireBundlePatchPayload = (payload, bundleId) => {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HandlerBadRequestError("Invalid bundle payload");
	const bundlePatch = payload;
	if (bundlePatch.id !== void 0 && bundlePatch.id !== bundleId) throw new HandlerBadRequestError("Bundle id mismatch");
	const { id: _ignoredId, ...rest } = bundlePatch;
	return rest;
};
const handleFingerprintUpdateWithCohort = async (params, request, api, context) => {
	const platform = requirePlatformParam(params);
	const fingerprintHash = requireRouteParam(params, "fingerprintHash");
	const channel = requireRouteParam(params, "channel");
	const minBundleId = requireRouteParam(params, "minBundleId");
	const bundleId = requireRouteParam(params, "bundleId");
	const updateInfo = await api.getAppUpdateInfo({
		_updateStrategy: "fingerprint",
		platform,
		fingerprintHash,
		channel,
		minBundleId,
		bundleId,
		cohort: decodeMaybe(params.cohort)
	}, context);
	return new Response(serializeUpdateInfo(updateInfo, request), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const handleAppVersionUpdateWithCohort = async (params, request, api, context) => {
	const platform = requirePlatformParam(params);
	const appVersion = requireRouteParam(params, "appVersion");
	const channel = requireRouteParam(params, "channel");
	const minBundleId = requireRouteParam(params, "minBundleId");
	const bundleId = requireRouteParam(params, "bundleId");
	const updateInfo = await api.getAppUpdateInfo({
		_updateStrategy: "appVersion",
		platform,
		appVersion,
		channel,
		minBundleId,
		bundleId,
		cohort: decodeMaybe(params.cohort)
	}, context);
	return new Response(serializeUpdateInfo(updateInfo, request), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const handleGetBundle = async (params, _request, api, context) => {
	const bundleId = requireRouteParam(params, "id");
	const bundle = await api.getBundleById(bundleId, context);
	if (!bundle) return new Response(JSON.stringify({ error: "Bundle not found" }), {
		status: 404,
		headers: { "Content-Type": "application/json" }
	});
	return new Response(JSON.stringify(bundle), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const handleGetBundles = async (_params, request, api, context) => {
	const url = new URL(request.url);
	const channel = url.searchParams.get("channel") ?? void 0;
	const platform = url.searchParams.get("platform");
	const limit = parsePositiveIntegerSearchParam(url, "limit", DEFAULT_BUNDLE_LIST_LIMIT, MAX_BUNDLE_LIST_LIMIT);
	const pageParam = url.searchParams.get("page");
	const offset = url.searchParams.get("offset");
	const after = url.searchParams.get("after") ?? void 0;
	const before = url.searchParams.get("before") ?? void 0;
	const enabled = parseBooleanSearchParam(url, "enabled");
	const targetAppVersion = parseNullableStringSearchParam(url, "targetAppVersion");
	const targetAppVersionIn = parseStringArraySearchParam(url, "targetAppVersionIn");
	const targetAppVersionNotNull = parseBooleanSearchParam(url, "targetAppVersionNotNull");
	const fingerprintHash = parseNullableStringSearchParam(url, "fingerprintHash");
	const idEq = url.searchParams.get("idEq") ?? void 0;
	const idGt = url.searchParams.get("idGt") ?? void 0;
	const idGte = url.searchParams.get("idGte") ?? void 0;
	const idLt = url.searchParams.get("idLt") ?? void 0;
	const idLte = url.searchParams.get("idLte") ?? void 0;
	const idIn = parseStringArraySearchParam(url, "idIn");
	const page = pageParam === null ? void 0 : Number.isInteger(Number(pageParam)) && Number(pageParam) > 0 ? Number(pageParam) : null;
	if (offset !== null) throw new HandlerBadRequestError("The 'offset' query parameter has been removed. Use 'after' or 'before' cursor pagination instead.");
	if (page === null) throw new HandlerBadRequestError("The 'page' query parameter must be a positive integer.");
	if (platform !== null && !isPlatform(platform)) throw new HandlerBadRequestError(`Invalid platform: ${platform}. Expected 'ios' or 'android'.`);
	const result = await api.getBundles({
		where: {
			...channel && { channel },
			...platform && { platform },
			...enabled !== void 0 && { enabled },
			...idEq || idGt || idGte || idLt || idLte || idIn && idIn.length > 0 ? { id: {
				...idEq && { eq: idEq },
				...idGt && { gt: idGt },
				...idGte && { gte: idGte },
				...idLt && { lt: idLt },
				...idLte && { lte: idLte },
				...idIn && idIn.length > 0 && { in: idIn }
			} } : {},
			...targetAppVersion !== void 0 && { targetAppVersion },
			...targetAppVersionIn && { targetAppVersionIn },
			...targetAppVersionNotNull !== void 0 && { targetAppVersionNotNull },
			...fingerprintHash !== void 0 && { fingerprintHash }
		},
		limit,
		page,
		cursor: after || before ? {
			after,
			before
		} : void 0
	}, context);
	return new Response(JSON.stringify(result), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const handleCreateBundles = async (_params, request, api, context) => {
	const body = await request.json();
	const bundles = Array.isArray(body) ? body : [body];
	for (const bundle of bundles) await api.insertBundle(bundle, context);
	return new Response(JSON.stringify({ success: true }), {
		status: 201,
		headers: { "Content-Type": "application/json" }
	});
};
const handleUpdateBundle = async (params, request, api, context) => {
	const bundleId = requireRouteParam(params, "id");
	const body = await request.json();
	const bundlePatch = requireBundlePatchPayload(Array.isArray(body) ? body[0] : body, bundleId);
	await api.updateBundleById(bundleId, bundlePatch, context);
	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const handleDeleteBundle = async (params, _request, api, context) => {
	const bundleId = requireRouteParam(params, "id");
	await api.deleteBundleById(bundleId, context);
	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const handleGetChannels = async (_params, _request, api, context) => {
	const response = { data: { channels: await api.getChannels(context) } };
	return new Response(JSON.stringify(response), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
const routes = {
	version: handleVersion,
	fingerprintUpdateWithCohort: handleFingerprintUpdateWithCohort,
	appVersionUpdateWithCohort: handleAppVersionUpdateWithCohort,
	getBundle: handleGetBundle,
	getBundles: handleGetBundles,
	createBundles: handleCreateBundles,
	updateBundle: handleUpdateBundle,
	deleteBundle: handleDeleteBundle,
	getChannels: handleGetChannels
};
/**
* Creates a Web Standard Request handler for Hot Updater API
* This handler is framework-agnostic and works with any runtime that
* supports standard Request/Response objects.
*/
function createHandler(api, options = {}) {
	const basePath = options.basePath ?? "/api";
	const routeOptions = {
		updateCheck: options.routes?.updateCheck ?? true,
		bundles: options.routes?.bundles ?? false
	};
	const router = createRouter();
	addRoute(router, "GET", "/version", "version");
	if (routeOptions.updateCheck) {
		addRoute(router, "GET", "/fingerprint/:platform/:fingerprintHash/:channel/:minBundleId/:bundleId", "fingerprintUpdateWithCohort");
		addRoute(router, "GET", "/fingerprint/:platform/:fingerprintHash/:channel/:minBundleId/:bundleId/:cohort", "fingerprintUpdateWithCohort");
		addRoute(router, "GET", "/app-version/:platform/:appVersion/:channel/:minBundleId/:bundleId", "appVersionUpdateWithCohort");
		addRoute(router, "GET", "/app-version/:platform/:appVersion/:channel/:minBundleId/:bundleId/:cohort", "appVersionUpdateWithCohort");
	}
	if (routeOptions.bundles) {
		addRoute(router, "GET", "/api/bundles/channels", "getChannels");
		addRoute(router, "GET", "/api/bundles/:id", "getBundle");
		addRoute(router, "GET", "/api/bundles", "getBundles");
		addRoute(router, "POST", "/api/bundles", "createBundles");
		addRoute(router, "PATCH", "/api/bundles/:id", "updateBundle");
		addRoute(router, "DELETE", "/api/bundles/:id", "deleteBundle");
	}
	return async (request, context) => {
		try {
			const path = new URL(request.url).pathname;
			const method = request.method;
			const match = findRoute(router, method, path.startsWith(basePath) ? path.slice(basePath.length) : path);
			if (!match) return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" }
			});
			const handler = routes[match.data];
			if (!handler) return new Response(JSON.stringify({ error: "Handler not found" }), {
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
			return await handler(match.params || {}, request, api, context);
		} catch (error) {
			if (error instanceof HandlerBadRequestError) return new Response(JSON.stringify({ error: error.message }), {
				status: 400,
				headers: { "Content-Type": "application/json" }
			});
			console.error("Hot Updater handler error:", error);
			return new Response(JSON.stringify({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error"
			}), {
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
		}
	};
}
//#endregion
export { createHandler };
