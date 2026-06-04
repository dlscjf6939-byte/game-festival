//#region src/internalRouter.ts
const normalizePath = (path) => {
	if (!path) return "/";
	if (path === "/") return path;
	const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
	return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
};
const toSegments = (path) => {
	const normalized = normalizePath(path);
	return normalized === "/" ? [] : normalized.slice(1).split("/");
};
function createRouter() {
	return { routes: [] };
}
function addRoute(router, method, path, data) {
	const segments = toSegments(path);
	const paramNames = segments.filter((segment) => segment.startsWith(":")).map((segment) => segment.slice(1));
	router.routes.push({
		data,
		method: method.toUpperCase(),
		paramNames,
		segments
	});
}
function findRoute(router, method, path) {
	const normalizedMethod = method.toUpperCase();
	const pathSegments = toSegments(path);
	for (const route of router.routes) {
		if (route.method !== normalizedMethod) continue;
		if (route.segments.length !== pathSegments.length) continue;
		const params = {};
		let matched = true;
		for (let index = 0; index < route.segments.length; index += 1) {
			const routeSegment = route.segments[index];
			const pathSegment = pathSegments[index];
			if (routeSegment.startsWith(":")) {
				params[routeSegment.slice(1)] = pathSegment;
				continue;
			}
			if (routeSegment !== pathSegment) {
				matched = false;
				break;
			}
		}
		if (matched) return {
			data: route.data,
			params
		};
	}
}
//#endregion
exports.addRoute = addRoute;
exports.createRouter = createRouter;
exports.findRoute = findRoute;
