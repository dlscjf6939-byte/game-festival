import { Bundle, DatabaseBundleCursor, DatabaseBundleQueryOrder, Paginated } from "./types/index.cjs";

//#region src/paginateBundles.d.ts
declare function paginateBundles({
  bundles,
  limit,
  offset,
  cursor,
  orderBy
}: {
  bundles: Bundle[];
  limit: number;
  offset?: number;
  cursor?: DatabaseBundleCursor;
  orderBy?: DatabaseBundleQueryOrder;
}): Paginated<Bundle[]>;
//#endregion
export { paginateBundles };