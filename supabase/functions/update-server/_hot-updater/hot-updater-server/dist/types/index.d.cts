import { HotUpdaterAPI } from "../db/index.cjs";
import { Bundle, Bundle as Bundle$1 } from "@hot-updater/core";

//#region src/types/index.d.ts
interface PaginationInfo {
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPage: number;
  totalPages: number;
  nextCursor?: string | null;
  previousCursor?: string | null;
}
interface PaginationOptions {
  limit: number;
  offset: number;
}
interface DataResponse<TData> {
  data: TData;
}
interface Paginated<TData> extends DataResponse<TData> {
  pagination: PaginationInfo;
}
type PaginatedResult = Paginated<Bundle[]>;
type ChannelsResponse = DataResponse<{
  channels: string[];
}>;
//#endregion
export { type Bundle$1 as Bundle, ChannelsResponse, DataResponse, Paginated, PaginatedResult, PaginationInfo, PaginationOptions };