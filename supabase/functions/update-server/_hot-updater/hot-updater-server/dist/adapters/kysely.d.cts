import { RelationMode as RelationMode$1, SQLProvider as SQLProvider$1 } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/index-CMqePMTF.cjs";
import { ORMDatabaseAdapter } from "../db/types.cjs";

//#region src/adapters/kysely.d.ts
type RelationMode = RelationMode$1;
type SQLProvider = SQLProvider$1;
interface KyselyConfig<TDatabase extends object = object> {
  db: TDatabase;
  provider: SQLProvider;
  relationMode?: RelationMode;
}
declare const kyselyAdapter: <TDatabase extends object>(config: KyselyConfig<TDatabase>) => ORMDatabaseAdapter;
//#endregion
export { KyselyConfig, RelationMode, SQLProvider, kyselyAdapter };