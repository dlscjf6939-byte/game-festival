import { PaginationInfo } from "./types/index.mjs";

//#region src/calculatePagination.d.ts
interface PaginationOptions {
  limit: number;
  offset: number;
}
/**
 * Calculate pagination information based on total count, limit, and offset
 */
declare function calculatePagination(total: number, options: PaginationOptions): PaginationInfo;
//#endregion
export { PaginationOptions, calculatePagination };