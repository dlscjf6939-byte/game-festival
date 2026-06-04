//#region src/route.ts
const normalizeBasePath = (basePath) => {
	if (!basePath || basePath === "/") return "/";
	return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
};
//#endregion
export { normalizeBasePath };
