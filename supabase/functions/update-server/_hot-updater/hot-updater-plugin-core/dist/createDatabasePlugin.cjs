require("./_virtual/_rolldown/runtime.cjs");
const require_calculatePagination = require("./calculatePagination.cjs");
let es_toolkit = require("es-toolkit");
//#region src/createDatabasePlugin.ts
const REPLACE_ON_UPDATE_KEYS = ["patches", "targetCohorts"];
const DEFAULT_DESC_ORDER = {
	field: "id",
	direction: "desc"
};
function normalizePage(value) {
	if (!Number.isInteger(value) || value === void 0 || value < 1) return;
	return value;
}
function mergeBundleUpdate(baseBundle, patch) {
	return (0, es_toolkit.mergeWith)(baseBundle, patch, (_targetValue, sourceValue, key) => {
		if (REPLACE_ON_UPDATE_KEYS.includes(key)) return sourceValue;
	});
}
function mergeIdFilter(base, patch) {
	return {
		...base,
		...patch
	};
}
function mergeWhereWithIdFilter(where, idFilter) {
	return {
		...where,
		id: mergeIdFilter(where?.id, idFilter)
	};
}
function buildCursorPageQuery(where, cursor, orderBy) {
	const direction = orderBy.direction;
	if (cursor.after) return {
		reverseData: false,
		where: mergeWhereWithIdFilter(where, { [direction === "desc" ? "lt" : "gt"]: cursor.after }),
		orderBy
	};
	if (cursor.before) return {
		reverseData: true,
		where: mergeWhereWithIdFilter(where, { [direction === "desc" ? "gt" : "lt"]: cursor.before }),
		orderBy: {
			field: orderBy.field,
			direction: direction === "desc" ? "asc" : "desc"
		}
	};
	return {
		reverseData: false,
		where: where ?? {},
		orderBy
	};
}
function buildCountBeforeWhere(where, firstBundleId, orderBy) {
	return mergeWhereWithIdFilter(where, { [orderBy.direction === "desc" ? "gt" : "lt"]: firstBundleId });
}
function createPaginatedResult(total, limit, startIndex, data) {
	const pagination = require_calculatePagination.calculatePagination(total, {
		limit,
		offset: startIndex
	});
	const nextCursor = data.length > 0 && startIndex + data.length < total ? data.at(-1)?.id : void 0;
	const previousCursor = data.length > 0 && startIndex > 0 ? data[0]?.id : void 0;
	return {
		data,
		pagination: {
			...pagination,
			...nextCursor ? { nextCursor } : {},
			...previousCursor ? { previousCursor } : {}
		}
	};
}
/**
* Creates a database plugin with lazy initialization and automatic hook execution.
*
* This factory function abstracts the double currying pattern used by all database plugins,
* ensuring consistent lazy initialization behavior across different database providers.
* Hooks are automatically executed at appropriate times without requiring manual invocation.
*
* @param options - Configuration options for the database plugin
* @returns A double-curried function that lazily initializes the database plugin
*
* @example
* ```typescript
* export const postgres = createDatabasePlugin<PostgresConfig>({
*   name: "postgres",
*   factory: (config) => {
*     const db = new Kysely(config);
*     return {
*       async getBundleById(bundleId) { ... },
*       async getBundles(options) { ... },
*       async getChannels() { ... },
*       async commitBundle({ changedSets }) { ... }
*     };
*   }
* });
* ```
*/
function createDatabasePlugin(options) {
	return (config, hooks) => {
		let cachedMethods = null;
		const getMethods = () => {
			if (!cachedMethods) cachedMethods = options.factory(config);
			return cachedMethods;
		};
		return () => {
			const changedMap = /* @__PURE__ */ new Map();
			const markChanged = (operation, data) => {
				changedMap.set(data.id, {
					operation,
					data
				});
			};
			const runGetBundles = async (options, context) => {
				if (context === void 0) return getMethods().getBundles(options);
				return getMethods().getBundles(options, context);
			};
			const getBundlesWithLegacyCursorFallback = async (options, context) => {
				const orderBy = options.orderBy ?? DEFAULT_DESC_ORDER;
				const baseWhere = options.where;
				const total = (await runGetBundles({
					where: baseWhere,
					limit: 1,
					offset: 0,
					orderBy
				}, context)).pagination.total;
				if (!options.cursor?.after && !options.cursor?.before) {
					const firstPage = await runGetBundles({
						where: baseWhere,
						limit: options.limit,
						offset: 0,
						orderBy
					}, context);
					return createPaginatedResult(total, options.limit, 0, firstPage.data);
				}
				const { where, orderBy: queryOrderBy, reverseData } = buildCursorPageQuery(baseWhere, options.cursor, orderBy);
				const cursorPage = await runGetBundles({
					where,
					limit: options.limit,
					offset: 0,
					orderBy: queryOrderBy
				}, context);
				const data = reverseData ? cursorPage.data.slice().reverse() : cursorPage.data;
				if (data.length === 0) {
					const emptyStartIndex = options.cursor.after ? total : 0;
					return {
						data,
						pagination: {
							...require_calculatePagination.calculatePagination(total, {
								limit: options.limit,
								offset: emptyStartIndex
							}),
							...options.cursor.after ? { previousCursor: options.cursor.after } : {},
							...options.cursor.before ? { nextCursor: options.cursor.before } : {}
						}
					};
				}
				const firstBundleId = data[0].id;
				const countBeforeResult = await runGetBundles({
					where: buildCountBeforeWhere(baseWhere, firstBundleId, orderBy),
					limit: 1,
					offset: 0,
					orderBy
				}, context);
				return createPaginatedResult(total, options.limit, countBeforeResult.pagination.total, data);
			};
			const plugin = {
				name: options.name,
				async getBundleById(bundleId, context) {
					if (context === void 0) return getMethods().getBundleById(bundleId);
					return getMethods().getBundleById(bundleId, context);
				},
				async getBundles(options, context) {
					if (typeof options === "object" && options !== null && "offset" in options && options.offset !== void 0) throw new Error("Bundle offset pagination has been removed. Use cursor.after or cursor.before instead.");
					const methods = getMethods();
					const normalizedOptions = {
						...options,
						page: normalizePage(options.page),
						orderBy: options.orderBy ?? DEFAULT_DESC_ORDER
					};
					if (normalizedOptions.page !== void 0) {
						const { page, ...pageOptions } = normalizedOptions;
						const requestedOffset = (page - 1) * normalizedOptions.limit;
						let pageResult = await runGetBundles({
							...pageOptions,
							offset: requestedOffset
						}, context);
						const total = pageResult.pagination.total;
						const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedOptions.limit);
						const maxOffset = totalPages === 0 ? 0 : (Math.max(1, totalPages) - 1) * normalizedOptions.limit;
						const resolvedOffset = Math.min(requestedOffset, maxOffset);
						if (resolvedOffset !== requestedOffset) pageResult = await runGetBundles({
							...pageOptions,
							offset: resolvedOffset
						}, context);
						return createPaginatedResult(total, normalizedOptions.limit, resolvedOffset, pageResult.data);
					}
					if (methods.supportsCursorPagination) {
						if (context === void 0) return methods.getBundles(normalizedOptions);
						return methods.getBundles(normalizedOptions, context);
					}
					return getBundlesWithLegacyCursorFallback(normalizedOptions, context);
				},
				async getChannels(context) {
					if (context === void 0) return getMethods().getChannels();
					return getMethods().getChannels(context);
				},
				async onUnmount() {
					const methods = getMethods();
					if (methods.onUnmount) return methods.onUnmount();
				},
				async commitBundle(context) {
					const methods = getMethods();
					const params = { changedSets: Array.from(changedMap.values()) };
					if (context === void 0) await methods.commitBundle(params);
					else await methods.commitBundle(params, context);
					changedMap.clear();
					await hooks?.onDatabaseUpdated?.();
				},
				async updateBundle(targetBundleId, newBundle, context) {
					const pendingChange = changedMap.get(targetBundleId);
					if (pendingChange) {
						const updatedData = mergeBundleUpdate(pendingChange.data, newBundle);
						changedMap.set(targetBundleId, {
							operation: pendingChange.operation,
							data: updatedData
						});
						return;
					}
					const currentBundle = context === void 0 ? await getMethods().getBundleById(targetBundleId) : await getMethods().getBundleById(targetBundleId, context);
					if (!currentBundle) throw new Error("targetBundleId not found");
					markChanged("update", mergeBundleUpdate(currentBundle, newBundle));
				},
				async appendBundle(inputBundle) {
					markChanged("insert", inputBundle);
				},
				async deleteBundle(deleteBundle) {
					markChanged("delete", deleteBundle);
				}
			};
			Object.defineProperty(plugin, "getUpdateInfo", {
				configurable: true,
				enumerable: true,
				get() {
					const directGetUpdateInfo = getMethods().getUpdateInfo;
					if (!directGetUpdateInfo) {
						Object.defineProperty(plugin, "getUpdateInfo", {
							configurable: true,
							enumerable: true,
							value: void 0
						});
						return;
					}
					const wrappedGetUpdateInfo = async (args, context) => {
						if (context === void 0) return directGetUpdateInfo(args);
						return directGetUpdateInfo(args, context);
					};
					Object.defineProperty(plugin, "getUpdateInfo", {
						configurable: true,
						enumerable: true,
						value: wrappedGetUpdateInfo
					});
					return wrappedGetUpdateInfo;
				}
			});
			return plugin;
		};
	};
}
//#endregion
exports.createDatabasePlugin = createDatabasePlugin;
