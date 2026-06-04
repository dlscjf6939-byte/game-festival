import { Bundle, DatabaseBundleIdFilter, DatabaseBundleQueryOrder, DatabaseBundleQueryWhere } from "./types/index.mjs";

//#region src/queryBundles.d.ts
declare function bundleIdMatchesFilter(id: string, filter: DatabaseBundleIdFilter | undefined): boolean;
declare function bundleMatchesQueryWhere(bundle: Bundle, where: DatabaseBundleQueryWhere | undefined): boolean;
declare function sortBundles(bundles: Bundle[], orderBy: DatabaseBundleQueryOrder | undefined): Bundle[];
//#endregion
export { bundleIdMatchesFilter, bundleMatchesQueryWhere, sortBundles };