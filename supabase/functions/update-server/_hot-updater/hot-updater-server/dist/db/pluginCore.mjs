import { assertBundlePersistenceConstraints } from "./schemaEnhancements.mjs";
import { resolveManifestArtifacts } from "./updateArtifacts.mjs";
import { semverSatisfies } from "@hot-updater/plugin-core";
import { NIL_UUID, isCohortEligibleForUpdate } from "@hot-updater/core";
//#region src/db/pluginCore.ts
const PAGE_SIZE = 100;
const DESC_ORDER = {
	field: "id",
	direction: "desc"
};
const bundleMatchesQueryWhere = (bundle, where) => {
	if (!where) return true;
	if (where.channel !== void 0 && bundle.channel !== where.channel) return false;
	if (where.platform !== void 0 && bundle.platform !== where.platform) return false;
	if (where.enabled !== void 0 && bundle.enabled !== where.enabled) return false;
	if (where.id?.eq !== void 0 && bundle.id !== where.id.eq) return false;
	if (where.id?.gt !== void 0 && bundle.id.localeCompare(where.id.gt) <= 0) return false;
	if (where.id?.gte !== void 0 && bundle.id.localeCompare(where.id.gte) < 0) return false;
	if (where.id?.lt !== void 0 && bundle.id.localeCompare(where.id.lt) >= 0) return false;
	if (where.id?.lte !== void 0 && bundle.id.localeCompare(where.id.lte) > 0) return false;
	if (where.id?.in && !where.id.in.includes(bundle.id)) return false;
	if (where.targetAppVersionNotNull && bundle.targetAppVersion === null) return false;
	if (where.targetAppVersion !== void 0 && bundle.targetAppVersion !== where.targetAppVersion) return false;
	if (where.targetAppVersionIn && !where.targetAppVersionIn.includes(bundle.targetAppVersion ?? "")) return false;
	if (where.fingerprintHash !== void 0 && bundle.fingerprintHash !== where.fingerprintHash) return false;
	return true;
};
const sortBundles = (bundles, orderBy) => {
	const direction = orderBy?.direction ?? "desc";
	return bundles.slice().sort((a, b) => {
		const result = a.id.localeCompare(b.id);
		return direction === "asc" ? result : -result;
	});
};
const makeResponse = (bundle, status) => ({
	id: bundle.id,
	message: bundle.message,
	shouldForceUpdate: status === "ROLLBACK" ? true : bundle.shouldForceUpdate,
	status,
	storageUri: bundle.storageUri,
	fileHash: bundle.fileHash
});
const INIT_BUNDLE_ROLLBACK_UPDATE_INFO = {
	message: null,
	id: NIL_UUID,
	shouldForceUpdate: true,
	status: "ROLLBACK",
	storageUri: null,
	fileHash: null
};
function createPluginDatabaseCore(getPlugin, resolveFileUrl, options) {
	const runWithMutationPlugin = async (operation) => {
		const plugin = options?.createMutationPlugin?.() ?? getPlugin();
		try {
			return await operation(plugin);
		} finally {
			if (options?.createMutationPlugin) await options.cleanupMutationPlugin?.(plugin);
		}
	};
	const getSortedBundlePage = async (options, context) => {
		const result = await getPlugin().getBundles({
			...options,
			orderBy: options.orderBy ?? DESC_ORDER
		}, context);
		return {
			...result,
			data: sortBundles(result.data, options.orderBy ?? DESC_ORDER)
		};
	};
	const isEligibleForUpdate = (bundle, cohort) => {
		return isCohortEligibleForUpdate(bundle.id, cohort, bundle.rolloutCohortCount, bundle.targetCohorts);
	};
	const findUpdateInfoByScanning = async ({ args, queryWhere, isCandidate, context }) => {
		let after;
		while (true) {
			const { data, pagination } = await getSortedBundlePage({
				where: queryWhere,
				limit: PAGE_SIZE,
				orderBy: DESC_ORDER,
				...after ? { cursor: { after } } : {}
			}, context);
			for (const bundle of data) {
				if (!bundleMatchesQueryWhere(bundle, queryWhere) || !isCandidate(bundle)) continue;
				if (args.bundleId === NIL_UUID) {
					if (isEligibleForUpdate(bundle, args.cohort)) return makeResponse(bundle, "UPDATE");
					continue;
				}
				const compareResult = bundle.id.localeCompare(args.bundleId);
				if (compareResult > 0) {
					if (isEligibleForUpdate(bundle, args.cohort)) return makeResponse(bundle, "UPDATE");
					continue;
				}
				if (compareResult === 0) {
					if (isEligibleForUpdate(bundle, args.cohort)) return null;
					continue;
				}
				return makeResponse(bundle, "ROLLBACK");
			}
			if (!pagination.hasNextPage) break;
			after = data.at(-1)?.id;
			if (!after) break;
		}
		if (args.bundleId === NIL_UUID) return null;
		if (args.minBundleId && args.bundleId.localeCompare(args.minBundleId) <= 0) return null;
		return INIT_BUNDLE_ROLLBACK_UPDATE_INFO;
	};
	const getBaseWhere = ({ platform, channel, minBundleId }) => ({
		platform,
		channel,
		enabled: true,
		id: { gte: minBundleId }
	});
	return {
		api: {
			async getBundleById(id, context) {
				return getPlugin().getBundleById(id, context);
			},
			async getUpdateInfo(args, context) {
				const directGetUpdateInfo = getPlugin().getUpdateInfo;
				if (directGetUpdateInfo) return context === void 0 ? await directGetUpdateInfo(args) : await directGetUpdateInfo(args, context);
				const channel = args.channel ?? "production";
				const minBundleId = args.minBundleId ?? NIL_UUID;
				const baseWhere = getBaseWhere({
					platform: args.platform,
					channel,
					minBundleId
				});
				if (args._updateStrategy === "fingerprint") return findUpdateInfoByScanning({
					args,
					queryWhere: {
						...baseWhere,
						fingerprintHash: args.fingerprintHash
					},
					context,
					isCandidate: (bundle) => {
						return bundle.enabled && bundle.platform === args.platform && bundle.channel === channel && bundle.id.localeCompare(minBundleId) >= 0 && bundle.fingerprintHash === args.fingerprintHash;
					}
				});
				return findUpdateInfoByScanning({
					args,
					queryWhere: { ...baseWhere },
					context,
					isCandidate: (bundle) => {
						return bundle.enabled && bundle.platform === args.platform && bundle.channel === channel && bundle.id.localeCompare(minBundleId) >= 0 && !!bundle.targetAppVersion && semverSatisfies(bundle.targetAppVersion, args.appVersion);
					}
				});
			},
			async getAppUpdateInfo(args, context) {
				const info = await this.getUpdateInfo(args, context);
				if (!info) return null;
				const { storageUri, ...rest } = info;
				const readStorageText = options?.readStorageText;
				if (info.id === NIL_UUID || !readStorageText) {
					const fileUrl = await resolveFileUrl(storageUri ?? null, context);
					return {
						...rest,
						fileUrl
					};
				}
				const [fileUrl, targetBundle, currentBundle] = await Promise.all([
					resolveFileUrl(storageUri ?? null, context),
					getPlugin().getBundleById(info.id, context),
					args.bundleId !== NIL_UUID ? getPlugin().getBundleById(args.bundleId, context) : null
				]);
				const baseResponse = {
					...rest,
					fileUrl
				};
				const manifestArtifacts = await resolveManifestArtifacts({
					currentBundle,
					resolveFileUrl,
					readStorageText,
					targetBundle,
					context
				});
				if (!manifestArtifacts) return baseResponse;
				return {
					...baseResponse,
					...manifestArtifacts
				};
			},
			async getChannels(context) {
				return getPlugin().getChannels(context);
			},
			async getBundles(options, context) {
				return getPlugin().getBundles(options, context);
			},
			async insertBundle(bundle, context) {
				assertBundlePersistenceConstraints(bundle);
				await runWithMutationPlugin(async (plugin) => {
					await plugin.appendBundle(bundle, context);
					await plugin.commitBundle(context);
				});
			},
			async updateBundleById(bundleId, newBundle, context) {
				await runWithMutationPlugin(async (plugin) => {
					const current = await plugin.getBundleById(bundleId, context);
					if (!current) throw new Error("targetBundleId not found");
					assertBundlePersistenceConstraints({
						...current,
						...newBundle
					});
					await plugin.updateBundle(bundleId, newBundle, context);
					await plugin.commitBundle(context);
				});
			},
			async deleteBundleById(bundleId, context) {
				await runWithMutationPlugin(async (plugin) => {
					const bundle = await plugin.getBundleById(bundleId, context);
					if (!bundle) return;
					await plugin.deleteBundle(bundle, context);
					await plugin.commitBundle(context);
				});
			}
		},
		adapterName: getPlugin().name,
		createMigrator: () => {
			throw new Error("createMigrator is only available for Kysely/Prisma/Drizzle database adapters.");
		},
		generateSchema: () => {
			throw new Error("generateSchema is only available for Kysely/Prisma/Drizzle database adapters.");
		}
	};
}
//#endregion
export { createPluginDatabaseCore };
