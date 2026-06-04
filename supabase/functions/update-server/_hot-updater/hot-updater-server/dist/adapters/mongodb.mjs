import { mongoAdapter as mongoAdapter$1 } from "fumadb/adapters/mongodb";
//#region src/adapters/mongodb.ts
const mongoAdapter = (options) => Object.assign(mongoAdapter$1(options), { provider: "mongodb" });
//#endregion
export { mongoAdapter };
