import { ORMDatabaseAdapter } from "../db/types.mjs";

//#region src/adapters/mongodb.d.ts
interface MongoDBConfig<TClient extends object = object> {
  client: TClient;
}
declare const mongoAdapter: <TClient extends object>(options: MongoDBConfig<TClient>) => ORMDatabaseAdapter;
//#endregion
export { MongoDBConfig, mongoAdapter };