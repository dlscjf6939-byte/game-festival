//#region src/queryBundles.ts
const compareValue = (value, expected, comparator) => {
	if (expected === void 0) return true;
	switch (comparator) {
		case "eq": return value === expected;
		case "gt": return value.localeCompare(expected) > 0;
		case "gte": return value.localeCompare(expected) >= 0;
		case "lt": return value.localeCompare(expected) < 0;
		case "lte": return value.localeCompare(expected) <= 0;
	}
};
function bundleIdMatchesFilter(id, filter) {
	if (!filter) return true;
	if (filter.in && !filter.in.includes(id)) return false;
	return compareValue(id, filter.eq, "eq") && compareValue(id, filter.gt, "gt") && compareValue(id, filter.gte, "gte") && compareValue(id, filter.lt, "lt") && compareValue(id, filter.lte, "lte");
}
function bundleMatchesQueryWhere(bundle, where) {
	if (!where) return true;
	if (where.channel !== void 0 && bundle.channel !== where.channel) return false;
	if (where.platform !== void 0 && bundle.platform !== where.platform) return false;
	if (where.enabled !== void 0 && bundle.enabled !== where.enabled) return false;
	if (!bundleIdMatchesFilter(bundle.id, where.id)) return false;
	if (where.targetAppVersionNotNull === true && bundle.targetAppVersion === null) return false;
	if (where.targetAppVersion !== void 0 && bundle.targetAppVersion !== where.targetAppVersion) return false;
	if (where.targetAppVersionIn && !where.targetAppVersionIn.includes(bundle.targetAppVersion ?? "")) return false;
	if (where.fingerprintHash !== void 0 && bundle.fingerprintHash !== where.fingerprintHash) return false;
	return true;
}
function sortBundles(bundles, orderBy) {
	const direction = orderBy?.direction ?? "desc";
	if (orderBy && orderBy.field !== "id") return bundles;
	return bundles.slice().sort((a, b) => {
		const result = a.id.localeCompare(b.id);
		return direction === "asc" ? result : -result;
	});
}
//#endregion
export { bundleIdMatchesFilter, bundleMatchesQueryWhere, sortBundles };
