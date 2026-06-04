const require_runtime = require("../_virtual/_rolldown/runtime.cjs");
let _hot_updater_core = require("@hot-updater/core");
let semver = require("semver");
semver = require_runtime.__toESM(semver);
//#region src/db/schemaEnhancements.ts
const normalizeNullableString = (value) => {
	if (value === null || value === void 0) return null;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
};
const appendPrismaModelLines = (code, modelName, lines, options) => {
	const pattern = new RegExp(`model ${modelName} \\{\\n([\\s\\S]*?)\\n\\}`, "m");
	return code.replace(pattern, (full, body) => {
		const bodyLines = body.split("\n");
		const existingLines = new Set(bodyLines.map((line) => line.trim()).filter(Boolean));
		const additions = lines.filter((line) => !existingLines.has(line)).map((line) => `  ${line}`);
		if (additions.length === 0) return full;
		if (options?.position === "beforeAttributes") {
			const insertIndex = bodyLines.findIndex((line) => line.trim().startsWith("@@"));
			if (insertIndex === -1) bodyLines.push(...additions);
			else bodyLines.splice(insertIndex, 0, ...additions);
			return `model ${modelName} {\n${bodyLines.join("\n")}\n}`;
		}
		return `model ${modelName} {\n${body}\n${additions.join("\n")}\n}`;
	});
};
const getPrismaDatasourceProvider = (code) => {
	return code.match(/datasource\s+\w+\s+\{[\s\S]*?provider\s*=\s*"([^"]+)"[\s\S]*?\}/m)?.[1] ?? null;
};
const ensureDrizzleIndexImport = (code) => code.replace(/import \{ ([^}]+) \} from "(drizzle-orm\/[^"]+-core)"/, (_full, imports, modulePath) => {
	const values = imports.split(",").map((value) => value.trim()).filter(Boolean);
	if (!values.includes("index")) values.push("index");
	return `import { ${values.join(", ")} } from "${modulePath}"`;
});
const ensureDrizzleMetadataDefault = (code) => code.replace(/metadata: json\("metadata"\)\.notNull\(\)(?!\.default\(\{\}\))/, "metadata: json(\"metadata\").notNull().default({})").replace(/metadata: blob\("metadata", \{ mode: "json" \}\)\.notNull\(\)(?!\.default\(\{\}\))/, "metadata: blob(\"metadata\", { mode: \"json\" }).notNull().default({})");
const removeUnusedDrizzleRelationMany = (code) => code.replace(/export const bundle_patchesRelations = relations\(bundle_patches, \(\{ one, many \}\) => \(\{/, "export const bundle_patchesRelations = relations(bundle_patches, ({ one }) => ({");
const ensureTrailingComma = (line) => {
	const trimmed = line.trim();
	if (!trimmed || trimmed.endsWith(",") || trimmed.endsWith("[")) return line;
	return `${line},`;
};
const updateDrizzleTableBlock = (code, tableName, callbackLines) => {
	const blockStart = code.indexOf(`export const ${tableName} = `);
	if (blockStart === -1) return code;
	const nextBlockStart = code.indexOf("\n\nexport const ", blockStart + 1);
	const blockEnd = nextBlockStart === -1 ? code.length : nextBlockStart;
	const block = code.slice(blockStart, blockEnd);
	if (block.includes(", (table) => [")) {
		const callbackPattern = /, \(table\) => \[\n([\s\S]*?)\n\]\)\s*$/;
		const match = block.match(callbackPattern);
		if (!match) return code;
		const callbackBody = match[1] ?? "";
		const existingLines = callbackBody.split("\n").map((line) => line.trim()).filter(Boolean);
		const additions = callbackLines.filter((line) => !existingLines.includes(line));
		if (additions.length === 0) return code;
		const callbackBodyLines = callbackBody.split("\n");
		for (let index = callbackBodyLines.length - 1; index >= 0; index -= 1) if (callbackBodyLines[index]?.trim()) {
			callbackBodyLines[index] = ensureTrailingComma(callbackBodyLines[index]);
			break;
		}
		const nextCallbackBody = [...callbackBodyLines, ...additions.map((line) => `  ${line}`)].join("\n");
		const nextBlock = block.replace(callbackPattern, `, (table) => [\n${nextCallbackBody}\n])`);
		return `${code.slice(0, blockStart)}${nextBlock}${code.slice(blockEnd)}`;
	}
	const callbackBody = callbackLines.map((line) => `  ${line}`).join("\n");
	const nextBlock = block.replace(/\n\}\)\s*$/, `\n}, (table) => [\n${callbackBody}\n])`);
	return `${code.slice(0, blockStart)}${nextBlock}${code.slice(blockEnd)}`;
};
const addCustomSqlOperation = (result, sql) => {
	const normalizedSql = sql.trim();
	if (!result.operations.some((operation) => {
		return operation["type"] === "custom" && typeof operation["sql"] === "string" && operation["sql"].trim() === normalizedSql;
	})) result.operations.push({
		type: "custom",
		sql: normalizedSql
	});
};
const getMigrationCustomSql = (provider, targetVersion) => {
	const statements = [];
	const hasRolloutColumns = semver.default.gte(targetVersion, "0.29.0");
	const hasPatchTable = semver.default.gte(targetVersion, "0.31.0");
	if (provider === "postgresql") {
		statements.push("create index bundles_target_app_version_idx on bundles(target_app_version)", "create index bundles_fingerprint_hash_idx on bundles(fingerprint_hash)", "create index bundles_channel_idx on bundles(channel)", "alter table bundles add constraint check_version_or_fingerprint check ((target_app_version is not null) or (fingerprint_hash is not null))");
		if (hasRolloutColumns) statements.push("create index bundles_rollout_idx on bundles(rollout_cohort_count)", "alter table bundles add constraint bundles_rollout_cohort_count_check check (rollout_cohort_count >= 0 and rollout_cohort_count <= 1000)");
		if (hasPatchTable) statements.push("create index bundle_patches_bundle_id_idx on bundle_patches(bundle_id)", "create index bundle_patches_base_bundle_id_idx on bundle_patches(base_bundle_id)");
		return statements;
	}
	if (provider === "mysql") {
		statements.push("create index bundles_target_app_version_idx on bundles(target_app_version(255))", "create index bundles_fingerprint_hash_idx on bundles(fingerprint_hash(255))", "create index bundles_channel_idx on bundles(channel(255))", "alter table bundles add constraint check_version_or_fingerprint check ((target_app_version is not null) or (fingerprint_hash is not null))");
		if (hasRolloutColumns) statements.push("create index bundles_rollout_idx on bundles(rollout_cohort_count)", "alter table bundles add constraint bundles_rollout_cohort_count_check check (rollout_cohort_count >= 0 and rollout_cohort_count <= 1000)");
		if (hasPatchTable) statements.push("create index bundle_patches_bundle_id_idx on bundle_patches(bundle_id)", "create index bundle_patches_base_bundle_id_idx on bundle_patches(base_bundle_id)");
		return statements;
	}
	statements.push("create index bundles_target_app_version_idx on bundles(target_app_version)", "create index bundles_fingerprint_hash_idx on bundles(fingerprint_hash)", "create index bundles_channel_idx on bundles(channel)");
	if (hasRolloutColumns) statements.push("create index bundles_rollout_idx on bundles(rollout_cohort_count)");
	if (hasPatchTable) statements.push("create index bundle_patches_bundle_id_idx on bundle_patches(bundle_id)", "create index bundle_patches_base_bundle_id_idx on bundle_patches(base_bundle_id)");
	return statements;
};
const enhanceUpwardMigrationResult = (result, provider, targetVersion) => {
	for (const sql of getMigrationCustomSql(provider, targetVersion)) addCustomSqlOperation(result, sql);
	return result;
};
const assertBundlePersistenceConstraints = (bundle) => {
	const targetAppVersion = normalizeNullableString(bundle.targetAppVersion);
	const fingerprintHash = normalizeNullableString(bundle.fingerprintHash);
	if (!targetAppVersion && !fingerprintHash) throw new Error("Bundle must define either targetAppVersion or fingerprintHash.");
	const rolloutCohortCount = bundle.rolloutCohortCount;
	if (rolloutCohortCount !== null && rolloutCohortCount !== void 0) {
		if (!Number.isInteger(rolloutCohortCount) || rolloutCohortCount < 0 || rolloutCohortCount > _hot_updater_core.DEFAULT_ROLLOUT_COHORT_COUNT) throw new Error(`rolloutCohortCount must be an integer between 0 and ${_hot_updater_core.DEFAULT_ROLLOUT_COHORT_COUNT}.`);
	}
	for (const cohort of bundle.targetCohorts ?? []) if (!(0, _hot_updater_core.isValidCohort)(cohort)) throw new Error(`Invalid target cohort "${cohort}". ${_hot_updater_core.INVALID_COHORT_ERROR_MESSAGE}`);
};
const enhanceGeneratedSchema = (adapterName, code, provider) => {
	if (adapterName === "prisma") {
		const datasourceProvider = provider ?? getPrismaDatasourceProvider(code);
		let nextCode = code;
		if (datasourceProvider !== "sqlite") nextCode = nextCode.replace(/^(\s*metadata\s+Json)(?!\s+@default\("?\{\}"?\))(.*)$/m, "$1 @default(\"{}\")$2");
		nextCode = appendPrismaModelLines(nextCode, "bundles", ["patches bundle_patches[] @relation(\"bundle_patches_bundles_patches\")", "baseForPatches bundle_patches[] @relation(\"bundle_patches_bundles_baseForPatches\")"], { position: "beforeAttributes" });
		nextCode = appendPrismaModelLines(nextCode, "bundles", [
			"@@index([target_app_version], map: \"bundles_target_app_version_idx\")",
			"@@index([fingerprint_hash], map: \"bundles_fingerprint_hash_idx\")",
			"@@index([channel], map: \"bundles_channel_idx\")",
			"@@index([rollout_cohort_count], map: \"bundles_rollout_idx\")"
		]);
		return appendPrismaModelLines(nextCode, "bundle_patches", ["@@index([bundle_id], map: \"bundle_patches_bundle_id_idx\")", "@@index([base_bundle_id], map: \"bundle_patches_base_bundle_id_idx\")"]);
	}
	if (adapterName === "drizzle") {
		let nextCode = ensureDrizzleMetadataDefault(code);
		nextCode = removeUnusedDrizzleRelationMany(nextCode);
		nextCode = ensureDrizzleIndexImport(nextCode);
		nextCode = updateDrizzleTableBlock(nextCode, "bundles", [
			"index(\"bundles_target_app_version_idx\").on(table.target_app_version),",
			"index(\"bundles_fingerprint_hash_idx\").on(table.fingerprint_hash),",
			"index(\"bundles_channel_idx\").on(table.channel),",
			"index(\"bundles_rollout_idx\").on(table.rollout_cohort_count),"
		]);
		nextCode = updateDrizzleTableBlock(nextCode, "bundle_patches", ["index(\"bundle_patches_bundle_id_idx\").on(table.bundle_id),", "index(\"bundle_patches_base_bundle_id_idx\").on(table.base_bundle_id),"]);
		return nextCode;
	}
	return code;
};
const wrapKyselyMigrator = (migrator, provider, latestVersion) => {
	if (!provider) return migrator;
	return {
		...migrator,
		async up(...args) {
			const next = await migrator.next();
			const result = await migrator.up(...args);
			if (next) enhanceUpwardMigrationResult(result, provider, next.version);
			return result;
		},
		async migrateTo(...args) {
			const version = args[0];
			const options = args[1];
			const currentVersion = await migrator.getVersion();
			const result = await migrator.migrateTo(version, options);
			if (!currentVersion || semver.default.gt(version, currentVersion)) enhanceUpwardMigrationResult(result, provider, version);
			return result;
		},
		async migrateToLatest(...args) {
			const currentVersion = await migrator.getVersion();
			const result = await migrator.migrateToLatest(...args);
			if (!currentVersion || semver.default.gt(latestVersion, currentVersion)) enhanceUpwardMigrationResult(result, provider, latestVersion);
			return result;
		}
	};
};
//#endregion
exports.assertBundlePersistenceConstraints = assertBundlePersistenceConstraints;
exports.enhanceGeneratedSchema = enhanceGeneratedSchema;
exports.wrapKyselyMigrator = wrapKyselyMigrator;
