import { fumadb } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/index.mjs";
import { calculatePagination } from "../calculatePagination.mjs";
import { v0_21_0 } from "../schema/v0_21_0.mjs";
import { v0_29_0 } from "../schema/v0_29_0.mjs";
import { v0_31_0 } from "../schema/v0_31_0.mjs";
import { assertBundlePersistenceConstraints, enhanceGeneratedSchema, wrapKyselyMigrator } from "./schemaEnhancements.mjs";
import { getSQLProvider } from "./types.mjs";
import { parseBundleMetadata, resolveManifestArtifacts } from "./updateArtifacts.mjs";
import { semverSatisfies } from "@hot-updater/plugin-core";
import { DEFAULT_ROLLOUT_COHORT_COUNT, NIL_UUID, getAssetBaseStorageUri, getBundlePatches, getManifestFileHash, getManifestStorageUri, isCohortEligibleForUpdate, stripBundleArtifactMetadata } from "@hot-updater/core";
//#region src/db/ormCore.ts
const parseTargetCohorts = (value) => {
	if (!value) return null;
	if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
	if (typeof value === "string") try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
	} catch {
		return null;
	}
	return null;
};
const schemas = [
	v0_21_0,
	v0_29_0,
	v0_31_0
];
const getLastItem = (items) => items.at(-1);
const DEFAULT_BUNDLE_ORDER = {
	field: "id",
	direction: "desc"
};
const buildBundlePatchId = (bundleId, baseBundleId) => `${bundleId}:${baseBundleId}`;
const toBundlePatchRecords = (bundle) => getBundlePatches(bundle).map((patch, index) => ({
	id: buildBundlePatchId(bundle.id, patch.baseBundleId),
	bundle_id: bundle.id,
	base_bundle_id: patch.baseBundleId,
	base_file_hash: patch.baseFileHash,
	patch_file_hash: patch.patchFileHash,
	patch_storage_uri: patch.patchStorageUri,
	order_index: index
}));
const mapPatchRecordToPatch = (record) => ({
	baseBundleId: record.base_bundle_id,
	baseFileHash: record.base_file_hash,
	patchFileHash: record.patch_file_hash,
	patchStorageUri: record.patch_storage_uri
});
const mergeIdFilter = (base, patch) => ({
	...base,
	...patch
});
const mergeWhereWithIdFilter = (where, idFilter) => ({
	...where,
	id: mergeIdFilter(where?.id, idFilter)
});
const buildCursorPageWhere = (where, cursor, orderBy) => {
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
};
const buildCountBeforeWhere = (where, firstBundleId, orderBy) => mergeWhereWithIdFilter(where, { [orderBy.direction === "desc" ? "gt" : "lt"]: firstBundleId });
const HotUpdaterDB = fumadb({
	namespace: "hot_updater",
	schemas
});
function createOrmDatabaseCore({ database, resolveFileUrl, readStorageText }) {
	const client = HotUpdaterDB.client(database);
	const UPDATE_CHECK_PAGE_SIZE = 100;
	const isMongoAdapter = client.adapter.name.toLowerCase().includes("mongodb");
	const lastSchemaVersion = getLastItem(schemas).version;
	const ensureORM = async () => {
		try {
			const currentVersion = await client.createMigrator().getVersion();
			if (currentVersion === void 0) throw new Error("Database is not initialized. Please run 'npx hot-updater migrate' to set up the database schema.");
			if (currentVersion !== lastSchemaVersion) throw new Error(`Database schema version mismatch. Expected version ${lastSchemaVersion}, but database is on version ${currentVersion}. Please run 'npx hot-updater migrate' to update your database schema.`);
			return client.orm(lastSchemaVersion);
		} catch (error) {
			if (error instanceof Error && error.message.includes("doesn't support migration")) return client.orm(lastSchemaVersion);
			throw error;
		}
	};
	const buildBundleWhere = (where) => (b) => {
		if (where?.id?.in && where.id.in.length === 0) return false;
		if (where?.targetAppVersionIn && where.targetAppVersionIn.length === 0) return false;
		const conditions = [];
		if (where?.channel !== void 0) conditions.push(b("channel", "=", where.channel));
		if (where?.platform !== void 0) conditions.push(b("platform", "=", where.platform));
		if (where?.enabled !== void 0) conditions.push(b("enabled", "=", where.enabled));
		if (where?.id?.eq !== void 0) conditions.push(b("id", "=", where.id.eq));
		if (where?.id?.gt !== void 0) conditions.push(b("id", ">", where.id.gt));
		if (where?.id?.gte !== void 0) conditions.push(b("id", ">=", where.id.gte));
		if (where?.id?.lt !== void 0) conditions.push(b("id", "<", where.id.lt));
		if (where?.id?.lte !== void 0) conditions.push(b("id", "<=", where.id.lte));
		if (where?.id?.in) conditions.push(b("id", "in", where.id.in));
		if (where?.targetAppVersionNotNull) conditions.push(b.isNotNull("target_app_version"));
		if (where?.targetAppVersion !== void 0) conditions.push(where.targetAppVersion === null ? b.isNull("target_app_version") : b("target_app_version", "=", where.targetAppVersion));
		if (where?.targetAppVersionIn) conditions.push(b("target_app_version", "in", where.targetAppVersionIn));
		if (where?.fingerprintHash !== void 0) conditions.push(where.fingerprintHash === null ? b.isNull("fingerprint_hash") : b("fingerprint_hash", "=", where.fingerprintHash));
		return conditions.length > 0 ? b.and(...conditions) : true;
	};
	const mapBundleRecordToBundle = (record, patchRecords = []) => {
		const patches = patchRecords.slice().sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0) || left.base_bundle_id.localeCompare(right.base_bundle_id)).map(mapPatchRecordToPatch);
		const primaryPatch = patches[0] ?? null;
		return {
			id: record.id,
			platform: record.platform,
			shouldForceUpdate: Boolean(record.should_force_update),
			enabled: Boolean(record.enabled),
			fileHash: record.file_hash,
			gitCommitHash: record.git_commit_hash ?? null,
			message: record.message ?? null,
			channel: record.channel,
			storageUri: record.storage_uri,
			targetAppVersion: record.target_app_version ?? null,
			fingerprintHash: record.fingerprint_hash ?? null,
			metadata: parseBundleMetadata(record.metadata),
			manifestStorageUri: record.manifest_storage_uri ?? null,
			manifestFileHash: record.manifest_file_hash ?? null,
			assetBaseStorageUri: record.asset_base_storage_uri ?? null,
			patches,
			patchBaseBundleId: primaryPatch?.baseBundleId ?? null,
			patchBaseFileHash: primaryPatch?.baseFileHash ?? null,
			patchFileHash: primaryPatch?.patchFileHash ?? null,
			patchStorageUri: primaryPatch?.patchStorageUri ?? null,
			rolloutCohortCount: record.rollout_cohort_count ?? DEFAULT_ROLLOUT_COHORT_COUNT,
			targetCohorts: parseTargetCohorts(record.target_cohorts)
		};
	};
	const fetchBundlePatchMap = async (orm, bundleIds) => {
		const patchMap = /* @__PURE__ */ new Map();
		if (bundleIds.length === 0) return patchMap;
		const patchRows = await orm.findMany("bundle_patches", {
			select: [
				"id",
				"bundle_id",
				"base_bundle_id",
				"base_file_hash",
				"patch_file_hash",
				"patch_storage_uri",
				"order_index"
			],
			where: (b) => b("bundle_id", "in", bundleIds)
		});
		for (const row of patchRows) {
			const current = patchMap.get(row.bundle_id) ?? [];
			current.push(row);
			patchMap.set(row.bundle_id, current);
		}
		return patchMap;
	};
	const fetchBundleById = async (id) => {
		const orm = await ensureORM();
		const result = await orm.findFirst("bundles", {
			select: [
				"id",
				"platform",
				"should_force_update",
				"enabled",
				"file_hash",
				"git_commit_hash",
				"message",
				"channel",
				"storage_uri",
				"target_app_version",
				"fingerprint_hash",
				"metadata",
				"manifest_storage_uri",
				"manifest_file_hash",
				"asset_base_storage_uri",
				"rollout_cohort_count",
				"target_cohorts"
			],
			where: (b) => b("id", "=", id)
		});
		if (!result) return null;
		return mapBundleRecordToBundle(result, (await fetchBundlePatchMap(orm, [id])).get(id) ?? []);
	};
	return {
		api: {
			async getBundleById(id) {
				return fetchBundleById(id);
			},
			async getUpdateInfo(args) {
				const orm = await ensureORM();
				const toUpdateInfo = (row, status) => ({
					id: row.id,
					shouldForceUpdate: status === "ROLLBACK" ? true : Boolean(row.should_force_update),
					message: row.message ?? null,
					status,
					storageUri: row.storage_uri ?? null,
					fileHash: row.file_hash ?? null
				});
				const INIT_BUNDLE_ROLLBACK_UPDATE_INFO = {
					id: NIL_UUID,
					message: null,
					shouldForceUpdate: true,
					status: "ROLLBACK",
					storageUri: null,
					fileHash: null
				};
				const isEligibleForUpdate = (row, cohort) => {
					return isCohortEligibleForUpdate(row.id, cohort, row.rollout_cohort_count ?? null, parseTargetCohorts(row.target_cohorts));
				};
				const findUpdateInfoByScanning = async ({ args, where, isCandidate }) => {
					if (isMongoAdapter) {
						const rows = await orm.findMany("bundles", {
							select: [
								"id",
								"should_force_update",
								"message",
								"storage_uri",
								"file_hash",
								"rollout_cohort_count",
								"target_cohorts",
								"target_app_version",
								"fingerprint_hash"
							],
							where: buildBundleWhere(where)
						});
						rows.sort((a, b) => b.id.localeCompare(a.id));
						for (const row of rows) {
							if (!isCandidate(row)) continue;
							if (args.bundleId === NIL_UUID) {
								if (isEligibleForUpdate(row, args.cohort)) return toUpdateInfo(row, "UPDATE");
								continue;
							}
							const compareResult = row.id.localeCompare(args.bundleId);
							if (compareResult > 0) {
								if (isEligibleForUpdate(row, args.cohort)) return toUpdateInfo(row, "UPDATE");
								continue;
							}
							if (compareResult === 0) {
								if (isEligibleForUpdate(row, args.cohort)) return null;
								continue;
							}
							return toUpdateInfo(row, "ROLLBACK");
						}
						if (args.bundleId === NIL_UUID) return null;
						if (args.minBundleId && args.bundleId.localeCompare(args.minBundleId) <= 0) return null;
						return INIT_BUNDLE_ROLLBACK_UPDATE_INFO;
					}
					let offset = 0;
					while (true) {
						const rows = await orm.findMany("bundles", {
							select: [
								"id",
								"should_force_update",
								"message",
								"storage_uri",
								"file_hash",
								"rollout_cohort_count",
								"target_cohorts",
								"target_app_version",
								"fingerprint_hash"
							],
							where: buildBundleWhere(where),
							orderBy: [["id", "desc"]],
							limit: UPDATE_CHECK_PAGE_SIZE,
							offset
						});
						for (const row of rows) {
							if (!isCandidate(row)) continue;
							if (args.bundleId === NIL_UUID) {
								if (isEligibleForUpdate(row, args.cohort)) return toUpdateInfo(row, "UPDATE");
								continue;
							}
							const compareResult = row.id.localeCompare(args.bundleId);
							if (compareResult > 0) {
								if (isEligibleForUpdate(row, args.cohort)) return toUpdateInfo(row, "UPDATE");
								continue;
							}
							if (compareResult === 0) {
								if (isEligibleForUpdate(row, args.cohort)) return null;
								continue;
							}
							return toUpdateInfo(row, "ROLLBACK");
						}
						if (rows.length < UPDATE_CHECK_PAGE_SIZE) break;
						offset += UPDATE_CHECK_PAGE_SIZE;
					}
					if (args.bundleId === NIL_UUID) return null;
					if (args.minBundleId && args.bundleId.localeCompare(args.minBundleId) <= 0) return null;
					return INIT_BUNDLE_ROLLBACK_UPDATE_INFO;
				};
				const appVersionStrategy = async ({ platform, appVersion, bundleId, minBundleId = NIL_UUID, channel = "production", cohort }) => {
					return findUpdateInfoByScanning({
						args: {
							_updateStrategy: "appVersion",
							platform,
							appVersion,
							bundleId,
							minBundleId,
							channel,
							cohort
						},
						where: {
							enabled: true,
							platform,
							channel,
							id: { gte: minBundleId },
							targetAppVersionNotNull: true
						},
						isCandidate: (row) => !!row.target_app_version && semverSatisfies(row.target_app_version, appVersion)
					});
				};
				const fingerprintStrategy = async ({ platform, fingerprintHash, bundleId, minBundleId = NIL_UUID, channel = "production", cohort }) => {
					return findUpdateInfoByScanning({
						args: {
							_updateStrategy: "fingerprint",
							platform,
							fingerprintHash,
							bundleId,
							minBundleId,
							channel,
							cohort
						},
						where: {
							enabled: true,
							platform,
							channel,
							id: { gte: minBundleId },
							fingerprintHash
						},
						isCandidate: (row) => row.fingerprint_hash === fingerprintHash
					});
				};
				if (args._updateStrategy === "appVersion") return appVersionStrategy(args);
				if (args._updateStrategy === "fingerprint") return fingerprintStrategy(args);
				return null;
			},
			async getAppUpdateInfo(args, context) {
				const info = await this.getUpdateInfo(args);
				if (!info) return null;
				const { storageUri, ...rest } = info;
				if (!readStorageText) {
					const fileUrl = await resolveFileUrl(storageUri ?? null, context);
					return {
						...rest,
						fileUrl
					};
				}
				const [fileUrl, currentBundle, targetBundle] = await Promise.all([
					resolveFileUrl(storageUri ?? null, context),
					args.bundleId !== NIL_UUID ? fetchBundleById(args.bundleId) : null,
					info.id !== NIL_UUID ? fetchBundleById(info.id) : null
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
			async getChannels() {
				const rows = await (await ensureORM()).findMany("bundles", {
					select: ["channel"],
					orderBy: [["channel", "asc"]]
				});
				const set = new Set(rows?.map((r) => r.channel) ?? []);
				return Array.from(set);
			},
			async getBundles(options) {
				const orm = await ensureORM();
				const { where, limit } = options;
				const orderBy = options.orderBy ?? DEFAULT_BUNDLE_ORDER;
				const offset = ("offset" in options ? options.offset : void 0) ?? 0;
				const total = await orm.count("bundles", { where: buildBundleWhere(where) });
				const selectedColumns = [
					"id",
					"platform",
					"should_force_update",
					"enabled",
					"file_hash",
					"git_commit_hash",
					"message",
					"channel",
					"storage_uri",
					"target_app_version",
					"fingerprint_hash",
					"metadata",
					"manifest_storage_uri",
					"manifest_file_hash",
					"asset_base_storage_uri",
					"rollout_cohort_count",
					"target_cohorts"
				];
				const findBundles = async ({ where, orderBy, limit, offset }) => {
					const rows = isMongoAdapter ? (await orm.findMany("bundles", {
						select: selectedColumns,
						where: buildBundleWhere(where)
					})).sort((a, b) => {
						const result = a.id.localeCompare(b.id);
						return orderBy.direction === "asc" ? result : -result;
					}).slice(offset, offset + limit) : await orm.findMany("bundles", {
						select: selectedColumns,
						where: buildBundleWhere(where),
						orderBy: [[orderBy.field, orderBy.direction]],
						limit,
						offset
					});
					const patchMap = await fetchBundlePatchMap(orm, rows.map((row) => row.id));
					return rows.map((row) => mapBundleRecordToBundle(row, patchMap.get(row.id) ?? []));
				};
				if (!options.cursor?.after && !options.cursor?.before) {
					const data = await findBundles({
						where,
						orderBy,
						limit,
						offset
					});
					return {
						data,
						pagination: {
							...calculatePagination(total, {
								limit,
								offset
							}),
							...data.length > 0 && offset + data.length < total ? { nextCursor: data.at(-1)?.id } : {},
							...data.length > 0 && offset > 0 ? { previousCursor: data[0]?.id } : {}
						}
					};
				}
				const { where: cursorWhere, orderBy: cursorOrderBy, reverseData } = buildCursorPageWhere(where, options.cursor, orderBy);
				const cursorPage = await findBundles({
					where: cursorWhere,
					orderBy: cursorOrderBy,
					limit,
					offset: 0
				});
				const data = reverseData ? cursorPage.slice().reverse() : cursorPage;
				if (data.length === 0) return {
					data,
					pagination: {
						...calculatePagination(total, {
							limit,
							offset: options.cursor.after ? total : 0
						}),
						...options.cursor.after ? { previousCursor: options.cursor.after } : {},
						...options.cursor.before ? { nextCursor: options.cursor.before } : {}
					}
				};
				const startIndex = await orm.count("bundles", { where: buildBundleWhere(buildCountBeforeWhere(where, data[0].id, orderBy)) });
				return {
					data,
					pagination: {
						...calculatePagination(total, {
							limit,
							offset: startIndex
						}),
						...startIndex + data.length < total ? { nextCursor: data.at(-1)?.id } : {},
						...startIndex > 0 ? { previousCursor: data[0]?.id } : {}
					}
				};
			},
			async insertBundle(bundle) {
				assertBundlePersistenceConstraints(bundle);
				const orm = await ensureORM();
				const values = {
					id: bundle.id,
					platform: bundle.platform,
					should_force_update: bundle.shouldForceUpdate,
					enabled: bundle.enabled,
					file_hash: bundle.fileHash,
					git_commit_hash: bundle.gitCommitHash,
					message: bundle.message,
					channel: bundle.channel,
					storage_uri: bundle.storageUri,
					target_app_version: bundle.targetAppVersion,
					fingerprint_hash: bundle.fingerprintHash,
					metadata: stripBundleArtifactMetadata(bundle.metadata) ?? {},
					manifest_storage_uri: getManifestStorageUri(bundle),
					manifest_file_hash: getManifestFileHash(bundle),
					asset_base_storage_uri: getAssetBaseStorageUri(bundle),
					rollout_cohort_count: bundle.rolloutCohortCount ?? DEFAULT_ROLLOUT_COHORT_COUNT,
					target_cohorts: bundle.targetCohorts ?? null
				};
				const { id, ...updateValues } = values;
				await orm.upsert("bundles", {
					where: (b) => b("id", "=", id),
					create: values,
					update: updateValues
				});
				await orm.deleteMany("bundle_patches", { where: (b) => b("bundle_id", "=", bundle.id) });
				const patchValues = toBundlePatchRecords(bundle);
				if (patchValues.length > 0) await orm.createMany("bundle_patches", patchValues);
			},
			async updateBundleById(bundleId, newBundle) {
				const orm = await ensureORM();
				const current = await this.getBundleById(bundleId);
				if (!current) throw new Error("targetBundleId not found");
				const merged = {
					...current,
					...newBundle
				};
				assertBundlePersistenceConstraints(merged);
				const values = {
					id: merged.id,
					platform: merged.platform,
					should_force_update: merged.shouldForceUpdate,
					enabled: merged.enabled,
					file_hash: merged.fileHash,
					git_commit_hash: merged.gitCommitHash,
					message: merged.message,
					channel: merged.channel,
					storage_uri: merged.storageUri,
					target_app_version: merged.targetAppVersion,
					fingerprint_hash: merged.fingerprintHash,
					metadata: stripBundleArtifactMetadata(merged.metadata) ?? {},
					manifest_storage_uri: getManifestStorageUri(merged),
					manifest_file_hash: getManifestFileHash(merged),
					asset_base_storage_uri: getAssetBaseStorageUri(merged),
					rollout_cohort_count: merged.rolloutCohortCount ?? DEFAULT_ROLLOUT_COHORT_COUNT,
					target_cohorts: merged.targetCohorts ?? null
				};
				const { id: id2, ...updateValues2 } = values;
				await orm.upsert("bundles", {
					where: (b) => b("id", "=", id2),
					create: values,
					update: updateValues2
				});
				await orm.deleteMany("bundle_patches", { where: (b) => b("bundle_id", "=", merged.id) });
				const patchValues = toBundlePatchRecords(merged);
				if (patchValues.length > 0) await orm.createMany("bundle_patches", patchValues);
			},
			async deleteBundleById(bundleId) {
				const orm = await ensureORM();
				if (!await orm.findFirst("bundles", {
					select: ["id"],
					where: (b) => b("id", "=", bundleId)
				})) return;
				await orm.deleteMany("bundle_patches", { where: (b) => b("bundle_id", "=", bundleId) });
				await orm.deleteMany("bundle_patches", { where: (b) => b("base_bundle_id", "=", bundleId) });
				await orm.deleteMany("bundles", { where: (b) => b("id", "=", bundleId) });
			}
		},
		adapterName: client.adapter.name,
		createMigrator: () => wrapKyselyMigrator(client.createMigrator(), getSQLProvider(database.provider), lastSchemaVersion),
		generateSchema: (version, name) => {
			const result = client.generateSchema(version, name);
			return {
				...result,
				code: enhanceGeneratedSchema(client.adapter.name, result.code, database.provider)
			};
		}
	};
}
//#endregion
export { HotUpdaterDB, createOrmDatabaseCore };
