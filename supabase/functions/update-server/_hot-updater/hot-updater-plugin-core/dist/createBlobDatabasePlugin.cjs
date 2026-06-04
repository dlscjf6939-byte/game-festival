const require_runtime = require("./_virtual/_rolldown/runtime.cjs");
const require_calculatePagination = require("./calculatePagination.cjs");
const require_createDatabasePlugin = require("./createDatabasePlugin.cjs");
const require_filterCompatibleAppVersions = require("./filterCompatibleAppVersions.cjs");
const require_queryBundles = require("./queryBundles.cjs");
const require_paginateBundles = require("./paginateBundles.cjs");
let _hot_updater_js = require("@hot-updater/js");
let es_toolkit = require("es-toolkit");
let semver = require("semver");
semver = require_runtime.__toESM(semver);
//#region src/createBlobDatabasePlugin.ts
function removeBundleInternalKeys(bundle) {
	const { _updateJsonKey, _oldUpdateJsonKey, ...pureBundle } = bundle;
	return pureBundle;
}
function normalizeTargetAppVersion(version) {
	if (!version) return null;
	let normalized = version.replace(/\s+/g, " ").trim();
	normalized = normalized.replace(/([><=~^]+)\s+(\d)/g, (_match, operator, digit) => `${operator}${digit}`);
	return normalized;
}
function isExactVersion(version) {
	if (!version) return false;
	const normalized = normalizeTargetAppVersion(version);
	if (!normalized) return false;
	return semver.default.valid(normalized) !== null;
}
/**
* Get all normalized semver versions for a version string.
* This handles the case where clients may request with different normalized forms.
*
* Examples:
* - "1.0.0" generates ["1.0.0", "1.0", "1"]
* - "2.1.0" generates ["2.1.0", "2.1"]
* - "1.2.3" generates ["1.2.3"]
*/
function getSemverNormalizedVersions(version) {
	const normalized = normalizeTargetAppVersion(version) || version;
	const coerced = semver.default.coerce(normalized);
	if (!coerced) return [normalized];
	const versions = /* @__PURE__ */ new Set();
	versions.add(coerced.version);
	if (coerced.patch === 0) versions.add(`${coerced.major}.${coerced.minor}`);
	if (coerced.minor === 0 && coerced.patch === 0) versions.add(`${coerced.major}`);
	return Array.from(versions);
}
function resolveStorageTarget({ targetAppVersion, fingerprintHash }) {
	const target = normalizeTargetAppVersion(targetAppVersion) ?? fingerprintHash;
	if (!target) throw new Error("target not found");
	return target;
}
const DEFAULT_DESC_ORDER = {
	field: "id",
	direction: "desc"
};
const MANAGEMENT_INDEX_PREFIX = "_index";
const MANAGEMENT_INDEX_VERSION = 1;
const DEFAULT_MANAGEMENT_INDEX_PAGE_SIZE = 128;
const ALL_SCOPE_CACHE_KEY = "*|*";
function resolveManagementIndexPageSize(config) {
	const pageSize = config.managementIndexPageSize ?? DEFAULT_MANAGEMENT_INDEX_PAGE_SIZE;
	if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("managementIndexPageSize must be a positive integer.");
	return pageSize;
}
function sortManagedBundles(bundles, orderBy = DEFAULT_DESC_ORDER) {
	return require_queryBundles.sortBundles(bundles, orderBy);
}
function isDefaultManagementOrder(orderBy) {
	return orderBy === void 0 || orderBy.field === DEFAULT_DESC_ORDER.field && orderBy.direction === DEFAULT_DESC_ORDER.direction;
}
function hasUnsupportedManagementFilters(where) {
	if (!where) return false;
	return Boolean(where.enabled !== void 0 || where.id !== void 0 || where.targetAppVersion !== void 0 || where.targetAppVersionIn !== void 0 || where.targetAppVersionNotNull !== void 0 || where.fingerprintHash !== void 0);
}
function getSupportedManagementScope(where, orderBy) {
	if (!isDefaultManagementOrder(orderBy) || hasUnsupportedManagementFilters(where)) return null;
	return {
		channel: where?.channel,
		platform: where?.platform
	};
}
function encodeScopePart(value) {
	return encodeURIComponent(value);
}
function getManagementScopeCacheKey({ channel, platform }) {
	return `${channel ?? "*"}|${platform ?? "*"}`;
}
function getManagementScopePrefix({ channel, platform }) {
	if (channel && platform) return `${MANAGEMENT_INDEX_PREFIX}/channel/${encodeScopePart(channel)}/platform/${platform}`;
	if (channel) return `${MANAGEMENT_INDEX_PREFIX}/channel/${encodeScopePart(channel)}`;
	if (platform) return `${MANAGEMENT_INDEX_PREFIX}/platform/${platform}`;
	return `${MANAGEMENT_INDEX_PREFIX}/all`;
}
function getManagementRootKey(scope) {
	return `${getManagementScopePrefix(scope)}/root.json`;
}
function getManagementPageKey(scope, pageIndex) {
	return `${getManagementScopePrefix(scope)}/pages/${String(pageIndex).padStart(4, "0")}.json`;
}
function createBundleWithUpdateJsonKey(bundle) {
	const target = resolveStorageTarget(bundle);
	return {
		...bundle,
		_updateJsonKey: `${bundle.channel}/${bundle.platform}/${target}/update.json`
	};
}
function getPageStartOffsets(pages) {
	const startOffsets = [];
	let offset = 0;
	for (const page of pages) {
		startOffsets.push(offset);
		offset += page.count;
	}
	return startOffsets;
}
function createEmptyManagementResult(limit) {
	return {
		data: [],
		pagination: require_calculatePagination.calculatePagination(0, {
			limit,
			offset: 0
		})
	};
}
function buildManagementIndexArtifacts(allBundles, pageSize) {
	const sortedAllBundles = sortManagedBundles(allBundles);
	const pages = /* @__PURE__ */ new Map();
	const scopes = [];
	const channels = [...new Set(sortedAllBundles.map((bundle) => bundle.channel))].sort();
	const addScope = (scope, scopeBundles, options) => {
		if (!options?.includeChannels && scopeBundles.length === 0) return;
		const pageKeys = [];
		const pageDescriptors = [];
		for (let pageIndex = 0; pageIndex * pageSize < scopeBundles.length; pageIndex++) {
			const page = scopeBundles.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
			const key = getManagementPageKey(scope, pageIndex);
			pages.set(key, page);
			pageKeys.push(key);
			pageDescriptors.push({
				key,
				count: page.length,
				firstId: page[0].id,
				lastId: page.at(-1).id
			});
		}
		const root = {
			version: MANAGEMENT_INDEX_VERSION,
			pageSize,
			total: scopeBundles.length,
			pages: pageDescriptors,
			...options?.includeChannels ? { channels } : {}
		};
		scopes.push({
			cacheKey: getManagementScopeCacheKey(scope),
			rootKey: getManagementRootKey(scope),
			root,
			pageKeys
		});
	};
	addScope({}, sortedAllBundles, { includeChannels: true });
	for (const channel of channels) {
		const channelBundles = sortedAllBundles.filter((bundle) => bundle.channel === channel);
		addScope({ channel }, channelBundles);
		for (const platform of ["ios", "android"]) {
			const scopedBundles = channelBundles.filter((bundle) => bundle.platform === platform);
			addScope({
				channel,
				platform
			}, scopedBundles);
		}
	}
	for (const platform of ["ios", "android"]) {
		const platformBundles = sortedAllBundles.filter((bundle) => bundle.platform === platform);
		addScope({ platform }, platformBundles);
	}
	return {
		pages,
		scopes
	};
}
/**
* Creates a blob storage-based database plugin with lazy initialization.
*
* @param name - The name of the database plugin
* @param factory - Function that creates blob storage operations from config
* @returns A double-curried function that lazily initializes the database plugin
*/
const createBlobDatabasePlugin = ({ name, factory }) => {
	return (config, hooks) => {
		const managementIndexPageSize = resolveManagementIndexPageSize(config);
		const { listObjects, loadObject, uploadObject, deleteObject, invalidatePaths, apiBasePath } = factory(config);
		const bundlesMap = /* @__PURE__ */ new Map();
		const pendingBundlesMap = /* @__PURE__ */ new Map();
		const managementRootCache = /* @__PURE__ */ new Map();
		const PLATFORMS = ["ios", "android"];
		const getAllManagementArtifact = (artifacts) => {
			const allArtifact = artifacts.scopes.find((scope) => scope.cacheKey === ALL_SCOPE_CACHE_KEY);
			if (!allArtifact) throw new Error("all-bundles management index artifact not found");
			return allArtifact;
		};
		const replaceManagementRootCache = (artifacts) => {
			managementRootCache.clear();
			for (const scope of artifacts.scopes) managementRootCache.set(scope.cacheKey, scope.root);
		};
		const createHydratedBundle = (bundle) => {
			const hydratedBundle = createBundleWithUpdateJsonKey(bundle);
			bundlesMap.set(hydratedBundle.id, hydratedBundle);
			return hydratedBundle;
		};
		const loadStoredManagementRoot = async (scope) => {
			const cacheKey = getManagementScopeCacheKey(scope);
			const storedRoot = await loadObject(getManagementRootKey(scope));
			if (storedRoot) {
				managementRootCache.set(cacheKey, storedRoot);
				return storedRoot;
			}
			managementRootCache.delete(cacheKey);
			return null;
		};
		const loadManagementPage = async (descriptor, pageCache) => {
			if (pageCache?.has(descriptor.key)) return pageCache.get(descriptor.key) ?? null;
			const page = await loadObject(descriptor.key);
			pageCache?.set(descriptor.key, page);
			return page;
		};
		const loadBundleFromManagementRoot = async (root, bundleId) => {
			const pageIndex = findPageIndexContainingId(root.pages, bundleId);
			if (pageIndex < 0) return null;
			const descriptor = root.pages[pageIndex];
			const page = await loadManagementPage(descriptor);
			if (!page) return null;
			return page.find((item) => item.id === bundleId) ?? null;
		};
		const loadAllBundlesFromRoot = async (root) => {
			const allBundles = [];
			const pageCache = /* @__PURE__ */ new Map();
			for (const descriptor of root.pages) {
				const page = await loadManagementPage(descriptor, pageCache);
				if (!page) return null;
				allBundles.push(...page);
			}
			return allBundles;
		};
		const persistManagementIndexArtifacts = async (nextArtifacts, previousArtifacts) => {
			for (const [key, page] of nextArtifacts.pages.entries()) await uploadObject(key, page);
			for (const scope of nextArtifacts.scopes) await uploadObject(scope.rootKey, scope.root);
			if (!previousArtifacts) return;
			const nextPageKeys = new Set(nextArtifacts.pages.keys());
			const nextRootKeys = new Set(nextArtifacts.scopes.map((scope) => scope.rootKey));
			for (const [key] of previousArtifacts.pages.entries()) if (!nextPageKeys.has(key)) await deleteObject(key).catch(() => {});
			for (const scope of previousArtifacts.scopes) if (!nextRootKeys.has(scope.rootKey)) await deleteObject(scope.rootKey).catch(() => {});
		};
		const ensureAllManagementRoot = async () => {
			const storedAllRoot = await loadStoredManagementRoot({});
			if (storedAllRoot && storedAllRoot.pageSize === managementIndexPageSize) return storedAllRoot;
			const rebuiltBundles = sortManagedBundles((await reloadBundles()).map((bundle) => removeBundleInternalKeys(bundle)));
			const nextArtifacts = buildManagementIndexArtifacts(rebuiltBundles, managementIndexPageSize);
			await persistManagementIndexArtifacts(nextArtifacts, storedAllRoot ? buildManagementIndexArtifacts(rebuiltBundles, storedAllRoot.pageSize) : void 0);
			replaceManagementRootCache(nextArtifacts);
			return getAllManagementArtifact(nextArtifacts).root;
		};
		const loadManagementScopeRoot = async (scope) => {
			const cacheKey = getManagementScopeCacheKey(scope);
			if (cacheKey === ALL_SCOPE_CACHE_KEY) return ensureAllManagementRoot();
			const storedRoot = await loadStoredManagementRoot(scope);
			if (storedRoot) return storedRoot;
			await ensureAllManagementRoot();
			const storedScopedRoot = await loadStoredManagementRoot(scope);
			if (storedScopedRoot) return storedScopedRoot;
			managementRootCache.set(cacheKey, null);
			return null;
		};
		const loadAllBundlesForManagementFallback = async () => {
			const allRoot = await loadManagementScopeRoot({});
			if (allRoot) {
				const pagedBundles = await loadAllBundlesFromRoot(allRoot);
				if (pagedBundles) return pagedBundles;
			}
			return sortManagedBundles((await reloadBundles()).map((bundle) => removeBundleInternalKeys(bundle)));
		};
		const loadCurrentBundlesForIndexRebuild = async () => {
			return loadAllBundlesForManagementFallback();
		};
		const findPageIndexContainingId = (pages, id) => {
			return pages.findIndex((page) => id.localeCompare(page.firstId) <= 0 && id.localeCompare(page.lastId) >= 0);
		};
		const readPagedBundles = async ({ root, limit, offset, cursor }) => {
			if (root.total === 0 || root.pages.length === 0) return createEmptyManagementResult(limit);
			const pageStartOffsets = getPageStartOffsets(root.pages);
			const pageCache = /* @__PURE__ */ new Map();
			if (offset !== void 0) {
				const normalizedOffset = Math.max(0, offset);
				if (normalizedOffset >= root.total) return {
					data: [],
					pagination: require_calculatePagination.calculatePagination(root.total, {
						limit,
						offset: normalizedOffset
					})
				};
				let pageIndex = 0;
				for (let index = pageStartOffsets.length - 1; index >= 0; index--) if ((pageStartOffsets[index] ?? 0) <= normalizedOffset) {
					pageIndex = index;
					break;
				}
				const startInPage = normalizedOffset - (pageStartOffsets[pageIndex] ?? 0);
				const data = [];
				for (let currentPageIndex = pageIndex; currentPageIndex < root.pages.length && (limit <= 0 || data.length < limit); currentPageIndex++) {
					const descriptor = root.pages[currentPageIndex];
					const page = await loadManagementPage(descriptor, pageCache);
					if (!page) return require_paginateBundles.paginateBundles({
						bundles: await loadAllBundlesForManagementFallback(),
						limit,
						offset: normalizedOffset
					});
					data.push(...currentPageIndex === pageIndex ? page.slice(startInPage) : page);
				}
				const paginatedData = limit > 0 ? data.slice(0, limit) : data;
				return {
					data: paginatedData,
					pagination: {
						...require_calculatePagination.calculatePagination(root.total, {
							limit,
							offset: normalizedOffset
						}),
						...paginatedData.length > 0 && normalizedOffset + paginatedData.length < root.total ? { nextCursor: paginatedData.at(-1)?.id } : {},
						...paginatedData.length > 0 && normalizedOffset > 0 ? { previousCursor: paginatedData[0]?.id } : {}
					}
				};
			}
			if (cursor?.after) {
				let pageIndex = root.pages.findIndex((page) => {
					const containsCursor = cursor.after.localeCompare(page.firstId) <= 0 && cursor.after.localeCompare(page.lastId) >= 0;
					const wholePageEligible = cursor.after.localeCompare(page.firstId) > 0;
					return containsCursor || wholePageEligible;
				});
				if (pageIndex < 0) return {
					data: [],
					pagination: {
						...require_calculatePagination.calculatePagination(root.total, {
							limit,
							offset: root.total
						}),
						previousCursor: cursor.after
					}
				};
				const data = [];
				let startIndex = null;
				while (pageIndex < root.pages.length && (limit <= 0 || data.length < limit)) {
					const descriptor = root.pages[pageIndex];
					const page = await loadManagementPage(descriptor, pageCache);
					if (!page) return require_paginateBundles.paginateBundles({
						bundles: await loadAllBundlesForManagementFallback(),
						limit,
						cursor
					});
					const containsCursor = cursor.after.localeCompare(descriptor.firstId) <= 0 && cursor.after.localeCompare(descriptor.lastId) >= 0;
					let eligiblePageBundles = page;
					if (containsCursor) {
						const startInPage = page.findIndex((bundle) => bundle.id.localeCompare(cursor.after) < 0);
						if (startInPage < 0) eligiblePageBundles = [];
						else {
							eligiblePageBundles = page.slice(startInPage);
							startIndex ??= (pageStartOffsets[pageIndex] ?? 0) + startInPage;
						}
					} else if (eligiblePageBundles.length > 0) startIndex ??= pageStartOffsets[pageIndex] ?? 0;
					data.push(...eligiblePageBundles);
					if (limit > 0 && data.length >= limit) break;
					pageIndex += 1;
				}
				const paginatedData = limit > 0 ? data.slice(0, limit) : data;
				const resolvedStartIndex = startIndex ?? root.total;
				return {
					data: paginatedData,
					pagination: {
						...require_calculatePagination.calculatePagination(root.total, {
							limit,
							offset: resolvedStartIndex
						}),
						...paginatedData.length > 0 && resolvedStartIndex + paginatedData.length < root.total ? { nextCursor: paginatedData.at(-1)?.id } : {},
						...paginatedData.length > 0 && resolvedStartIndex > 0 ? { previousCursor: paginatedData[0]?.id } : {}
					}
				};
			}
			if (cursor?.before) {
				let pageIndex = -1;
				for (let index = root.pages.length - 1; index >= 0; index--) {
					const page = root.pages[index];
					const containsCursor = cursor.before.localeCompare(page.firstId) <= 0 && cursor.before.localeCompare(page.lastId) >= 0;
					const wholePageEligible = cursor.before.localeCompare(page.lastId) < 0;
					if (containsCursor || wholePageEligible) {
						pageIndex = index;
						break;
					}
				}
				if (pageIndex < 0) return createEmptyManagementResult(limit);
				let startIndex = null;
				let collected = [];
				while (pageIndex >= 0 && (limit <= 0 || collected.length < limit)) {
					const descriptor = root.pages[pageIndex];
					const page = await loadManagementPage(descriptor, pageCache);
					if (!page) return require_paginateBundles.paginateBundles({
						bundles: await loadAllBundlesForManagementFallback(),
						limit,
						cursor
					});
					const eligiblePageBundles = cursor.before.localeCompare(descriptor.firstId) <= 0 && cursor.before.localeCompare(descriptor.lastId) >= 0 ? page.filter((bundle) => bundle.id.localeCompare(cursor.before) > 0) : page;
					collected = [...eligiblePageBundles, ...collected];
					if (eligiblePageBundles.length > 0) startIndex = pageStartOffsets[pageIndex] ?? 0;
					if (limit > 0 && collected.length >= limit) break;
					pageIndex -= 1;
				}
				if (startIndex === null || collected.length === 0) return createEmptyManagementResult(limit);
				let paginatedData = collected;
				if (limit > 0 && collected.length > limit) {
					const dropCount = collected.length - limit;
					paginatedData = collected.slice(dropCount);
					startIndex += dropCount;
				}
				const pagination = require_calculatePagination.calculatePagination(root.total, {
					limit,
					offset: startIndex
				});
				return {
					data: paginatedData,
					pagination: {
						...pagination,
						...paginatedData.length > 0 && startIndex + paginatedData.length < root.total ? { nextCursor: paginatedData.at(-1)?.id } : {},
						...paginatedData.length > 0 && startIndex > 0 ? { previousCursor: paginatedData[0]?.id } : {}
					}
				};
			}
			const pageIndex = 0;
			const startInPage = 0;
			const data = [];
			for (let currentPageIndex = pageIndex; currentPageIndex < root.pages.length && (limit <= 0 || data.length < limit); currentPageIndex++) {
				const descriptor = root.pages[currentPageIndex];
				const page = await loadManagementPage(descriptor, pageCache);
				if (!page) return require_paginateBundles.paginateBundles({
					bundles: await loadAllBundlesForManagementFallback(),
					limit,
					cursor
				});
				data.push(...currentPageIndex === pageIndex ? page.slice(startInPage) : page);
			}
			const paginatedData = limit > 0 ? data.slice(0, limit) : data;
			return {
				data: paginatedData,
				pagination: {
					...require_calculatePagination.calculatePagination(root.total, {
						limit,
						offset: 0
					}),
					...paginatedData.length > 0 && paginatedData.length < root.total ? { nextCursor: paginatedData.at(-1)?.id } : {}
				}
			};
		};
		async function reloadBundles() {
			bundlesMap.clear();
			const filePromises = (await listObjects("")).filter((key) => /^[^/]+\/(?:ios|android)\/[^/]+\/update\.json$/.test(key)).map(async (key) => {
				return (await loadObject(key) ?? []).map((bundle) => ({
					...bundle,
					_updateJsonKey: key
				}));
			});
			const allBundles = (await Promise.all(filePromises)).flat();
			for (const bundle of allBundles) bundlesMap.set(bundle.id, bundle);
			for (const [id, bundle] of pendingBundlesMap.entries()) bundlesMap.set(id, bundle);
			return (0, es_toolkit.orderBy)(allBundles, [(v) => v.id], ["desc"]);
		}
		/**
		* Updates target-app-versions.json for each channel on the given platform.
		* Returns true if the file was updated, false if no changes were made.
		*/
		async function updateTargetVersionsForPlatform(platform) {
			const updateJsonPattern = new RegExp(`^[^/]+/${platform}/[^/]+/update\\.json$`);
			const targetVersionsPattern = new RegExp(`^[^/]+/${platform}/target-app-versions\\.json$`);
			const allKeys = await listObjects("");
			const updateJsonKeys = allKeys.filter((key) => updateJsonPattern.test(key));
			const targetVersionsKeys = allKeys.filter((key) => targetVersionsPattern.test(key));
			const keysByChannel = updateJsonKeys.reduce((acc, key) => {
				const channel = key.split("/")[0];
				acc[channel] = acc[channel] || [];
				acc[channel].push(key);
				return acc;
			}, {});
			for (const key of targetVersionsKeys) {
				const channel = key.split("/")[0];
				if (!keysByChannel[channel]) keysByChannel[channel] = [];
			}
			for (const channel of Object.keys(keysByChannel)) {
				const updateKeys = keysByChannel[channel];
				const targetKey = `${channel}/${platform}/target-app-versions.json`;
				const currentVersions = updateKeys.map((key) => key.split("/")[2]);
				const oldTargetVersions = await loadObject(targetKey) ?? [];
				const newTargetVersions = oldTargetVersions.filter((v) => currentVersions.includes(v));
				for (const v of currentVersions) if (!newTargetVersions.includes(v)) newTargetVersions.push(v);
				if (JSON.stringify(oldTargetVersions) !== JSON.stringify(newTargetVersions)) await uploadObject(targetKey, newTargetVersions);
			}
		}
		const getAppVersionUpdateInfo = async ({ appVersion, bundleId, channel = "production", cohort, minBundleId, platform }) => {
			const matchingVersions = require_filterCompatibleAppVersions.filterCompatibleAppVersions(await loadObject(`${channel}/${platform}/target-app-versions.json`) ?? [], appVersion);
			return (0, _hot_updater_js.getUpdateInfo)((await Promise.allSettled(matchingVersions.map(async (targetAppVersion) => {
				return await loadObject(`${channel}/${platform}/${normalizeTargetAppVersion(targetAppVersion) ?? targetAppVersion}/update.json`) ?? [];
			}))).filter((entry) => entry.status === "fulfilled").flatMap((entry) => entry.value), {
				_updateStrategy: "appVersion",
				appVersion,
				bundleId,
				channel,
				cohort,
				minBundleId,
				platform
			});
		};
		const getFingerprintUpdateInfo = async ({ bundleId, channel = "production", cohort, fingerprintHash, minBundleId, platform }) => {
			return (0, _hot_updater_js.getUpdateInfo)(await loadObject(`${channel}/${platform}/${fingerprintHash}/update.json`) ?? [], {
				_updateStrategy: "fingerprint",
				bundleId,
				channel,
				cohort,
				fingerprintHash,
				minBundleId,
				platform
			});
		};
		const addAppVersionInvalidationPaths = (pathsToInvalidate, { platform, channel, targetAppVersion }) => {
			if (!isExactVersion(targetAppVersion)) {
				pathsToInvalidate.add(`${apiBasePath}/app-version/${platform}/*`);
				return;
			}
			const normalizedVersions = getSemverNormalizedVersions(targetAppVersion);
			for (const version of normalizedVersions) pathsToInvalidate.add(`${apiBasePath}/app-version/${platform}/${version}/${channel}/*`);
		};
		const addLookupInvalidationPaths = (pathsToInvalidate, { platform, channel, targetAppVersion, fingerprintHash }) => {
			if (fingerprintHash) {
				pathsToInvalidate.add(`${apiBasePath}/fingerprint/${platform}/${fingerprintHash}/${channel}/*`);
				return;
			}
			if (targetAppVersion) addAppVersionInvalidationPaths(pathsToInvalidate, {
				platform,
				channel,
				targetAppVersion
			});
		};
		return require_createDatabasePlugin.createDatabasePlugin({
			name,
			factory: () => ({
				supportsCursorPagination: true,
				async getBundleById(bundleId) {
					const pendingBundle = pendingBundlesMap.get(bundleId);
					if (pendingBundle) return removeBundleInternalKeys(pendingBundle);
					const bundle = bundlesMap.get(bundleId);
					if (bundle) return removeBundleInternalKeys(bundle);
					const allRoot = await loadManagementScopeRoot({});
					if (allRoot) {
						const matchedBundle = await loadBundleFromManagementRoot(allRoot, bundleId);
						if (matchedBundle) return removeBundleInternalKeys(createHydratedBundle(matchedBundle));
						managementRootCache.delete(ALL_SCOPE_CACHE_KEY);
						const refreshedAllRoot = await loadStoredManagementRoot({});
						if (refreshedAllRoot) {
							const refreshedBundle = await loadBundleFromManagementRoot(refreshedAllRoot, bundleId);
							if (refreshedBundle) return removeBundleInternalKeys(createHydratedBundle(refreshedBundle));
						}
					}
					const matchedBundle = (await reloadBundles()).find((item) => item.id === bundleId);
					if (!matchedBundle) return null;
					return removeBundleInternalKeys(matchedBundle);
				},
				async getUpdateInfo(args) {
					if (args._updateStrategy === "appVersion") return getAppVersionUpdateInfo(args);
					return getFingerprintUpdateInfo(args);
				},
				async getBundles(options) {
					const { where, limit, offset, orderBy, cursor } = options;
					const scope = getSupportedManagementScope(where, orderBy);
					if (scope) {
						const root = await loadManagementScopeRoot(scope);
						if (!root) return createEmptyManagementResult(limit);
						return readPagedBundles({
							root,
							limit,
							offset,
							cursor
						});
					}
					let allBundles = await loadAllBundlesForManagementFallback();
					if (where) allBundles = allBundles.filter((bundle) => require_queryBundles.bundleMatchesQueryWhere(bundle, where));
					return require_paginateBundles.paginateBundles({
						bundles: allBundles,
						limit,
						offset,
						cursor,
						orderBy
					});
				},
				async getChannels() {
					return (await loadManagementScopeRoot({}))?.channels ?? [];
				},
				async commitBundle({ changedSets }) {
					if (changedSets.length === 0) return;
					const changedBundlesByKey = {};
					const removalsByKey = {};
					const pathsToInvalidate = /* @__PURE__ */ new Set();
					let isTargetAppVersionChanged = false;
					let isChannelChanged = false;
					for (const { operation, data } of changedSets) {
						if (data.targetAppVersion !== void 0) isTargetAppVersionChanged = true;
						if (operation === "update" && data.channel !== void 0) isChannelChanged = true;
						if (operation === "insert") {
							const target = resolveStorageTarget(data);
							const key = `${data.channel}/${data.platform}/${target}/update.json`;
							const bundleWithKey = {
								...data,
								_updateJsonKey: key
							};
							bundlesMap.set(data.id, bundleWithKey);
							pendingBundlesMap.set(data.id, bundleWithKey);
							changedBundlesByKey[key] = changedBundlesByKey[key] || [];
							changedBundlesByKey[key].push(removeBundleInternalKeys(bundleWithKey));
							addLookupInvalidationPaths(pathsToInvalidate, data);
							continue;
						}
						if (operation === "delete") {
							let bundle = pendingBundlesMap.get(data.id);
							if (!bundle) bundle = bundlesMap.get(data.id);
							if (!bundle) throw new Error("Bundle to delete not found");
							bundlesMap.delete(data.id);
							pendingBundlesMap.delete(data.id);
							const key = bundle._updateJsonKey;
							removalsByKey[key] = removalsByKey[key] || [];
							removalsByKey[key].push(bundle.id);
							addLookupInvalidationPaths(pathsToInvalidate, bundle);
							continue;
						}
						let bundle = pendingBundlesMap.get(data.id);
						if (!bundle) bundle = bundlesMap.get(data.id);
						if (!bundle) throw new Error("targetBundleId not found");
						if (operation === "update") {
							const updatedBundle = {
								...bundle,
								...data
							};
							const newKey = `${updatedBundle.channel}/${updatedBundle.platform}/${resolveStorageTarget(updatedBundle)}/update.json`;
							if (newKey !== bundle._updateJsonKey) {
								const oldKey = bundle._updateJsonKey;
								removalsByKey[oldKey] = removalsByKey[oldKey] || [];
								removalsByKey[oldKey].push(bundle.id);
								changedBundlesByKey[newKey] = changedBundlesByKey[newKey] || [];
								updatedBundle._oldUpdateJsonKey = oldKey;
								updatedBundle._updateJsonKey = newKey;
								bundlesMap.set(data.id, updatedBundle);
								pendingBundlesMap.set(data.id, updatedBundle);
								changedBundlesByKey[newKey].push(removeBundleInternalKeys(updatedBundle));
								const oldChannel = bundle.channel;
								const nextChannel = updatedBundle.channel;
								if (oldChannel !== nextChannel) {
									addLookupInvalidationPaths(pathsToInvalidate, bundle);
									if (bundle.targetAppVersion && !bundle.fingerprintHash) addLookupInvalidationPaths(pathsToInvalidate, {
										...bundle,
										channel: nextChannel
									});
								}
								addLookupInvalidationPaths(pathsToInvalidate, updatedBundle);
								if (bundle.targetAppVersion && bundle.targetAppVersion !== updatedBundle.targetAppVersion) addLookupInvalidationPaths(pathsToInvalidate, bundle);
								continue;
							}
							const currentKey = bundle._updateJsonKey;
							bundlesMap.set(data.id, updatedBundle);
							pendingBundlesMap.set(data.id, updatedBundle);
							changedBundlesByKey[currentKey] = changedBundlesByKey[currentKey] || [];
							changedBundlesByKey[currentKey].push(removeBundleInternalKeys(updatedBundle));
							addLookupInvalidationPaths(pathsToInvalidate, updatedBundle);
							if (bundle.targetAppVersion && bundle.targetAppVersion !== updatedBundle.targetAppVersion) addLookupInvalidationPaths(pathsToInvalidate, bundle);
						}
					}
					for (const oldKey of Object.keys(removalsByKey)) await (async () => {
						const updatedBundles = (await loadObject(oldKey) ?? []).filter((b) => !removalsByKey[oldKey].includes(b.id));
						updatedBundles.sort((a, b) => b.id.localeCompare(a.id));
						if (updatedBundles.length === 0) await deleteObject(oldKey);
						else await uploadObject(oldKey, updatedBundles);
					})();
					for (const key of Object.keys(changedBundlesByKey)) await (async () => {
						const currentBundles = await loadObject(key) ?? [];
						const pureBundles = changedBundlesByKey[key].map((bundle) => bundle);
						for (const changedBundle of pureBundles) {
							const index = currentBundles.findIndex((b) => b.id === changedBundle.id);
							if (index >= 0) currentBundles[index] = changedBundle;
							else currentBundles.push(changedBundle);
						}
						currentBundles.sort((a, b) => b.id.localeCompare(a.id));
						await uploadObject(key, currentBundles);
					})();
					if (isTargetAppVersionChanged || isChannelChanged) for (const platform of PLATFORMS) await updateTargetVersionsForPlatform(platform);
					const currentIndexBundles = await loadCurrentBundlesForIndexRebuild();
					const nextIndexMap = new Map(currentIndexBundles.map((bundle) => [bundle.id, bundle]));
					for (const { operation, data } of changedSets) {
						if (operation === "delete") {
							nextIndexMap.delete(data.id);
							continue;
						}
						nextIndexMap.set(data.id, data);
					}
					const nextIndexBundles = sortManagedBundles(Array.from(nextIndexMap.values()));
					const previousArtifacts = buildManagementIndexArtifacts(currentIndexBundles, managementIndexPageSize);
					const nextArtifacts = buildManagementIndexArtifacts(nextIndexBundles, managementIndexPageSize);
					await persistManagementIndexArtifacts(nextArtifacts, previousArtifacts);
					replaceManagementRootCache(nextArtifacts);
					const encondedPaths = /* @__PURE__ */ new Set();
					for (const path of pathsToInvalidate) encondedPaths.add(encodeURI(path));
					await invalidatePaths(Array.from(encondedPaths));
					pendingBundlesMap.clear();
				}
			})
		})({}, hooks);
	};
};
//#endregion
exports.createBlobDatabasePlugin = createBlobDatabasePlugin;
