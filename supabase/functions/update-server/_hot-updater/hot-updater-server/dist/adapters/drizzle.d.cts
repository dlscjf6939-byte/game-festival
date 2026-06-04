import { drizzleAdapter as drizzleAdapter$1 } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/adapters/drizzle/index.cjs";
import { ORMDatabaseAdapter } from "../db/types.cjs";

//#region src/adapters/drizzle.d.ts
type DrizzleConfig = Parameters<typeof drizzleAdapter$1>[0];
declare const drizzleAdapter: (config: DrizzleConfig) => ORMDatabaseAdapter;
//#endregion
export { DrizzleConfig, drizzleAdapter };